import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { TouristCircuitRecord } from '@/lib/tourist-circuits'
import { buildEnglishFields, circuitInputToSpanishFields, parseCircuitInput } from '@/lib/tourist-circuits-admin'
import { isAiTranslationConfigured } from '@/lib/ai-translate'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const circuitId = Number(id)
  if (!Number.isInteger(circuitId)) {
    return NextResponse.json({ error: 'Circuito inválido.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: existing, error: existingError } = await supabase
    .from('tourist_circuits')
    .select('*')
    .eq('id', circuitId)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  // Cambio rápido de estado (activar/desactivar) sin tocar el contenido.
  if (body.toggleActive === true) {
    const { data, error } = await supabase
      .from('tourist_circuits')
      .update({ active: !(existing as TouristCircuitRecord).active })
      .eq('id', circuitId)
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
    }
    return NextResponse.json({ data, translated: false })
  }

  const { input, errors } = parseCircuitInput(body)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos del circuito.', fieldErrors: errors }, { status: 400 })
  }

  const record = existing as TouristCircuitRecord
  const spanishFields = circuitInputToSpanishFields(input)

  const contentChanged =
    record.name_es !== spanishFields.name_es ||
    (record.schedule_es || null) !== spanishFields.schedule_es ||
    (record.duration_es || null) !== spanishFields.duration_es ||
    (record.summary_es || null) !== spanishFields.summary_es ||
    (record.description_es || null) !== spanishFields.description_es ||
    JSON.stringify(record.highlights_es || []) !== JSON.stringify(spanishFields.highlights_es)

  const shouldTranslate =
    body.retranslate === true || (contentChanged && isAiTranslationConfigured()) || (!record.name_en && isAiTranslationConfigured())

  let translated = false
  let englishFields: Record<string, unknown> = {}
  if (shouldTranslate) {
    const result = await buildEnglishFields(input)
    translated = result.translated
    englishFields = result.fields
  }

  const { data, error } = await supabase
    .from('tourist_circuits')
    .update({
      ...spanishFields,
      ...(input.sortOrder !== null ? { sort_order: input.sortOrder } : {}),
      ...englishFields,
    })
    .eq('id', circuitId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data: data as TouristCircuitRecord, translated })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const circuitId = Number(id)
  if (!Number.isInteger(circuitId)) {
    return NextResponse.json({ error: 'Circuito inválido.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: existing, error: existingError } = await supabase
    .from('tourist_circuits')
    .select('id, slug')
    .eq('id', circuitId)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  const { count, error: countError } = await supabase
    .from('tourist_departures')
    .select('*', { count: 'exact', head: true })
    .eq('circuit_slug', existing.slug)

  if (countError) {
    return NextResponse.json({ error: 'No se pudo verificar las salidas del circuito.' }, { status: 500 })
  }

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: 'El circuito tiene salidas asociadas. Desactivalo en lugar de eliminarlo.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('tourist_circuits').delete().eq('id', circuitId)
  if (error) {
    return NextResponse.json({ error: 'No se pudo eliminar el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: circuitId } })
}
