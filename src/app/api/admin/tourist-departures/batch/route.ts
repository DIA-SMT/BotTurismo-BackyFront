import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { buildDateKey, getTodayDateStringInBuenosAires, parseBusinessDateParts } from '@/lib/educational-bus-requests'
import { resolveCircuitForDeparture } from '@/lib/tourist-circuits-admin'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
const maximumGeneratedDepartures = 60

function listDatesForWeekdays(fromKey: string, toKey: string, weekdays: number[]) {
  const from = parseBusinessDateParts(fromKey)
  const to = parseBusinessDateParts(toKey)
  if (!from || !to) return []

  const dates: string[] = []
  const cursor = new Date(from.year, from.month - 1, from.day)
  const end = new Date(to.year, to.month - 1, to.day)

  while (cursor <= end) {
    if (weekdays.includes(cursor.getDay())) {
      dates.push(buildDateKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()))
    }
    cursor.setDate(cursor.getDate() + 1)
    if (dates.length > maximumGeneratedDepartures) break
  }

  return dates
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const circuitSlug = typeof body.circuitSlug === 'string' && body.circuitSlug.trim() ? body.circuitSlug.trim() : null
  const customTitle = typeof body.title === 'string' ? body.title.trim() : ''
  const departureTime = String(body.departureTime || '').trim()
  const capacity = Number(body.capacity)
  const meetingPoint = typeof body.meetingPoint === 'string' ? body.meetingPoint.trim() : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  const bikeStockRaw = body.bikeStock
  const bikeStock =
    bikeStockRaw === undefined || bikeStockRaw === null || bikeStockRaw === '' ? null : Number(bikeStockRaw)
  const fromDate = String(body.fromDate || '').trim()
  const toDate = String(body.toDate || '').trim()
  const weekdays = Array.isArray(body.weekdays)
    ? [...new Set(body.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : []

  const supabase = createServerSupabaseClient()
  const circuit = await resolveCircuitForDeparture(supabase, circuitSlug)
  const title = circuit.title || customTitle
  const today = getTodayDateStringInBuenosAires()

  const fieldErrors: Record<string, string> = {}
  if (!title) fieldErrors.title = 'Elegí un circuito del catálogo o escribí un nombre para la salida.'
  if (circuit.inactive) fieldErrors.title = 'Ese circuito está desactivado. Activalo desde la pestaña Circuitos.'
  if (!timeRegex.test(departureTime)) fieldErrors.departureTime = 'Ingresá una hora válida (HH:MM).'
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    fieldErrors.capacity = 'El cupo debe ser un número entre 1 y 500.'
  }
  if (bikeStock !== null && (!Number.isInteger(bikeStock) || bikeStock < 0 || bikeStock > 500)) {
    fieldErrors.bikeStock = 'Las bicicletas deben ser un número entre 0 y 500.'
  }
  if (weekdays.length === 0) fieldErrors.weekdays = 'Elegí al menos un día de la semana.'
  if (!parseBusinessDateParts(fromDate)) {
    fieldErrors.fromDate = 'Ingresá una fecha desde válida.'
  } else if (fromDate < today) {
    fieldErrors.fromDate = 'La fecha desde no puede ser pasada.'
  }
  if (!parseBusinessDateParts(toDate)) {
    fieldErrors.toDate = 'Ingresá una fecha hasta válida.'
  } else if (toDate < fromDate) {
    fieldErrors.toDate = 'La fecha hasta debe ser posterior a la fecha desde.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos de la programación.', fieldErrors }, { status: 400 })
  }

  const dates = listDatesForWeekdays(fromDate, toDate, weekdays)

  if (dates.length === 0) {
    return NextResponse.json(
      { error: 'No hay fechas que coincidan con los días elegidos en ese rango.' },
      { status: 400 },
    )
  }

  if (dates.length > maximumGeneratedDepartures) {
    return NextResponse.json(
      { error: `El rango genera más de ${maximumGeneratedDepartures} salidas. Achicá el período.` },
      { status: 400 },
    )
  }

  // Evita duplicar salidas ya cargadas (misma fecha + hora + mismo circuito/título).
  let duplicatesQuery = supabase
    .from('tourist_departures')
    .select('departure_date')
    .in('departure_date', dates)
    .eq('departure_time', departureTime)

  duplicatesQuery = circuit.slug ? duplicatesQuery.eq('circuit_slug', circuit.slug) : duplicatesQuery.eq('title', title)

  const { data: duplicates, error: duplicatesError } = await duplicatesQuery

  if (duplicatesError) {
    return NextResponse.json({ error: 'No se pudieron verificar salidas existentes.' }, { status: 500 })
  }

  const existingDates = new Set((duplicates || []).map((row) => String(row.departure_date)))
  const datesToCreate = dates.filter((date) => !existingDates.has(date))

  if (datesToCreate.length === 0) {
    return NextResponse.json(
      { error: 'Todas las fechas del rango ya tienen esa salida cargada.', skipped: dates.length },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('tourist_departures')
    .insert(
      datesToCreate.map((departureDate) => ({
        circuit_slug: circuit.slug,
        title,
        departure_date: departureDate,
        departure_time: departureTime,
        capacity,
        bike_stock: bikeStock,
        meeting_point: meetingPoint || null,
        notes: notes || null,
        status: 'active',
      })),
    )
    .select('id')

  if (error) {
    return NextResponse.json({ error: 'No se pudieron crear las salidas.' }, { status: 500 })
  }

  return NextResponse.json(
    { data: { created: (data || []).length, skipped: dates.length - datesToCreate.length } },
    { status: 201 },
  )
}
