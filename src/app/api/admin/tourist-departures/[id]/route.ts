import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { parseBusinessDateParts } from '@/lib/educational-bus-requests'
import type { TouristBooking, TouristDeparture } from '@/lib/tourist-bus'
import { isBookingEmailConfigured, sendTouristDepartureCancellationEmails } from '@/lib/tourist-booking-email'
import { isBookingWhatsAppConfigured, sendTouristDepartureCancellationWhatsApps } from '@/lib/tourist-whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  if (body.bikeStock !== undefined) {
    if (body.bikeStock === null || body.bikeStock === '') {
      updatePayload.bike_stock = null
    } else {
      const bikeStock = Number(body.bikeStock)
      if (!Number.isInteger(bikeStock) || bikeStock < 0 || bikeStock > 500) {
        return NextResponse.json({ error: 'Las bicicletas deben ser un número entre 0 y 500.' }, { status: 400 })
      }
      updatePayload.bike_stock = bikeStock
    }
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

  const sql = getSql()
  const [data] = await sql<TouristDeparture[]>`
    update tourist_departures set ${rowValues(sql, updatePayload)} where id = ${departureId} returning *
  `.catch(() => [] as TouristDeparture[])

  if (!data) {
    return NextResponse.json({ error: 'No se pudo actualizar la salida.' }, { status: 500 })
  }

  // Al cancelar, opcionalmente se avisa por mail a los inscriptos confirmados.
  // El envío nunca frena la cancelación: si falla, se informa en la respuesta.
  let notification: { sent: number; failed: number; emailConfigured: boolean } | null = null
  if (body.notifyBookings === true && updatePayload.status === 'cancelled') {
    const emailConfigured = isBookingEmailConfigured()
    const cancelReason = typeof body.cancelReason === 'string' ? body.cancelReason.trim().slice(0, 300) : ''
    let sent = 0
    let failed = 0

    if (emailConfigured || isBookingWhatsAppConfigured()) {
      const confirmedBookings = await sql<TouristBooking[]>`
        select * from tourist_bookings where departure_id = ${departureId} and status = ${'confirmed'}
      `.catch((error) => {
        console.error('No se pudieron obtener las reservas a avisar:', error)
        return [] as TouristBooking[]
      })

      const [emailResult] = await Promise.all([
        sendTouristDepartureCancellationEmails(confirmedBookings, data, cancelReason || undefined),
        sendTouristDepartureCancellationWhatsApps(confirmedBookings, data, cancelReason || undefined),
      ])
      sent = emailResult.sent
      failed = emailResult.failed

      // Registro persistente de la tanda en la base, consultable después sin
      // depender de los logs: si falla el insert no se frena la cancelación,
      // solo se loguea.
      if (confirmedBookings.length > 0) {
        try {
          await sql`
            insert into tourist_notification_logs ${rowValues(sql, {
              departure_id: departureId,
              kind: 'departure_cancelled',
              channel: 'email',
              reason: cancelReason || null,
              total: confirmedBookings.length,
              sent,
              failed,
              recipients: emailResult.recipients,
            })}
          `
        } catch (logError) {
          console.error(
            'No se pudo guardar el registro de avisos de cancelación:',
            logError instanceof Error ? logError.message : logError,
          )
        }
      }
    }

    notification = { sent, failed, emailConfigured }
  }

  return NextResponse.json({ data, notification })
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

  const sql = getSql()

  let count: number
  try {
    ;[{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from tourist_bookings
      where departure_id = ${departureId} and status = ${'confirmed'}
    `
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar las reservas de la salida.' }, { status: 500 })
  }

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: 'La salida tiene reservas confirmadas. Cancelala en lugar de eliminarla.' },
      { status: 409 },
    )
  }

  try {
    await sql`delete from tourist_departures where id = ${departureId}`
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar la salida.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: departureId } })
}
