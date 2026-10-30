import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
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

  const sql = getSql()
  const [existing] = await sql<TouristCircuitRecord[]>`
    select * from tourist_circuits where id = ${circuitId}
  `.catch(() => [] as TouristCircuitRecord[])

  if (!existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  // Cambio rápido de estado (activar/desactivar) sin tocar el contenido.
  if (body.toggleActive === true) {
    const [data] = await sql<TouristCircuitRecord[]>`
      update tourist_circuits set active = ${!existing.active} where id = ${circuitId} returning *
    `.catch(() => [] as TouristCircuitRecord[])

    if (!data) {
      return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
    }
    return NextResponse.json({ data, translated: false })
  }

  const { input, errors } = parseCircuitInput(body)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos del circuito.', fieldErrors: errors }, { status: 400 })
  }

  const record = existing
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

  const [data] = await sql<TouristCircuitRecord[]>`
    update tourist_circuits set ${rowValues(sql, {
      ...spanishFields,
      ...(input.sortOrder !== null ? { sort_order: input.sortOrder } : {}),
      ...englishFields,
    })}
    where id = ${circuitId}
    returning *
  `.catch(() => [] as TouristCircuitRecord[])

  if (!data) {
    return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
  }

  // Las salidas guardan una copia del nombre (title) de cuando se crearon: al
  // renombrar el circuito hay que propagar el nombre nuevo, si no el panel de
  // salidas, los exports y los mails siguen mostrando el nombre viejo.
  if (record.name_es !== spanishFields.name_es) {
    try {
      await sql`update tourist_departures set title = ${spanishFields.name_es} where circuit_slug = ${record.slug}`
    } catch (renameError) {
      console.error(
        'No se pudo propagar el nombre nuevo a las salidas:',
        renameError instanceof Error ? renameError.message : renameError,
      )
    }
  }

  return NextResponse.json({ data, translated })
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

  const sql = getSql()
  const [existing] = await sql<{ id: number; slug: string }[]>`
    select id, slug from tourist_circuits where id = ${circuitId}
  `.catch(() => [] as { id: number; slug: string }[])

  if (!existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  let count: number
  try {
    ;[{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from tourist_departures where circuit_slug = ${existing.slug}
    `
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar las salidas del circuito.' }, { status: 500 })
  }

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: 'El circuito tiene salidas asociadas. Desactivalo en lugar de eliminarlo.' },
      { status: 409 },
    )
  }

  try {
    await sql`delete from tourist_circuits where id = ${circuitId}`
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: circuitId } })
}
