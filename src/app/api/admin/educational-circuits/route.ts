import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { fetchEducationalCircuitRecords } from '@/lib/educational-circuits-server'
import { parseEducationalCircuitInput, slugifyEducationalCircuitName } from '@/lib/educational-circuits-admin'
import type { EducationalCircuitRecord } from '@/lib/educational-circuits'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const records = await fetchEducationalCircuitRecords()
    return NextResponse.json({ data: records })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener el catálogo educativo. ¿Se corrió la migración supabase_admin_selfservice_migration.sql?' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const { input, errors } = parseEducationalCircuitInput(body)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos del circuito.', fieldErrors: errors }, { status: 400 })
  }

  const sql = getSql()

  const baseSlug = slugifyEducationalCircuitName(input.name)
  let slug = baseSlug
  for (let attempt = 2; attempt <= 20; attempt += 1) {
    const [existing] = await sql`select id from educational_circuits where slug = ${slug}`.catch((error) => {
      console.error('No se pudo verificar el slug del circuito educativo', error)
      return []
    })
    if (!existing) break
    slug = `${baseSlug}_${attempt}`
  }

  let data: EducationalCircuitRecord
  try {
    ;[data] = await sql<EducationalCircuitRecord[]>`
      insert into educational_circuits ${rowValues(sql, {
        slug,
        name: input.name,
        summary: input.summary || null,
        paragraphs: input.paragraphs,
        availability: input.availability,
        active: input.active,
        sort_order: input.sortOrder ?? 1000,
      })}
      returning *
    `
  } catch {
    return NextResponse.json({ error: 'No se pudo crear el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
