import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { parseEducationalCircuitInput } from '@/lib/educational-circuits-admin'
import type { EducationalCircuitRecord } from '@/lib/educational-circuits'

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
  const [existing] = await sql<EducationalCircuitRecord[]>`
    select * from educational_circuits where id = ${circuitId}
  `.catch(() => [])

  if (!existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  if (body.toggleActive === true) {
    const [data] = await sql<EducationalCircuitRecord[]>`
      update educational_circuits set active = ${!existing.active} where id = ${circuitId} returning *
    `.catch(() => [])

    if (!data) {
      return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  const { input, errors } = parseEducationalCircuitInput(body)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos del circuito.', fieldErrors: errors }, { status: 400 })
  }

  const [data] = await sql<EducationalCircuitRecord[]>`
    update educational_circuits set ${rowValues(sql, {
      name: input.name,
      summary: input.summary || null,
      paragraphs: input.paragraphs,
      availability: input.availability,
      ...(input.sortOrder !== null ? { sort_order: input.sortOrder } : {}),
    })}
    where id = ${circuitId}
    returning *
  `.catch(() => [])

  if (!data) {
    return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data })
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
    select id, slug from educational_circuits where id = ${circuitId}
  `.catch(() => [])

  if (!existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  let count: number
  try {
    ;[{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from educational_bus_requests where circuit = ${existing.slug}
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron verificar las solicitudes del circuito.' }, { status: 500 })
  }

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: 'El circuito tiene solicitudes asociadas. Desactivalo en lugar de eliminarlo.' },
      { status: 409 },
    )
  }

  try {
    await sql`delete from educational_circuits where id = ${circuitId}`
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: circuitId } })
}
