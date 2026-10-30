import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { getTodayDateStringInBuenosAires } from '@/lib/educational-bus-requests'
import { buildDeparturesWithAvailability, type TouristBooking, type TouristDeparture } from '@/lib/tourist-bus'

type ReservedSeats = Pick<TouristBooking, 'departure_id' | 'people_count' | 'municipal_bikes'>

export async function GET() {
  const sql = getSql()
  const today = getTodayDateStringInBuenosAires()

  let departureList: TouristDeparture[]
  try {
    departureList = await sql<TouristDeparture[]>`
      select * from tourist_departures
      where status = ${'active'} and departure_date >= ${today}
      order by departure_date asc, departure_time asc
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
    return NextResponse.json({ error: 'No se pudieron obtener las salidas.' }, { status: 500 })
  }

  return NextResponse.json({ data: buildDeparturesWithAvailability(departureList, bookings) })
}
