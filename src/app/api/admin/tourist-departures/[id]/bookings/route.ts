import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql } from '@/lib/db'
import type { TouristBooking, TouristNotificationLog } from '@/lib/tourist-bus'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  let data: TouristBooking[]
  try {
    data = await sql<TouristBooking[]>`
      select * from tourist_bookings where departure_id = ${departureId} order by created_at asc
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las reservas.' }, { status: 500 })
  }

  // Historial de avisos enviados para esta salida (si la consulta falla, se
  // devuelve vacío sin romper el listado de reservas).
  const notificationLogs = await sql<TouristNotificationLog[]>`
    select * from tourist_notification_logs where departure_id = ${departureId} order by created_at desc
  `.catch((logsError) => {
    console.error(
      'No se pudieron obtener los registros de avisos:',
      logsError instanceof Error ? logsError.message : logsError,
    )
    return [] as TouristNotificationLog[]
  })

  return NextResponse.json({ data, notificationLogs })
}
