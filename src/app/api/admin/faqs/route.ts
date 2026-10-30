import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const sql = getSql()
  try {
    const data = await sql`select * from faqs order by categoria asc, orden asc, id asc`
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las preguntas frecuentes.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const payload = await request.json()
  const sql = getSql()
  try {
    const [data] = await sql`
      insert into faqs ${rowValues(sql, {
        pregunta: payload.pregunta,
        respuesta: payload.respuesta,
        categoria: payload.categoria,
        activo: payload.activo ?? true,
        orden: payload.orden ?? 0,
      })}
      returning *
    `
    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'No se pudo crear la pregunta frecuente.' }, { status: 500 })
  }
}
