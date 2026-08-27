import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { formatDateToDisplay } from '@/lib/educational-bus-requests'
import { formatDepartureTime, type TouristBooking, type TouristDeparture } from '@/lib/tourist-bus'
import { buildSimpleXlsxBuffer } from '@/lib/simple-xlsx'

export const runtime = 'nodejs'

// Lista de embarque de una salida puntual, pensada para imprimir y tildar
// en la puerta del bus.
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

  const supabase = createServerSupabaseClient()
  const { data: departure, error: departureError } = await supabase
    .from('tourist_departures')
    .select('*')
    .eq('id', departureId)
    .maybeSingle()

  if (departureError || !departure) {
    return NextResponse.json({ error: 'Salida no encontrada.' }, { status: 404 })
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('tourist_bookings')
    .select('*')
    .eq('departure_id', departureId)
    .eq('status', 'confirmed')
    .order('full_name', { ascending: true })

  if (bookingsError) {
    return NextResponse.json({ error: 'No se pudieron obtener las reservas.' }, { status: 500 })
  }

  const departureRecord = departure as TouristDeparture
  const bookingList = (bookings || []) as TouristBooking[]
  const totalPeople = bookingList.reduce((total, booking) => total + booking.people_count, 0)

  const hasBikes = departureRecord.bike_stock !== null && departureRecord.bike_stock !== undefined
  const totalBikes = bookingList.reduce((total, booking) => total + (booking.municipal_bikes || 0), 0)

  const rows: string[][] = [
    ['Lista de embarque - Bus Turístico'],
    [departureRecord.title],
    [
      `Fecha: ${formatDateToDisplay(departureRecord.departure_date)}`,
      `Hora: ${formatDepartureTime(departureRecord.departure_time)} h`,
      departureRecord.meeting_point ? `Punto de encuentro: ${departureRecord.meeting_point}` : '',
    ],
    [
      `Reservas confirmadas: ${bookingList.length}`,
      `Personas: ${totalPeople}/${departureRecord.capacity}`,
      hasBikes ? `Bicis municipales: ${totalBikes}/${departureRecord.bike_stock}` : '',
    ],
    [],
    [
      '#',
      'Nombre y apellido',
      'Personas',
      ...(hasBikes ? ['Bicis municipales'] : []),
      'Teléfono',
      'Email',
      'Procedencia',
      'Subió al bus',
    ],
    ...bookingList.map((booking, index) => [
      String(index + 1),
      booking.full_name,
      String(booking.people_count),
      ...(hasBikes ? [String(booking.municipal_bikes || 0)] : []),
      booking.phone,
      booking.email,
      booking.origin_city || '',
      '',
    ]),
  ]

  const workbookBuffer = buildSimpleXlsxBuffer([{ name: 'Lista de embarque', rows }])

  const fileName = `lista-embarque-${departureRecord.departure_date}-${formatDepartureTime(departureRecord.departure_time).replace(':', '')}.xlsx`

  return new NextResponse(workbookBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
