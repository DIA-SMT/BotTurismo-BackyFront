import nodemailer from 'nodemailer'
import {
  formatDepartureDate,
  formatDepartureTime,
  type TouristBooking,
  type TouristDeparture,
  type TouristLanguage,
} from '@/lib/tourist-bus'
import { getTouristCircuitName, touristOfficeInfo } from '@/lib/tourist-circuits'

// El envío se configura por variables de entorno. Si faltan, la reserva
// funciona igual y simplemente no se manda el correo.
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  -> credenciales del servidor
//   SMTP_FROM      (opcional) remitente, ej: "Bus Turístico SMT <turismo@smt.gob.ar>"
//   SMTP_SECURE    (opcional) "true" para TLS directo (puerto 465)
//   SMTP_REPLY_TO  (opcional) casilla que recibe las respuestas

export function isBookingEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS)
}

const publicSiteUrl = () => process.env.PUBLIC_SITE_URL || 'https://busturistico.smt.gob.ar'

interface BookingEmailCopy {
  subject: (title: string) => string
  greeting: (name: string) => string
  intro: string
  circuitLabel: string
  dateLabel: string
  timeLabel: string
  meetingPointLabel: string
  peopleLabel: string
  bikesLabel: string
  arriveEarly: string
  notesLabel: string
  cancelInfo: string
  cancelLinkLabel: string
  officeTitle: string
  farewell: string
}

const bookingEmailCopy: Record<TouristLanguage, BookingEmailCopy> = {
  es: {
    subject: (title) => `Reserva confirmada · ${title}`,
    greeting: (name) => `¡Hola, ${name}!`,
    intro: 'Tu reserva para el Bus Turístico de San Miguel de Tucumán quedó confirmada. Estos son los detalles:',
    circuitLabel: 'Circuito',
    dateLabel: 'Fecha',
    timeLabel: 'Hora de salida',
    meetingPointLabel: 'Punto de encuentro',
    peopleLabel: 'Personas',
    bikesLabel: 'Bicicletas municipales reservadas',
    arriveEarly: 'Presentate 10 minutos antes de la salida.',
    notesLabel: 'Tené en cuenta',
    cancelInfo:
      'Si no podés asistir, cancelá tu reserva con el botón de abajo así liberamos tu lugar para otra persona.',
    cancelLinkLabel: 'Cancelar mi reserva',
    officeTitle: 'Oficina de Informes Turísticos',
    farewell: '¡Te esperamos para recorrer la ciudad!',
  },
  en: {
    subject: (title) => `Booking confirmed · ${title}`,
    greeting: (name) => `Hi ${name}!`,
    intro: 'Your booking for the San Miguel de Tucumán Tourist Bus is confirmed. Here are the details:',
    circuitLabel: 'Circuit',
    dateLabel: 'Date',
    timeLabel: 'Departure time',
    meetingPointLabel: 'Meeting point',
    peopleLabel: 'People',
    bikesLabel: 'Municipal bikes reserved',
    arriveEarly: 'Please arrive 10 minutes before departure.',
    notesLabel: 'Keep in mind',
    cancelInfo: 'If you can’t make it, cancel your booking with the button below so we can free up your seat.',
    cancelLinkLabel: 'Cancel my booking',
    officeTitle: 'Tourist Information Office',
    farewell: 'We look forward to showing you the city!',
  },
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface BookingEmailInput {
  booking: TouristBooking
  departure: TouristDeparture
}

function buildBookingEmailContent({ booking, departure }: BookingEmailInput) {
  const language: TouristLanguage = booking.language === 'en' ? 'en' : 'es'
  const copy = bookingEmailCopy[language]
  const office = touristOfficeInfo[language]
  const title = getTouristCircuitName(departure.circuit_slug, language) || departure.title
  const dateLabel = formatDepartureDate(departure.departure_date, language)
  const timeLabel = `${formatDepartureTime(departure.departure_time)} h`

  const detailRows: Array<[string, string]> = [
    [copy.circuitLabel, title],
    [copy.dateLabel, dateLabel],
    [copy.timeLabel, timeLabel],
  ]
  if (departure.meeting_point) detailRows.push([copy.meetingPointLabel, departure.meeting_point])
  detailRows.push([copy.peopleLabel, String(booking.people_count)])
  if (booking.municipal_bikes > 0) detailRows.push([copy.bikesLabel, String(booking.municipal_bikes)])

  const cancelUrl = booking.cancel_token ? `${publicSiteUrl()}/reserva/${booking.cancel_token}` : null

  const textLines = [
    copy.greeting(booking.full_name),
    '',
    copy.intro,
    '',
    ...detailRows.map(([label, value]) => `${label}: ${value}`),
    '',
    copy.arriveEarly,
    ...(departure.notes ? ['', `${copy.notesLabel}: ${departure.notes}`] : []),
    '',
    copy.cancelInfo,
    ...(cancelUrl ? [`${copy.cancelLinkLabel}: ${cancelUrl}`] : []),
    '',
    `${copy.officeTitle} · ${office.address}`,
    ...office.hours,
    '',
    copy.farewell,
  ]

  const detailRowsHtml = detailRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 14px 6px 0;color:#68737d;font-size:14px;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#1f2933;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')

  const html = `
  <div style="margin:0;padding:24px;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8ef;">
      <tr>
        <td style="background:#126ff5;padding:18px 26px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">San Miguel de Tucumán</div>
          <div style="font-size:20px;font-weight:bold;margin-top:2px;">Bus Turístico</div>
        </td>
      </tr>
      <tr>
        <td style="padding:26px;">
          <p style="margin:0 0 12px;font-size:16px;color:#1f2933;font-weight:bold;">${escapeHtml(copy.greeting(booking.full_name))}</p>
          <p style="margin:0 0 18px;font-size:14px;color:#1f2933;line-height:1.6;">${escapeHtml(copy.intro)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#eef6ff;border-radius:10px;padding:6px;border-collapse:separate;">
            <tr><td style="padding:12px 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0">${detailRowsHtml}</table>
            </td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:14px;color:#1f2933;font-weight:600;">${escapeHtml(copy.arriveEarly)}</p>
          ${departure.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#68737d;line-height:1.6;"><strong>${escapeHtml(copy.notesLabel)}:</strong> ${escapeHtml(departure.notes)}</p>` : ''}
          <p style="margin:18px 0 0;font-size:13px;color:#68737d;line-height:1.6;">${escapeHtml(copy.cancelInfo)}</p>
          ${cancelUrl ? `<p style="margin:12px 0 0;"><a href="${cancelUrl}" style="display:inline-block;background:#ffffff;border:1px solid #b42323;color:#b42323;font-size:13px;font-weight:bold;text-decoration:none;padding:9px 18px;border-radius:8px;">${escapeHtml(copy.cancelLinkLabel)}</a></p>` : ''}
          <p style="margin:18px 0 0;font-size:13px;color:#68737d;line-height:1.6;">
            <strong>${escapeHtml(copy.officeTitle)}</strong><br/>
            ${escapeHtml(office.address)}<br/>
            ${office.hours.map((line) => escapeHtml(line)).join('<br/>')}
          </p>
          <p style="margin:20px 0 0;font-size:14px;color:#126ff5;font-weight:bold;">${escapeHtml(copy.farewell)}</p>
        </td>
      </tr>
    </table>
  </div>`

  return {
    subject: copy.subject(title),
    text: textLines.join('\n'),
    html,
  }
}

function createBookingEmailTransporter() {
  const port = Number(process.env.SMTP_PORT)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
}

export async function sendTouristBookingConfirmationEmail(input: BookingEmailInput): Promise<boolean> {
  if (!isBookingEmailConfigured()) return false

  try {
    const transporter = createBookingEmailTransporter()
    const content = buildBookingEmailContent(input)
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: input.booking.email,
      replyTo: process.env.SMTP_REPLY_TO || undefined,
      subject: content.subject,
      text: content.text,
      html: content.html,
    })
    return true
  } catch (error) {
    // El correo nunca debe romper la reserva: se registra y se sigue.
    console.error('No se pudo enviar el mail de confirmación de reserva:', error)
    return false
  }
}

interface CancellationEmailCopy {
  subject: (title: string) => string
  greeting: (name: string) => string
  body: (title: string, dateLabel: string, timeLabel: string) => string
  reasonLabel: string
  next: string
  farewell: string
}

const cancellationEmailCopy: Record<TouristLanguage, CancellationEmailCopy> = {
  es: {
    subject: (title) => `Salida cancelada · ${title}`,
    greeting: (name) => `Hola, ${name}.`,
    body: (title, dateLabel, timeLabel) =>
      `Lamentamos avisarte que la salida "${title}" programada para el ${dateLabel} a las ${timeLabel} fue cancelada, por lo que tu reserva quedó sin efecto.`,
    reasonLabel: 'Motivo',
    next: 'Podés reservar otra salida desde la página del Bus Turístico o consultarnos escribiendo a turismo@smt.gob.ar. Disculpá las molestias.',
    farewell: '¡Esperamos verte pronto en otro recorrido!',
  },
  en: {
    subject: (title) => `Departure cancelled · ${title}`,
    greeting: (name) => `Hi ${name},`,
    body: (title, dateLabel, timeLabel) =>
      `We’re sorry to let you know that the departure "${title}" scheduled for ${dateLabel} at ${timeLabel} has been cancelled, so your booking is no longer valid.`,
    reasonLabel: 'Reason',
    next: 'You can book another departure on the Tourist Bus page or reach us at turismo@smt.gob.ar. We apologize for the inconvenience.',
    farewell: 'We hope to see you on another tour soon!',
  },
}

function buildCancellationEmailContent({ booking, departure }: BookingEmailInput, reason?: string) {
  const language: TouristLanguage = booking.language === 'en' ? 'en' : 'es'
  const copy = cancellationEmailCopy[language]
  const office = touristOfficeInfo[language]
  const title = getTouristCircuitName(departure.circuit_slug, language) || departure.title
  const dateLabel = formatDepartureDate(departure.departure_date, language)
  const timeLabel = `${formatDepartureTime(departure.departure_time)} h`
  const reasonText = reason ? `${copy.reasonLabel}: ${reason}` : ''
  const bodyText = copy.body(title, dateLabel, timeLabel)

  const text = [
    copy.greeting(booking.full_name),
    '',
    bodyText,
    ...(reasonText ? [reasonText] : []),
    '',
    copy.next,
    '',
    `${office.title} · ${office.address}`,
    ...office.hours,
    '',
    copy.farewell,
  ].join('\n')

  const html = `
  <div style="margin:0;padding:24px;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8ef;">
      <tr>
        <td style="background:#b42323;padding:18px 26px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">San Miguel de Tucumán</div>
          <div style="font-size:20px;font-weight:bold;margin-top:2px;">Bus Turístico</div>
        </td>
      </tr>
      <tr>
        <td style="padding:26px;">
          <p style="margin:0 0 12px;font-size:16px;color:#1f2933;font-weight:bold;">${escapeHtml(copy.greeting(booking.full_name))}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#1f2933;line-height:1.6;">${escapeHtml(bodyText)}</p>
          ${reasonText ? `<p style="margin:0 0 16px;font-size:14px;color:#1f2933;line-height:1.6;background:#FFF6E0;border:1px solid #EBD9A8;border-radius:8px;padding:10px 14px;"><strong>${escapeHtml(reasonText)}</strong></p>` : ''}
          <p style="margin:0 0 16px;font-size:13px;color:#68737d;line-height:1.6;">${escapeHtml(copy.next)}</p>
          <p style="margin:0;font-size:13px;color:#68737d;line-height:1.6;">
            <strong>${escapeHtml(office.title)}</strong><br/>
            ${escapeHtml(office.address)}<br/>
            ${office.hours.map((line) => escapeHtml(line)).join('<br/>')}
          </p>
          <p style="margin:20px 0 0;font-size:14px;color:#126ff5;font-weight:bold;">${escapeHtml(copy.farewell)}</p>
        </td>
      </tr>
    </table>
  </div>`

  return { subject: copy.subject(title), text, html }
}

// Aviso masivo al cancelar una salida. Envía en paralelo y nunca lanza:
// devuelve cuántos salieron y cuántos fallaron.
export async function sendTouristDepartureCancellationEmails(
  bookings: TouristBooking[],
  departure: TouristDeparture,
  reason?: string,
): Promise<{ sent: number; failed: number }> {
  if (!isBookingEmailConfigured() || bookings.length === 0) {
    return { sent: 0, failed: 0 }
  }

  try {
    const transporter = createBookingEmailTransporter()
    const results = await Promise.allSettled(
      bookings.map((booking) => {
        const content = buildCancellationEmailContent({ booking, departure }, reason)
        return transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: booking.email,
          replyTo: process.env.SMTP_REPLY_TO || undefined,
          subject: content.subject,
          text: content.text,
          html: content.html,
        })
      }),
    )

    const sent = results.filter((result) => result.status === 'fulfilled').length
    return { sent, failed: results.length - sent }
  } catch (error) {
    console.error('No se pudieron enviar los avisos de cancelación:', error)
    return { sent: 0, failed: bookings.length }
  }
}

// ── Mail de baja confirmada (el turista canceló su propia reserva) ──

const unsubscribeEmailCopy: Record<TouristLanguage, {
  subject: (title: string) => string
  greeting: (name: string) => string
  body: (title: string, dateLabel: string, timeLabel: string) => string
  next: string
  farewell: string
}> = {
  es: {
    subject: (title) => `Baja confirmada · ${title}`,
    greeting: (name) => `Hola, ${name}.`,
    body: (title, dateLabel, timeLabel) =>
      `Confirmamos la baja de tu reserva para "${title}" del ${dateLabel} a las ${timeLabel}. Tu lugar quedó liberado para otra persona.`,
    next: 'Cuando quieras volver a reservar, te esperamos en la página del Bus Turístico. ¡Gracias por avisar!',
    farewell: '¡Esperamos verte pronto en otro recorrido!',
  },
  en: {
    subject: (title) => `Cancellation confirmed · ${title}`,
    greeting: (name) => `Hi ${name},`,
    body: (title, dateLabel, timeLabel) =>
      `We confirm the cancellation of your booking for "${title}" on ${dateLabel} at ${timeLabel}. Your seat has been released.`,
    next: 'Whenever you want to book again, the Tourist Bus page is waiting for you. Thanks for letting us know!',
    farewell: 'We hope to see you on another tour soon!',
  },
}

export async function sendTouristBookingCancelledEmail(input: BookingEmailInput): Promise<boolean> {
  if (!isBookingEmailConfigured()) return false

  try {
    const { booking, departure } = input
    const language: TouristLanguage = booking.language === 'en' ? 'en' : 'es'
    const copy = unsubscribeEmailCopy[language]
    const title = getTouristCircuitName(departure.circuit_slug, language) || departure.title
    const dateLabel = formatDepartureDate(departure.departure_date, language)
    const timeLabel = `${formatDepartureTime(departure.departure_time)} h`
    const bodyText = copy.body(title, dateLabel, timeLabel)

    const text = [copy.greeting(booking.full_name), '', bodyText, '', copy.next, '', copy.farewell].join('\n')
    const html = `
  <div style="margin:0;padding:24px;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8ef;">
      <tr>
        <td style="background:#126ff5;padding:18px 26px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">San Miguel de Tucumán</div>
          <div style="font-size:20px;font-weight:bold;margin-top:2px;">Bus Turístico</div>
        </td>
      </tr>
      <tr>
        <td style="padding:26px;">
          <p style="margin:0 0 12px;font-size:16px;color:#1f2933;font-weight:bold;">${escapeHtml(copy.greeting(booking.full_name))}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#1f2933;line-height:1.6;">${escapeHtml(bodyText)}</p>
          <p style="margin:0 0 16px;font-size:13px;color:#68737d;line-height:1.6;">${escapeHtml(copy.next)}</p>
          <p style="margin:20px 0 0;font-size:14px;color:#126ff5;font-weight:bold;">${escapeHtml(copy.farewell)}</p>
        </td>
      </tr>
    </table>
  </div>`

    const transporter = createBookingEmailTransporter()
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: booking.email,
      replyTo: process.env.SMTP_REPLY_TO || undefined,
      subject: copy.subject(title),
      text,
      html,
    })
    return true
  } catch (error) {
    console.error('No se pudo enviar el mail de baja:', error)
    return false
  }
}
