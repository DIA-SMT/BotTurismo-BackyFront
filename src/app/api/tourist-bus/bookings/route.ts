import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import {
  toTouristBookingRpcParams,
  validateTouristBookingForm,
  type TouristBooking,
  type TouristBookingApiErrorCode,
  type TouristBookingFormData,
  type TouristDeparture,
  type TouristLanguage,
} from '@/lib/tourist-bus'
import { isBookingEmailConfigured, sendTouristBookingConfirmationEmail } from '@/lib/tourist-booking-email'
import { isBookingWhatsAppConfigured, sendTouristBookingConfirmationWhatsApp } from '@/lib/tourist-whatsapp'

export const runtime = 'nodejs'

const errorStatusByCode: Record<Exclude<TouristBookingApiErrorCode, 'VALIDATION' | 'SERVER'>, number> = {
  NOT_FOUND: 404,
  CANCELLED: 409,
  PAST: 409,
  NO_CAPACITY: 409,
  NO_BIKES: 409,
  INVALID_BIKES: 400,
  INVALID_PEOPLE_COUNT: 400,
}

function mapPayloadToFormData(payload: Record<string, unknown>): TouristBookingFormData {
  return {
    departureId: String(payload.departureId ?? ''),
    fullName: String(payload.fullName ?? ''),
    email: String(payload.email ?? ''),
    phone: String(payload.phone ?? ''),
    originCity: String(payload.originCity ?? ''),
    peopleCount: String(payload.peopleCount ?? ''),
    municipalBikes: String(payload.municipalBikes ?? '0'),
  }
}

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ code: 'VALIDATION', error: 'Solicitud inválida.' }, { status: 400 })
  }

  const formData = mapPayloadToFormData(payload)
  const language: TouristLanguage = payload.language === 'en' ? 'en' : 'es'
  const fieldErrors = validateTouristBookingForm(formData, { bikesEnabled: true })

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { code: 'VALIDATION', error: 'Revisá los campos obligatorios.', fieldErrors },
      { status: 400 },
    )
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_tourist_booking', toTouristBookingRpcParams(formData, language))

  if (error) {
    return NextResponse.json({ code: 'SERVER', error: 'No se pudo registrar la reserva.' }, { status: 500 })
  }

  const result = data as { ok: boolean; code?: TouristBookingApiErrorCode; remaining?: number; booking?: unknown } | null

  if (!result || typeof result.ok !== 'boolean') {
    return NextResponse.json({ code: 'SERVER', error: 'No se pudo registrar la reserva.' }, { status: 500 })
  }

  if (!result.ok) {
    const code = (result.code || 'SERVER') as TouristBookingApiErrorCode
    const status = code in errorStatusByCode ? errorStatusByCode[code as keyof typeof errorStatusByCode] : 500
    return NextResponse.json(
      { code, error: 'No se pudo registrar la reserva.', remaining: result.remaining ?? null },
      { status },
    )
  }

  // Avisos de confirmación (mail y WhatsApp): se intentan después de asegurar
  // la reserva y nunca la bloquean (si fallan o falta config, quedan en false).
  let emailSent = false
  let whatsappSent = false
  if ((isBookingEmailConfigured() || isBookingWhatsAppConfigured()) && result.booking) {
    const { data: departure } = await supabase
      .from('tourist_departures')
      .select('*')
      .eq('id', Number(formData.departureId))
      .single()

    if (departure) {
      const input = {
        booking: result.booking as TouristBooking,
        departure: departure as TouristDeparture,
      }
      ;[emailSent, whatsappSent] = await Promise.all([
        sendTouristBookingConfirmationEmail(input),
        sendTouristBookingConfirmationWhatsApp(input),
      ])
    }
  }

  return NextResponse.json(
    { data: { booking: result.booking, remaining: result.remaining ?? null, emailSent, whatsappSent } },
    { status: 201 },
  )
}
