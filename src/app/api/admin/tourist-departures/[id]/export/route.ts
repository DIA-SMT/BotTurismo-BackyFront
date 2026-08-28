import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { formatDateToDisplay } from '@/lib/educational-bus-requests'
import { formatDepartureTime, type TouristBooking, type TouristDeparture } from '@/lib/tourist-bus'
import { buildSimpleXlsxBuffer, type XlsxCell } from '@/lib/simple-xlsx'

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

  const columnCount = hasBikes ? 8 : 7
  const lastColumn = String.fromCharCode(64 + columnCount)
  const fullWidth = (row: number) => `A${row}:${lastColumn}${row}`

  const metaLines = [
    `Fecha: ${formatDateToDisplay(departureRecord.departure_date)}  ·  Hora: ${formatDepartureTime(departureRecord.departure_time)} h`,
    ...(departureRecord.meeting_point ? [`Punto de encuentro: ${departureRecord.meeting_point}`] : []),
    [
      `Reservas confirmadas: ${bookingList.length}`,
      `Personas: ${totalPeople}/${departureRecord.capacity}`,
      ...(hasBikes ? [`Bicis municipales: ${totalBikes}/${departureRecord.bike_stock}`] : []),
    ].join('  ·  '),
  ]

  const rows: Array<Array<string | XlsxCell>> = [
    [{ value: 'Lista de embarque · Bus Turístico', style: 'title' }],
    [{ value: departureRecord.title, style: 'subtitle' }],
    ...metaLines.map((line): Array<string | XlsxCell> => [{ value: line, style: 'meta' }]),
    [],
    [
      { value: '#', style: 'header' },
      { value: 'Nombre y apellido', style: 'header' },
      { value: 'Personas', style: 'header' },
      ...(hasBikes ? [{ value: 'Bicis municipales', style: 'header' } as XlsxCell] : []),
      { value: 'Teléfono', style: 'header' },
      { value: 'Email', style: 'header' },
      { value: 'Procedencia', style: 'header' },
      { value: 'Subió al bus', style: 'header' },
    ],
    ...bookingList.map((booking, index): Array<string | XlsxCell> => [
      { value: index + 1, style: 'cellCenter' },
      { value: booking.full_name, style: 'cell' },
      { value: booking.people_count, style: 'cellCenter' },
      ...(hasBikes ? [{ value: booking.municipal_bikes || 0, style: 'cellCenter' } as XlsxCell] : []),
      { value: booking.phone, style: 'cell' },
      { value: booking.email, style: 'cell' },
      { value: booking.origin_city || '', style: 'cell' },
      { value: '', style: 'cellCenter' },
    ]),
    [
      { value: '', style: 'total' },
      { value: 'Totales', style: 'total' },
      { value: totalPeople, style: 'totalCenter' },
      ...(hasBikes ? [{ value: totalBikes, style: 'totalCenter' } as XlsxCell] : []),
      { value: '', style: 'total' },
      { value: '', style: 'total' },
      { value: '', style: 'total' },
      { value: '', style: 'total' },
    ],
  ]

  // Filas: 1 título, 2 subtítulo, luego las líneas de metadatos, 1 en blanco y el encabezado.
  const headerRowNumber = 4 + metaLines.length
  const dataRowHeights = Object.fromEntries(
    bookingList.map((_, index) => [headerRowNumber + 1 + index, 20]),
  )

  const workbookBuffer = buildSimpleXlsxBuffer([
    {
      name: 'Lista de embarque',
      rows,
      colWidths: hasBikes ? [5, 30, 10, 14, 16, 34, 16, 12] : [5, 30, 10, 16, 34, 16, 12],
      merges: [fullWidth(1), fullWidth(2), ...metaLines.map((_, index) => fullWidth(3 + index))],
      rowHeights: { 1: 26, 2: 20, [headerRowNumber]: 26, ...dataRowHeights },
    },
  ])

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
