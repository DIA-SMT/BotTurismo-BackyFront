import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { getTodayDateStringInBuenosAires, parseBusinessDateParts } from '@/lib/educational-bus-requests'
import { buildDeparturesWithAvailability, type TouristDeparture } from '@/lib/tourist-bus'
import { getTouristCircuitBySlug } from '@/lib/tourist-circuits'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope') || 'upcoming'
  const today = getTodayDateStringInBuenosAires()

  const supabase = createServerSupabaseClient()
  let query = supabase.from('tourist_departures').select('*')

  if (scope === 'past') {
    query = query.lt('departure_date', today).order('departure_date', { ascending: false })
  } else if (scope === 'all') {
    query = query.order('departure_date', { ascending: false })
  } else {
    query = query.gte('departure_date', today).order('departure_date', { ascending: true })
  }

  query = query.order('departure_time', { ascending: true })

  const { data: departures, error } = await query

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
    return NextResponse.json({ error: 'No se pudieron obtener las reservas.' }, { status: 500 })
  }

  return NextResponse.json({ data: buildDeparturesWithAvailability(departureList, bookings || []) })
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

  const catalogCircuit = getTouristCircuitBySlug(circuitSlug)
  const title = catalogCircuit ? catalogCircuit.content.es.name : customTitle

  const fieldErrors: Record<string, string> = {}
  if (!title) fieldErrors.title = 'Elegí un circuito del catálogo o escribí un nombre para la salida.'
  if (!parseBusinessDateParts(departureDate)) {
    fieldErrors.departureDate = 'Ingresá una fecha válida.'
  } else if (departureDate < getTodayDateStringInBuenosAires()) {
    fieldErrors.departureDate = 'La fecha no puede ser pasada.'
  }
  if (!timeRegex.test(departureTime)) fieldErrors.departureTime = 'Ingresá una hora válida (HH:MM).'
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    fieldErrors.capacity = 'El cupo debe ser un número entre 1 y 500.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos de la salida.', fieldErrors }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('tourist_departures')
    .insert({
      circuit_slug: catalogCircuit ? catalogCircuit.slug : null,
      title,
      departure_date: departureDate,
      departure_time: departureTime,
      capacity,
      meeting_point: meetingPoint || null,
      notes: notes || null,
      status: 'active',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo crear la salida.' }, { status: 500 })
  }

  return NextResponse.json({ data: { ...data, reserved: 0, remaining: (data as TouristDeparture).capacity } }, { status: 201 })
}
