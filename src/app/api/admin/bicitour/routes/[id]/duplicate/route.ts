import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { BicitourQuestion, BicitourRoute, BicitourStop } from '@/lib/bicitour'

export const runtime = 'nodejs'

// Duplica un recorrido completo (paradas y preguntas) como borrador, para
// crear variantes sin tocar el original.
export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const routeId = Number(id)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const [{ data: routeRow }, { data: stops }] = await Promise.all([
    supabase.from('bicitour_routes').select('*').eq('id', routeId).maybeSingle(),
    supabase.from('bicitour_stops').select('*').eq('route_id', routeId).order('position'),
  ])
  const route = routeRow as BicitourRoute | null
  if (!route) return NextResponse.json({ error: 'Recorrido no encontrado.' }, { status: 404 })

  const { data: newRouteRow, error: routeError } = await supabase
    .from('bicitour_routes')
    .insert({
      title: `${route.title} (copia)`.slice(0, 120),
      description: route.description,
      status: 'draft',
      mode: route.mode,
      path: route.path,
    })
    .select('*')
    .single()
  if (routeError || !newRouteRow) return NextResponse.json({ error: 'No se pudo duplicar el recorrido.' }, { status: 500 })

  const stopIds = ((stops || []) as BicitourStop[]).map((stop) => stop.id)
  const { data: questions } = stopIds.length
    ? await supabase.from('bicitour_questions').select('*').in('stop_id', stopIds)
    : { data: [] }

  for (const stop of (stops || []) as BicitourStop[]) {
    const { data: newStop } = await supabase
      .from('bicitour_stops')
      .insert({
        route_id: newRouteRow.id,
        position: stop.position,
        title: stop.title,
        description: stop.description,
        fun_facts: stop.fun_facts,
        image_urls: stop.image_urls,
        audio_url: stop.audio_url,
        hint: stop.hint,
        lat: stop.lat,
        lng: stop.lng,
        radius_m: stop.radius_m,
        is_draft: stop.is_draft,
      })
      .select('id')
      .single()

    if (newStop) {
      const stopQuestions = ((questions || []) as BicitourQuestion[]).filter((question) => question.stop_id === stop.id)
      if (stopQuestions.length) {
        await supabase.from('bicitour_questions').insert(
          stopQuestions.map((question) => ({
            stop_id: newStop.id,
            position: question.position,
            type: question.type,
            prompt: question.prompt,
            options: question.options,
            correct_key: question.correct_key,
            explanation: question.explanation,
            points: question.points,
          })),
        )
      }
    }
  }

  return NextResponse.json({ data: newRouteRow }, { status: 201 })
}
