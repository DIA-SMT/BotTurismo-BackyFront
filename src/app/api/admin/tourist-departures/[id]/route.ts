import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { parseBusinessDateParts } from '@/lib/educational-bus-requests'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const departureId = Number(id)
  if (!Number.isInteger(departureId)) {
    return NextResponse.json({ error: 'Salida inválida.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const updatePayload: Record<string, string | number | null> = {}

  if (body.status !== undefined) {
    const status = String(body.status)
    if (status !== 'active' && status !== 'cancelled') {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    }
    updatePayload.status = status
  }

  if (body.capacity !== undefined) {
    const capacity = Number(body.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      return NextResponse.json({ error: 'El cupo debe ser un número entre 1 y 500.' }, { status: 400 })
    }
    updatePayload.capacity = capacity
  }

  if (body.departureDate !== undefined) {
    const departureDate = String(body.departureDate).trim()
    if (!parseBusinessDateParts(departureDate)) {
      return NextResponse.json({ error: 'Ingresá una fecha válida.' }, { status: 400 })
    }
    updatePayload.departure_date = departureDate
  }

  if (body.departureTime !== undefined) {
    const departureTime = String(body.departureTime).trim()
    if (!timeRegex.test(departureTime)) {
      return NextResponse.json({ error: 'Ingresá una hora válida (HH:MM).' }, { status: 400 })
    }
    updatePayload.departure_time = departureTime
  }

  if (body.meetingPoint !== undefined) {
    updatePayload.meeting_point = String(body.meetingPoint).trim() || null
  }

  if (body.notes !== undefined) {
    updatePayload.notes = String(body.notes).trim() || null
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('tourist_departures')
    .update(updatePayload)
    .eq('id', departureId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo actualizar la salida.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const departureId = Number(id)
  if (!Number.isInteger(departureId)) {
    return NextResponse.json({ error: 'Salida inválida.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const { count, error: countError } = await supabase
    .from('tourist_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('departure_id', departureId)
    .eq('status', 'confirmed')

  if (countError) {
    return NextResponse.json({ error: 'No se pudo verificar las reservas de la salida.' }, { status: 500 })
  }

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: 'La salida tiene reservas confirmadas. Cancelala en lugar de eliminarla.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('tourist_departures').delete().eq('id', departureId)

  if (error) {
    return NextResponse.json({ error: 'No se pudo eliminar la salida.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: departureId } })
}
