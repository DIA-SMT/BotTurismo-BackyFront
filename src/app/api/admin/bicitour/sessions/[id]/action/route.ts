import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import type { BicitourSession, BicitourSessionStop, BicitourStop } from '@/lib/bicitour'
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

  const sql = getSql()
  const [session] = await sql<BicitourSession[]>`select * from bicitour_sessions where id = ${sessionId}`
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })

  const fail = (message: string, status = 409) => NextResponse.json({ error: message }, { status })

  // Las escrituras de cada acción no cortan la respuesta si fallan: se
  // registran y la acción sigue hasta el incremento de versión.
  const logWriteError = (error: unknown) => {
    console.error(`Error en la acción "${action}" de la sesión de bicitour:`, error)
  }

  const loadSessionStop = async (sessionStopId: number) => {
    // Un id ausente, no entero o fuera de rango no puede existir: misma
    // respuesta que "no encontrada" (sin mandarlo a la base, que lo rechaza).
    if (!Number.isSafeInteger(sessionStopId)) return null
    const [sessionStop] = await sql<BicitourSessionStop[]>`
      select * from bicitour_session_stops where id = ${sessionStopId} and session_id = ${sessionId}
    `
    return sessionStop ?? null
  }

  switch (action) {
    case 'start': {
      if (session.status !== 'lobby') return fail('La sesión ya fue iniciada.')
      await sql`
        update bicitour_sessions set status = ${'active'}, started_at = ${new Date().toISOString()}
        where id = ${sessionId}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, 'session_started')
      break
    }

    case 'pause': {
      if (session.status !== 'active') return fail('La sesión no está activa.')
      await sql`update bicitour_sessions set status = ${'paused'} where id = ${sessionId}`.catch(logWriteError)
      await logSessionEvent(sessionId, 'session_paused')
      break
    }

    case 'resume': {
      if (session.status !== 'paused') return fail('La sesión no está pausada.')
      await sql`update bicitour_sessions set status = ${'active'} where id = ${sessionId}`.catch(logWriteError)
      await logSessionEvent(sessionId, 'session_resumed')
      break
    }

    case 'finish': {
      if (session.status === 'finished') return fail('La sesión ya finalizó.')
      await finishSession(session)
      break
    }

    // Red de seguridad si el guía finaliza por accidente.
    case 'reopen': {
      if (session.status !== 'finished') return fail('La sesión no está finalizada.')
      await sql`
        update bicitour_sessions set status = ${'active'}, finished_at = null where id = ${sessionId}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, 'session_reopened')
      break
    }

    case 'gps': {
      await sql`
        update bicitour_sessions set gps_enabled = ${body.enabled === true} where id = ${sessionId}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, body.enabled === true ? 'gps_on' : 'gps_off')
      break
    }

    case 'announce': {
      const text = String(body.text || '').trim().slice(0, 200)
      if (!text) return fail('Escribí el aviso.', 400)
      await sql`
        update bicitour_sessions set announcement = ${text}, announcement_at = ${new Date().toISOString()}
        where id = ${sessionId}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, 'announcement', { text })
      break
    }

    case 'open_stop': {
      if (session.status !== 'active') return fail('Iniciá o reanudá la sesión antes de abrir una parada.')
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (target.status === 'completed' || target.status === 'skipped') return fail('Esa parada ya se cerró.')

      // Solo una parada abierta a la vez. Si la anterior quedó con la
      // pregunta cerrada, se completa sola (reparte sellos) antes de avanzar.
      const openRows = await sql<BicitourSessionStop[]>`
        select * from bicitour_session_stops
        where session_id = ${sessionId} and status in ('open', 'question_active', 'question_closed')
      `
      let autoCompleted = false
      for (const row of openRows) {
        if (row.id === target.id) continue
        if (row.status === 'question_closed') {
          await completeSessionStop(session, row)
          autoCompleted = true
        } else {
          return fail('Cerrá la parada actual antes de abrir otra.')
        }
      }
      if (autoCompleted) await awardSessionBadges(session)

      await sql`
        update bicitour_session_stops
        set status = ${'open'}, opened_at = ${target.opened_at || new Date().toISOString()}, active_question_id = null
        where id = ${target.id}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, 'stop_opened', { sessionStopId: target.id })
      break
    }

    case 'activate_question': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (!['open', 'question_closed'].includes(target.status)) return fail('Abrí la parada antes de lanzar la pregunta.')
      const questionId = Number(body.questionId)
      const [question] = Number.isSafeInteger(questionId)
        ? await sql<{ id: number; stop_id: number }[]>`select id, stop_id from bicitour_questions where id = ${questionId}`
        : []
      if (!question || question.stop_id !== target.stop_id) return fail('La pregunta no pertenece a esta parada.', 400)

      await sql`
        update bicitour_session_stops set status = ${'question_active'}, active_question_id = ${questionId}
        where id = ${target.id}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, 'question_activated', { questionId })
      break
    }

    case 'close_question': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (target.status !== 'question_active') return fail('No hay una pregunta activa en esa parada.')
      await sql`
        update bicitour_session_stops set status = ${'question_closed'} where id = ${target.id}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, 'question_closed', { questionId: target.active_question_id })
      await awardSessionBadges(session)
      break
    }

    case 'complete_stop': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (!['open', 'question_active', 'question_closed'].includes(target.status)) {
        return fail('La parada no está abierta.')
      }
      await completeSessionStop(session, target)
      await awardSessionBadges(session)
      break
    }

    case 'skip_stop': {
      const target = await loadSessionStop(Number(body.sessionStopId))
      if (!target) return fail('Parada no encontrada.', 404)
      if (target.status !== 'locked') return fail('Solo se pueden omitir paradas que no se abrieron.')
      await sql`update bicitour_session_stops set status = ${'skipped'} where id = ${target.id}`.catch(logWriteError)
      await logSessionEvent(sessionId, 'stop_skipped', { sessionStopId: target.id })
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

      const [lastStop] = await sql<{ position: number }[]>`
        select position from bicitour_stops where route_id = ${session.route_id} order by position desc limit 1
      `
      let newStop: BicitourStop | undefined
      try {
        const [created] = await sql<BicitourStop[]>`
          insert into bicitour_stops ${rowValues(sql, {
            route_id: session.route_id,
            position: Number(lastStop?.position || 0) + 1,
            title,
            description: String(body.description || '').trim() || null,
            lat,
            lng,
            is_draft: true,
          })}
          returning *
        `
        newStop = created
      } catch {
        return fail('No se pudo crear la parada.', 500)
      }
      if (!newStop) return fail('No se pudo crear la parada.', 500)

      const [lastSessionStop] = await sql<{ position: number }[]>`
        select position from bicitour_session_stops where session_id = ${sessionId} order by position desc limit 1
      `
      await sql`
        insert into bicitour_session_stops ${rowValues(sql, {
          session_id: sessionId,
          stop_id: newStop.id,
          position: Number(lastSessionStop?.position || 0) + 1,
        })}
      `.catch(logWriteError)
      await logSessionEvent(sessionId, 'spontaneous_stop', { stopId: newStop.id, title })
      break
    }

    default:
      return fail('Acción desconocida.', 400)
  }

  await bumpSessionVersion(sessionId)
  return NextResponse.json({ data: { ok: true } })
}
