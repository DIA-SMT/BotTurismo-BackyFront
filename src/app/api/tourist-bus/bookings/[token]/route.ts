import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import type { TouristBooking, TouristDeparture } from '@/lib/tourist-bus'
import { sendTouristBookingCancelledEmail } from '@/lib/tourist-booking-email'
import { sendTouristBookingCancelledWhatsApp } from '@/lib/tourist-whatsapp'

export const runtime = 'nodejs'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findBookingByToken(token: string) {
  const sql = getSql()
  const [booking] = await sql<TouristBooking[]>`
    select * from tourist_bookings where cancel_token = ${token}
  `.catch(() => [] as TouristBooking[])

  if (!booking) return { booking: null, departure: null }

  const [departure] = await sql<TouristDeparture[]>`
    select * from tourist_departures where id = ${booking.departure_id}
  `.catch((error) => {
    console.error('No se pudo leer la salida de la reserva:', error)
    return [] as TouristDeparture[]
  })

  return { booking, departure: departure ?? null }
}

// La baja autogestionada se acepta hasta 24 horas antes de la salida, para que
// el lugar liberado todavía pueda ser reservado por otra persona.
const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000

function departureDateTimeMs(departure: TouristDeparture) {
  // Las salidas se cargan en hora de Argentina (UTC-3, sin horario de verano).
  // La hora puede venir de la base como HH:MM o HH:MM:SS.
  const time = departure.departure_time.slice(0, 5)
  return new Date(`${departure.departure_date}T${time}:00-03:00`).getTime()
}

function canCancel(booking: TouristBooking, departure: TouristDeparture | null) {
  if (!departure) return false
  if (booking.status !== 'confirmed') return false
  if (departure.status !== 'active') return false
  return departureDateTimeMs(departure) - Date.now() >= CANCEL_WINDOW_MS
}

export async function GET(_: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (!uuidRegex.test(token)) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  const { booking, departure } = await findBookingByToken(token)
  if (!booking || !departure) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      fullName: booking.full_name,
      peopleCount: booking.people_count,
      municipalBikes: booking.municipal_bikes || 0,
      status: booking.status,
      language: booking.language,
      departure: {
        title: departure.title,
        circuitSlug: departure.circuit_slug,
        date: departure.departure_date,
        time: departure.departure_time,
        meetingPoint: departure.meeting_point,
        status: departure.status,
      },
      canCancel: canCancel(booking, departure),
    },
  })
}

export async function POST(_: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (!uuidRegex.test(token)) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  const { booking, departure } = await findBookingByToken(token)
  if (!booking || !departure) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  if (!canCancel(booking, departure)) {
    return NextResponse.json(
      { error: 'Esta reserva ya no se puede cancelar: las bajas se aceptan hasta 24 horas antes de la salida.' },
      { status: 409 },
    )
  }

  const sql = getSql()
  // Sin fila (ya no estaba confirmada) o error de la base: mismo 500.
  const [updated] = await sql<TouristBooking[]>`
    update tourist_bookings set status = ${'cancelled'}
    where id = ${booking.id} and status = ${'confirmed'}
    returning *
  `.catch(() => [] as TouristBooking[])

  if (!updated) {
    return NextResponse.json({ error: 'No se pudo cancelar la reserva. Intentá de nuevo.' }, { status: 500 })
  }

  const input = { booking: updated, departure }
  const [emailSent, whatsappSent] = await Promise.all([
    sendTouristBookingCancelledEmail(input),
    sendTouristBookingCancelledWhatsApp(input),
  ])

  return NextResponse.json({ data: { cancelled: true, emailSent, whatsappSent } })
}
