import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql } from '@/lib/db'
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

  const sql = getSql()
  const [currentBooking] = await sql<TouristBooking[]>`
    select * from tourist_bookings where id = ${bookingId}
  `.catch(() => [] as TouristBooking[])

  if (!currentBooking) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  // Al reconfirmar una reserva cancelada hay que verificar que siga habiendo cupo.
  if (status === 'confirmed' && currentBooking.status !== 'confirmed') {
    let departure: TouristDeparture | undefined
    let confirmedBookings: Pick<TouristBooking, 'people_count'>[]
    try {
      ;[[departure], confirmedBookings] = await Promise.all([
        sql<TouristDeparture[]>`select * from tourist_departures where id = ${currentBooking.departure_id}`,
        sql<Pick<TouristBooking, 'people_count'>[]>`
          select people_count from tourist_bookings
          where departure_id = ${currentBooking.departure_id} and status = ${'confirmed'}
        `,
      ])
    } catch {
      return NextResponse.json({ error: 'No se pudo verificar el cupo de la salida.' }, { status: 500 })
    }

    if (!departure) {
      return NextResponse.json({ error: 'No se pudo verificar el cupo de la salida.' }, { status: 500 })
    }

    const reserved = confirmedBookings.reduce((total, row) => total + Number(row.people_count || 0), 0)
    if (reserved + currentBooking.people_count > departure.capacity) {
      return NextResponse.json({ error: 'No hay cupo suficiente para reconfirmar esta reserva.' }, { status: 409 })
    }
  }

  const [data] = await sql<TouristBooking[]>`
    update tourist_bookings set status = ${status} where id = ${bookingId} returning *
  `.catch(() => [] as TouristBooking[])

  if (!data) {
    return NextResponse.json({ error: 'No se pudo actualizar la reserva.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
