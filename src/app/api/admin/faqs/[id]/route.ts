import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, pickColumns, rowValues } from '@/lib/db'

// Columnas de faqs que el panel puede editar.
const FAQ_EDITABLE_COLUMNS = ['pregunta', 'respuesta', 'categoria', 'activo', 'orden'] as const

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const payload = await request.json()
  const changes = payload && typeof payload === 'object' ? pickColumns(payload, FAQ_EDITABLE_COLUMNS) : {}

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: 'No se pudo actualizar la pregunta frecuente.' }, { status: 500 })
  }

  const sql = getSql()
  const [data] = await sql`
    update faqs set ${rowValues(sql, changes)} where id = ${Number(id)} returning *
  `.catch(() => [])

  if (!data) {
    return NextResponse.json({ error: 'No se pudo actualizar la pregunta frecuente.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const sql = getSql()
  try {
    await sql`delete from faqs where id = ${Number(id)}`
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar la pregunta frecuente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
