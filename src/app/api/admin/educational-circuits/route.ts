import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { fetchEducationalCircuitRecords } from '@/lib/educational-circuits-server'
import { parseEducationalCircuitInput, slugifyEducationalCircuitName } from '@/lib/educational-circuits-admin'
import type { EducationalCircuitRecord } from '@/lib/educational-circuits'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  try {
    const records = await fetchEducationalCircuitRecords(supabase)
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

  const supabase = createServerSupabaseClient()

  const baseSlug = slugifyEducationalCircuitName(input.name)
  let slug = baseSlug
  for (let attempt = 2; attempt <= 20; attempt += 1) {
    const { data: existing } = await supabase.from('educational_circuits').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${baseSlug}_${attempt}`
  }

  const { data, error } = await supabase
    .from('educational_circuits')
    .insert({
      slug,
      name: input.name,
      summary: input.summary || null,
      paragraphs: input.paragraphs,
      availability: input.availability,
      active: input.active,
      sort_order: input.sortOrder ?? 1000,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo crear el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data: data as EducationalCircuitRecord }, { status: 201 })
}
