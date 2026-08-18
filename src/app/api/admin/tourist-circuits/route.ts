import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { fetchTouristCircuitRecords } from '@/lib/tourist-circuits-server'
import type { TouristCircuitRecord } from '@/lib/tourist-circuits'
import {
  buildEnglishFields,
  circuitInputToSpanishFields,
  parseCircuitInput,
  slugifyCircuitName,
} from '@/lib/tourist-circuits-admin'
import { isAiTranslationConfigured } from '@/lib/ai-translate'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  try {
    const records = await fetchTouristCircuitRecords(supabase)
    return NextResponse.json({ data: records, aiConfigured: isAiTranslationConfigured() })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener el catálogo. ¿Se corrió la migración supabase_admin_selfservice_migration.sql?' },
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

  const { input, errors } = parseCircuitInput(body)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos del circuito.', fieldErrors: errors }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const baseSlug = slugifyCircuitName(input.name)
  let slug = baseSlug
  for (let attempt = 2; attempt <= 20; attempt += 1) {
    const { data: existing } = await supabase.from('tourist_circuits').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${attempt}`
  }

  const { translated, fields: englishFields } = await buildEnglishFields(input)

  const { data, error } = await supabase
    .from('tourist_circuits')
    .insert({
      slug,
      sort_order: input.sortOrder ?? 1000,
      ...circuitInputToSpanishFields(input),
      ...englishFields,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo crear el circuito.' }, { status: 500 })
  }

  return NextResponse.json(
    { data: data as TouristCircuitRecord, translated, aiConfigured: isAiTranslationConfigured() },
    { status: 201 },
  )
}
