import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { TouristBooking, TouristDeparture } from '@/lib/tourist-bus'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const bookingId = Number(id)
  if (!Number.isInteger(bookingId)) {
    return NextResponse.json({ error: 'Reserva inválida.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const status = String(body.status || '')
  if (status !== 'confirmed' && status !== 'cancelled') {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: booking, error: bookingError } = await supabase
    .from('tourist_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  const currentBooking = booking as TouristBooking

  // Al reconfirmar una reserva cancelada hay que verificar que siga habiendo cupo.
  if (status === 'confirmed' && currentBooking.status !== 'confirmed') {
    const [{ data: departure, error: departureError }, { data: confirmedBookings, error: confirmedError }] =
      await Promise.all([
        supabase.from('tourist_departures').select('*').eq('id', currentBooking.departure_id).single(),
        supabase
          .from('tourist_bookings')
          .select('people_count')
          .eq('departure_id', currentBooking.departure_id)
          .eq('status', 'confirmed'),
      ])

    if (departureError || !departure || confirmedError) {
      return NextResponse.json({ error: 'No se pudo verificar el cupo de la salida.' }, { status: 500 })
    }

    const reserved = (confirmedBookings || []).reduce((total, row) => total + Number(row.people_count || 0), 0)
    if (reserved + currentBooking.people_count > (departure as TouristDeparture).capacity) {
      return NextResponse.json({ error: 'No hay cupo suficiente para reconfirmar esta reserva.' }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('tourist_bookings')
    .update({ status })
    .eq('id', bookingId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo actualizar la reserva.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
