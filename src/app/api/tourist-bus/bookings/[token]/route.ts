import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { TouristBooking, TouristDeparture } from '@/lib/tourist-bus'
import { sendTouristBookingCancelledEmail } from '@/lib/tourist-booking-email'
import { sendTouristBookingCancelledWhatsApp } from '@/lib/tourist-whatsapp'

export const runtime = 'nodejs'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findBookingByToken(token: string) {
  const supabase = createServerSupabaseClient()
  const { data: booking, error } = await supabase
    .from('tourist_bookings')
    .select('*')
    .eq('cancel_token', token)
    .maybeSingle()

  if (error || !booking) return { supabase, booking: null, departure: null }

  const { data: departure } = await supabase
    .from('tourist_departures')
    .select('*')
    .eq('id', booking.departure_id)
    .maybeSingle()

  return { supabase, booking: booking as TouristBooking, departure: (departure as TouristDeparture) || null }
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

  const { supabase, booking, departure } = await findBookingByToken(token)
  if (!booking || !departure) {
    return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  }

  if (!canCancel(booking, departure)) {
    return NextResponse.json(
      { error: 'Esta reserva ya no se puede cancelar: las bajas se aceptan hasta 24 horas antes de la salida.' },
      { status: 409 },
    )
  }

  const { data: updated, error } = await supabase
    .from('tourist_bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking.id)
    .eq('status', 'confirmed')
    .select('*')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'No se pudo cancelar la reserva. Intentá de nuevo.' }, { status: 500 })
  }

  const input = { booking: updated as TouristBooking, departure }
  const [emailSent, whatsappSent] = await Promise.all([
    sendTouristBookingCancelledEmail(input),
    sendTouristBookingCancelledWhatsApp(input),
  ])

  return NextResponse.json({ data: { cancelled: true, emailSent, whatsappSent } })
}
