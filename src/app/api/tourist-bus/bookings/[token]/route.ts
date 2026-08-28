import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { getTodayDateStringInBuenosAires } from '@/lib/educational-bus-requests'
import type { TouristBooking, TouristDeparture } from '@/lib/tourist-bus'
import { sendTouristBookingCancelledEmail } from '@/lib/tourist-booking-email'

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

function canCancel(booking: TouristBooking, departure: TouristDeparture | null) {
  if (!departure) return false
  if (booking.status !== 'confirmed') return false
  if (departure.status !== 'active') return false
  return departure.departure_date >= getTodayDateStringInBuenosAires()
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
      { error: 'Esta reserva ya no se puede cancelar (ya está cancelada o la salida ya pasó).' },
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

  const emailSent = await sendTouristBookingCancelledEmail({
    booking: updated as TouristBooking,
    departure,
  })

  return NextResponse.json({ data: { cancelled: true, emailSent } })
}
