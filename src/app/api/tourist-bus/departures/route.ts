import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { getTodayDateStringInBuenosAires } from '@/lib/educational-bus-requests'
import { buildDeparturesWithAvailability, type TouristDeparture } from '@/lib/tourist-bus'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const today = getTodayDateStringInBuenosAires()

  const { data: departures, error } = await supabase
    .from('tourist_departures')
    .select('*')
    .eq('status', 'active')
    .gte('departure_date', today)
    .order('departure_date', { ascending: true })
    .order('departure_time', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener las salidas.' }, { status: 500 })
  }

  const departureList = (departures || []) as TouristDeparture[]

  if (departureList.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('tourist_bookings')
    .select('departure_id, people_count')
    .in('departure_id', departureList.map((departure) => departure.id))
    .eq('status', 'confirmed')

  if (bookingsError) {
    return NextResponse.json({ error: 'No se pudieron obtener las salidas.' }, { status: 500 })
  }

  return NextResponse.json({ data: buildDeparturesWithAvailability(departureList, bookings || []) })
}
