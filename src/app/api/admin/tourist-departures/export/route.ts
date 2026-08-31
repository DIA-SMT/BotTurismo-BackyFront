import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { formatDateTimeToDisplay, formatDateToDisplay, parseBusinessDateParts } from '@/lib/educational-bus-requests'
import { formatDepartureTime, type TouristBooking, type TouristDeparture } from '@/lib/tourist-bus'
import { buildSimpleXlsxBuffer, type XlsxCell } from '@/lib/simple-xlsx'

export const runtime = 'nodejs'

function buildExportFileName(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split('-')
  const [toYear, toMonth, toDay] = to.split('-')
  return `reservas-bus-turistico-${fromDay}-${fromMonth}-${fromYear}_a_${toDay}-${toMonth}-${toYear}.xlsx`
}

const bookingStatusLabels: Record<TouristBooking['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

const departureStatusLabels: Record<TouristDeparture['status'], string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
}

function buildExportRows(departures: TouristDeparture[], bookings: TouristBooking[]) {
  const departuresById = new Map(departures.map((departure) => [departure.id, departure]))

  const header: XlsxCell[] = [
    'ID reserva',
    'Salida',
    'Fecha de salida',
    'Hora',
    'Estado de la salida',
    'Nombre y apellido',
    'Email',
    'Teléfono',
    'Procedencia',
    'Personas',
    'Bicis municipales',
    'Idioma',
    'Estado de la reserva',
    'Fecha de reserva',
  ].map((label) => ({ value: label, style: 'header' }))

  // Sin resultados, el archivo lo dice adentro (antes salía "vacío" sin explicación).
  if (bookings.length === 0) {
    return [
      header,
      [{
        value: 'Sin reservas en el rango elegido. El filtro es por la FECHA DE LA SALIDA (no por la fecha en que se hizo la reserva): probá ampliar el rango.',
        style: 'meta',
      } satisfies XlsxCell],
    ]
  }

  const rows = bookings.map((booking): Array<string | XlsxCell> => {
    const departure = departuresById.get(booking.departure_id)
    return [
      { value: booking.id, style: 'cellCenter' },
      { value: departure?.title || `Salida #${booking.departure_id}`, style: 'cell' },
      { value: departure ? formatDateToDisplay(departure.departure_date) : '', style: 'cellCenter' },
      { value: departure ? formatDepartureTime(departure.departure_time) : '', style: 'cellCenter' },
      { value: departure ? departureStatusLabels[departure.status] : '', style: 'cellCenter' },
      { value: booking.full_name, style: 'cell' },
      { value: booking.email, style: 'cell' },
      { value: booking.phone, style: 'cell' },
      { value: booking.origin_city || '', style: 'cell' },
      { value: booking.people_count, style: 'cellCenter' },
      { value: booking.municipal_bikes || 0, style: 'cellCenter' },
      { value: booking.language === 'en' ? 'Inglés' : 'Español', style: 'cellCenter' },
      { value: bookingStatusLabels[booking.status], style: 'cellCenter' },
      { value: formatDateTimeToDisplay(booking.created_at), style: 'cellCenter' },
    ]
  })

  return [header, ...rows]
}

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = String(searchParams.get('from') || '').trim()
  const to = String(searchParams.get('to') || '').trim()

  if (!parseBusinessDateParts(from) || !parseBusinessDateParts(to)) {
    return NextResponse.json({ error: 'El rango de fechas es inválido.' }, { status: 400 })
  }

  if (from > to) {
    return NextResponse.json({ error: 'La fecha desde no puede ser mayor que la fecha hasta.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: departures, error: departuresError } = await supabase
    .from('tourist_departures')
    .select('*')
    .gte('departure_date', from)
    .lte('departure_date', to)
    .order('departure_date', { ascending: true })
    .order('departure_time', { ascending: true })

  if (departuresError) {
    return NextResponse.json({ error: 'No se pudieron obtener las salidas.' }, { status: 500 })
  }

  const departureList = (departures || []) as TouristDeparture[]
  let bookingList: TouristBooking[] = []

  if (departureList.length > 0) {
    const { data: bookings, error: bookingsError } = await supabase
      .from('tourist_bookings')
      .select('*')
      .in('departure_id', departureList.map((departure) => departure.id))
      .order('created_at', { ascending: true })

    if (bookingsError) {
      return NextResponse.json({ error: 'No se pudieron obtener las reservas.' }, { status: 500 })
    }

    bookingList = (bookings || []) as TouristBooking[]
  }

  const workbookBuffer = buildSimpleXlsxBuffer([
    {
      name: 'Reservas bus turístico',
      rows: buildExportRows(departureList, bookingList),
      colWidths: [10, 30, 14, 8, 16, 28, 32, 16, 16, 10, 15, 10, 17, 18],
      rowHeights: { 1: 26 },
      freezeTopRows: 1,
    },
  ])

  return new NextResponse(workbookBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${buildExportFileName(from, to)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
