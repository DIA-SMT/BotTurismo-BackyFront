import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { getTodayDateStringInBuenosAires, parseBusinessDateParts } from '@/lib/educational-bus-requests'
import { buildDeparturesWithAvailability, type TouristBooking, type TouristDeparture } from '@/lib/tourist-bus'
import { resolveCircuitForDeparture } from '@/lib/tourist-circuits-admin'

type ReservedSeats = Pick<TouristBooking, 'departure_id' | 'people_count' | 'municipal_bikes'>

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope') || 'upcoming'
  const today = getTodayDateStringInBuenosAires()

  const sql = getSql()
  let filter = sql`where departure_date >= ${today}`
  let dateOrder = sql`departure_date asc`

  if (scope === 'past') {
    filter = sql`where departure_date < ${today}`
    dateOrder = sql`departure_date desc`
  } else if (scope === 'all') {
    filter = sql``
    dateOrder = sql`departure_date desc`
  }

  let departureList: TouristDeparture[]
  try {
    departureList = await sql<TouristDeparture[]>`
      select * from tourist_departures
      ${filter}
      order by ${dateOrder}, departure_time asc
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las salidas.' }, { status: 500 })
  }

  if (departureList.length === 0) {
    return NextResponse.json({ data: [] })
  }

  let bookings: ReservedSeats[]
  try {
    bookings = await sql<ReservedSeats[]>`
      select departure_id, people_count, municipal_bikes from tourist_bookings
      where departure_id in ${sql(departureList.map((departure) => departure.id))} and status = ${'confirmed'}
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las reservas.' }, { status: 500 })
  }

  return NextResponse.json({ data: buildDeparturesWithAvailability(departureList, bookings) })
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
  const departureDate = String(body.departureDate || '').trim()
  const departureTime = String(body.departureTime || '').trim()
  const capacity = Number(body.capacity)
  const meetingPoint = typeof body.meetingPoint === 'string' ? body.meetingPoint.trim() : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  const bikeStockRaw = body.bikeStock
  const bikeStock =
    bikeStockRaw === undefined || bikeStockRaw === null || bikeStockRaw === '' ? null : Number(bikeStockRaw)

  const circuit = await resolveCircuitForDeparture(circuitSlug)
  const title = circuit.title || customTitle

  const fieldErrors: Record<string, string> = {}
  if (!title) fieldErrors.title = 'Elegí un circuito del catálogo o escribí un nombre para la salida.'
  if (circuit.inactive) fieldErrors.title = 'Ese circuito está desactivado. Activalo desde la pestaña Circuitos.'
  if (!parseBusinessDateParts(departureDate)) {
    fieldErrors.departureDate = 'Ingresá una fecha válida.'
  } else if (departureDate < getTodayDateStringInBuenosAires()) {
    fieldErrors.departureDate = 'La fecha no puede ser pasada.'
  }
  if (!timeRegex.test(departureTime)) fieldErrors.departureTime = 'Ingresá una hora válida (HH:MM).'
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    fieldErrors.capacity = 'El cupo debe ser un número entre 1 y 500.'
  }
  if (bikeStock !== null && (!Number.isInteger(bikeStock) || bikeStock < 0 || bikeStock > 500)) {
    fieldErrors.bikeStock = 'Las bicicletas deben ser un número entre 0 y 500.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos de la salida.', fieldErrors }, { status: 400 })
  }

  const sql = getSql()
  const [data] = await sql<TouristDeparture[]>`
    insert into tourist_departures ${rowValues(sql, {
      circuit_slug: circuit.slug,
      title,
      departure_date: departureDate,
      departure_time: departureTime,
      capacity,
      bike_stock: bikeStock,
      meeting_point: meetingPoint || null,
      notes: notes || null,
      status: 'active',
    })}
    returning *
  `.catch(() => [] as TouristDeparture[])

  if (!data) {
    return NextResponse.json({ error: 'No se pudo crear la salida.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      data: {
        ...data,
        reserved: 0,
        remaining: data.capacity,
        bikes_reserved: 0,
        bikes_remaining: data.bike_stock,
      },
    },
    { status: 201 },
  )
}
