import {
  formatDepartureDate,
  formatDepartureTime,
  type TouristBooking,
  type TouristDeparture,
  type TouristLanguage,
} from '@/lib/tourist-bus'
import { getTouristCircuitName } from '@/lib/tourist-circuits'

// Avisos por WhatsApp desde "Migue Turista" (Cloud API de Meta). Meta solo
// permite iniciar una conversación con PLANTILLAS aprobadas, por eso acá se
// envían las plantillas reserva_confirmada / reserva_baja / salida_cancelada.
// Igual que con los mails: si falta configuración o el envío falla, la
// operación principal sigue y se devuelve false.
//
// ⏸ EN PAUSA (decisión de la dirección, 2026-09-01): por ahora los avisos van
// SOLO por mail. Los mensajes iniciados por la empresa requieren facturación
// en Meta (tarjeta de la muni, pendiente de aprobación del jefe). Cuando se
// acuerde, activar seteando WHATSAPP_NOTIFICATIONS_ENABLED=true en Vercel
// (las plantillas ya están aprobadas en la WABA y esta lógica está probada).
//   WHATSAPP_NOTIFICATIONS_ENABLED -> 'true' para encender los avisos
//   WHATSAPP_TOKEN                 -> token del usuario del sistema (mismo del bot)
//   WHATSAPP_PHONE_NUMBER_ID       -> id del número de Migue

export function isBookingWhatsAppConfigured() {
  return Boolean(
    process.env.WHATSAPP_NOTIFICATIONS_ENABLED === 'true' &&
      process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID,
  )
}

// Normaliza teléfonos como los cargan los turistas ("381 467-6561",
// "+54 9 381...", "0381 15...") al formato internacional que espera Meta.
export function normalizeWhatsAppPhone(rawPhone: string): string | null {
  let digits = String(rawPhone || '').replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.startsWith('54')) {
    // Móviles argentinos: internacional con 9 después del 54.
    const rest = digits.slice(2)
    return `54${rest.startsWith('9') ? rest : `9${rest}`}`
  }

  // Prefijo de larga distancia nacional.
  if (digits.startsWith('0')) digits = digits.slice(1)

  // "15" después del área (ej: 381 15 4676561) no va en el formato internacional.
  if (digits.length === 12 && digits.slice(3, 5) === '15') {
    digits = digits.slice(0, 3) + digits.slice(5)
  }

  // Número argentino típico: área + línea (10 dígitos).
  if (digits.length === 10) return `549${digits}`

  // Número que ya parece internacional (turista extranjero).
  if (digits.length >= 11 && digits.length <= 15) return digits

  return null
}

async function sendWhatsAppTemplate(
  toPhone: string,
  templateName: string,
  language: TouristLanguage,
  parameters: string[],
): Promise<boolean> {
  if (!isBookingWhatsAppConfigured()) return false

  const to = normalizeWhatsAppPhone(toPhone)
  if (!to) return false

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language === 'en' ? 'en_US' : 'es_AR' },
            components: [
              {
                type: 'body',
                // Los parámetros de plantilla no admiten saltos de línea ni
                // varios espacios seguidos.
                parameters: parameters.map((text) => ({
                  type: 'text',
                  text: text.replace(/\s+/g, ' ').trim().slice(0, 500) || '-',
                })),
              },
            ],
          },
        }),
      },
    )

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      console.error(`No se pudo enviar WhatsApp (${templateName}):`, body?.error?.message || response.status)
      return false
    }
    return true
  } catch (error) {
    console.error(`No se pudo enviar WhatsApp (${templateName}):`, error)
    return false
  }
}

interface BookingWhatsAppInput {
  booking: TouristBooking
  departure: TouristDeparture
}

function commonParams({ booking, departure }: BookingWhatsAppInput) {
  const language: TouristLanguage = booking.language === 'en' ? 'en' : 'es'
  const title = getTouristCircuitName(departure.circuit_slug, language) || departure.title
  return {
    language,
    firstName: booking.full_name.trim().split(/\s+/)[0] || booking.full_name,
    title,
    dateLabel: formatDepartureDate(departure.departure_date, language),
    timeLabel: formatDepartureTime(departure.departure_time),
  }
}

export async function sendTouristBookingConfirmationWhatsApp(input: BookingWhatsAppInput): Promise<boolean> {
  const { language, firstName, title, dateLabel, timeLabel } = commonParams(input)
  const meetingPoint =
    input.departure.meeting_point || (language === 'en' ? 'to be confirmed' : 'a confirmar')
  return sendWhatsAppTemplate(input.booking.phone, 'reserva_confirmada', language, [
    firstName,
    title,
    dateLabel,
    timeLabel,
    meetingPoint,
  ])
}

export async function sendTouristBookingCancelledWhatsApp(input: BookingWhatsAppInput): Promise<boolean> {
  const { language, firstName, title, dateLabel, timeLabel } = commonParams(input)
  return sendWhatsAppTemplate(input.booking.phone, 'reserva_baja', language, [
    firstName,
    title,
    dateLabel,
    timeLabel,
  ])
}

export async function sendTouristDepartureCancellationWhatsApps(
  bookings: TouristBooking[],
  departure: TouristDeparture,
  reason?: string,
): Promise<{ sent: number; failed: number }> {
  if (!isBookingWhatsAppConfigured() || bookings.length === 0) return { sent: 0, failed: 0 }

  const results = await Promise.allSettled(
    bookings.map((booking) => {
      const { language, firstName, title, dateLabel, timeLabel } = commonParams({ booking, departure })
      const reasonText = reason || (language === 'en' ? 'operational reasons' : 'motivos operativos')
      return sendWhatsAppTemplate(booking.phone, 'salida_cancelada', language, [
        firstName,
        title,
        dateLabel,
        timeLabel,
        reasonText,
      ]).then((ok) => {
        if (!ok) throw new Error('send failed')
      })
    }),
  )

  const sent = results.filter((result) => result.status === 'fulfilled').length
  return { sent, failed: results.length - sent }
}
