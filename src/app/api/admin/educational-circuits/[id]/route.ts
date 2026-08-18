import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
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

  const supabase = createServerSupabaseClient()
  const { data: existing, error: existingError } = await supabase
    .from('educational_circuits')
    .select('*')
    .eq('id', circuitId)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  if (body.toggleActive === true) {
    const { data, error } = await supabase
      .from('educational_circuits')
      .update({ active: !(existing as EducationalCircuitRecord).active })
      .eq('id', circuitId)
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  const { input, errors } = parseEducationalCircuitInput(body)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos del circuito.', fieldErrors: errors }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('educational_circuits')
    .update({
      name: input.name,
      summary: input.summary || null,
      paragraphs: input.paragraphs,
      availability: input.availability,
      ...(input.sortOrder !== null ? { sort_order: input.sortOrder } : {}),
    })
    .eq('id', circuitId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo actualizar el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data: data as EducationalCircuitRecord })
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
    .from('educational_circuits')
    .select('id, slug')
    .eq('id', circuitId)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Circuito no encontrado.' }, { status: 404 })
  }

  const { count, error: countError } = await supabase
    .from('educational_bus_requests')
    .select('*', { count: 'exact', head: true })
    .eq('circuit', existing.slug)

  if (countError) {
    return NextResponse.json({ error: 'No se pudieron verificar las solicitudes del circuito.' }, { status: 500 })
  }

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: 'El circuito tiene solicitudes asociadas. Desactivalo en lugar de eliminarlo.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('educational_circuits').delete().eq('id', circuitId)
  if (error) {
    return NextResponse.json({ error: 'No se pudo eliminar el circuito.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: circuitId } })
}
