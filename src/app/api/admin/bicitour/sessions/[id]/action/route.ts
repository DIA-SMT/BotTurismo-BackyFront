import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { BicitourSession, BicitourSessionStop } from '@/lib/bicitour'
import { awardSessionBadges } from '@/lib/bicitour-badges-server'
import { bumpSessionVersion, completeSessionStop, finishSession, logSessionEvent } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

// Todas las acciones del guía sobre la sesión en vivo. Cada acción valida el
// estado actual en la base (nunca confía en lo que dice el navegador) y
// termina incrementando la versión para que los celulares se enteren.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }
  const action = String(body.action || '')

  const supabase = createServerSupabaseClient()
  const { data: sessionRow } = await supabase.from('bicitour_sessions').select('*').eq('id', sessionId).maybeSingle()
  const session = sessionRow as BicitourSession | null
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })

  const fail = (message: string, status = 409) => NextResponse.json({ error: message }, { status })

  const loadSessionStop = async (sessionStopId: number) => {
    const { data } = await supabase
      .from('bicitour_session_stops')
      .select('*')
      .eq('id', sessionStopId)
      .eq('session_id', sessionId)
      .maybeSingle()
    return data as BicitourSessionStop | null
  }

  switch (action) {
    case 'start': {
      if (session.status !== 'lobby') return fail('La sesión ya fue iniciada.')
      await supabase
        .from('bicitour_sessions')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', sessionId)
      await logSessionEvent(supabase, sessionId, 'session_started')
      break
    }

    case 'pause': {
      if (session.status !== 'active') return fail('La sesión no está activa.')
      await supabase.from('bicitour_sessions').update({ status: 'paused' }).eq('id', sessionId)
      await logSessionEvent(supabase, sessionId, 'session_paused')
      break
    }

    case 'resume': {
      if (session.status !== 'paused') return fail('La sesión no está pausada.')
      await supabase.from('bicitour_sessions').update({ status: 'active' }).eq('id', sessionId)
      await logSessionEvent(supabase, sessionId, 'session_resumed')
      break
    }

    case 'finish': {
      if (session.status === 'finished') return fail('La sesión ya finalizó.')
      await finishSession(supabase, session)
      break
    }

    // Red de seguridad si el guía finaliza por accidente.
    case 'reopen': {
      if (session.status !== 'finished') return fail('La sesión no está finalizada.')
      await supabase
        .from('bicitour_sessions')
        .update({ status: 'active', finished_at: null })
        .eq('id', sessionId)
      await logSessionEvent(supabase, sessionId, 'session_reopened')
      break
    }

    case 'gps': {
      await supabase.from('bicitour_sessions').update({ gps_enabled: body.enabled === true }).eq('id', sessionId)
      await logSessionEvent(supabase, sessionId, body.enabled === true ? 'gps_on' : 'gps_off')
      break
    }

    case 'announce': {
      const text = String(body.text || '').trim().slice(0, 200)
      if (!text) return fail('Escribí el aviso.', 400)
      await supabase
        .from('bicitour_sessions')
        .update({ announcement: text, announcement_at: new Date().toISOString() })
        .eq('id', sessionId)
      await logSessionEvent(supabase, sessionId, 'announcement', { text })
      break
    }

    case 'open_stop': {
      if (session.status !== 'active') return fail('Iniciá o reanudá la sesión antes de abrir una parada.')
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (target.status === 'completed' || target.status === 'skipped') return fail('Esa parada ya se cerró.')

      // Solo una parada abierta a la vez. Si la anterior quedó con la
      // pregunta cerrada, se completa sola (reparte sellos) antes de avanzar.
      const { data: openRows } = await supabase
        .from('bicitour_session_stops')
        .select('*')
        .eq('session_id', sessionId)
        .in('status', ['open', 'question_active', 'question_closed'])
      let autoCompleted = false
      for (const row of (openRows || []) as BicitourSessionStop[]) {
        if (row.id === target.id) continue
        if (row.status === 'question_closed') {
          await completeSessionStop(supabase, session, row)
          autoCompleted = true
        } else {
          return fail('Cerrá la parada actual antes de abrir otra.')
        }
      }
      if (autoCompleted) await awardSessionBadges(supabase, session)

      await supabase
        .from('bicitour_session_stops')
        .update({ status: 'open', opened_at: target.opened_at || new Date().toISOString(), active_question_id: null })
        .eq('id', target.id)
      await logSessionEvent(supabase, sessionId, 'stop_opened', { sessionStopId: target.id })
      break
    }

    case 'activate_question': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (!['open', 'question_closed'].includes(target.status)) return fail('Abrí la parada antes de lanzar la pregunta.')
      const questionId = Number(body.questionId)
      const { data: question } = await supabase
        .from('bicitour_questions')
        .select('id,stop_id')
        .eq('id', questionId)
        .maybeSingle()
      if (!question || question.stop_id !== target.stop_id) return fail('La pregunta no pertenece a esta parada.', 400)

      await supabase
        .from('bicitour_session_stops')
        .update({ status: 'question_active', active_question_id: questionId })
        .eq('id', target.id)
      await logSessionEvent(supabase, sessionId, 'question_activated', { questionId })
      break
    }

    case 'close_question': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (target.status !== 'question_active') return fail('No hay una pregunta activa en esa parada.')
      await supabase.from('bicitour_session_stops').update({ status: 'question_closed' }).eq('id', target.id)
      await logSessionEvent(supabase, sessionId, 'question_closed', { questionId: target.active_question_id })
      await awardSessionBadges(supabase, session)
      break
    }

    case 'complete_stop': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (!['open', 'question_active', 'question_closed'].includes(target.status)) {
        return fail('La parada no está abierta.')
      }
      await completeSessionStop(supabase, session, target)
      await awardSessionBadges(supabase, session)
      break
    }

    case 'skip_stop': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (target.status !== 'locked') return fail('Solo se pueden omitir paradas que no se abrieron.')
      await supabase.from('bicitour_session_stops').update({ status: 'skipped' }).eq('id', target.id)
      await logSessionEvent(supabase, sessionId, 'stop_skipped', { sessionStopId: target.id })
      break
    }

    // Parada espontánea creada en la calle: queda como borrador del recorrido
    // (el administrador la revisa después) y se suma al final de la sesión.
    case 'spontaneous_stop': {
      const title = String(body.title || '').trim().slice(0, 140)
      const lat = Number(body.lat)
      const lng = Number(body.lng)
      if (title.length < 2) return fail('Poné un nombre a la parada.', 400)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail('No hay ubicación GPS para la parada.', 400)

      const { data: lastStop } = await supabase
        .from('bicitour_stops')
        .select('position')
        .eq('route_id', session.route_id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data: newStop, error: stopError } = await supabase
        .from('bicitour_stops')
        .insert({
          route_id: session.route_id,
          position: Number(lastStop?.position || 0) + 1,
          title,
          description: String(body.description || '').trim() || null,
          lat,
          lng,
          is_draft: true,
        })
        .select('*')
        .single()
      if (stopError || !newStop) return fail('No se pudo crear la parada.', 500)

      const { data: lastSessionStop } = await supabase
        .from('bicitour_session_stops')
        .select('position')
        .eq('session_id', sessionId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      await supabase.from('bicitour_session_stops').insert({
        session_id: sessionId,
        stop_id: newStop.id,
        position: Number(lastSessionStop?.position || 0) + 1,
      })
      await logSessionEvent(supabase, sessionId, 'spontaneous_stop', { stopId: newStop.id, title })
      break
    }

    default:
      return fail('Acción desconocida.', 400)
  }

  await bumpSessionVersion(supabase, sessionId)
  return NextResponse.json({ data: { ok: true } })
}
