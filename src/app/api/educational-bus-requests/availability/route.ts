import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import {
  buildMonthlyAvailability,
  circuitOptions,
  getMonthBounds,
  type EducationalBusCircuit,
  type PreferredShift,
} from '@/lib/educational-bus-requests'

function isValidCircuit(value: string): value is EducationalBusCircuit {
  return circuitOptions.some((option) => option.value === value)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const circuit = searchParams.get('circuit') || ''
  const month = searchParams.get('month') || ''

  if (!isValidCircuit(circuit)) {
    return NextResponse.json({ error: 'Circuito inválido.' }, { status: 400 })
  }

  const bounds = getMonthBounds(month)
  if (!bounds) {
    return NextResponse.json({ error: 'Mes inválido.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('educational_bus_requests')
    .select('requested_date, preferred_shift')
    .gte('requested_date', bounds.startDate)
    .lte('requested_date', bounds.endDate)
    .in('status', ['pending', 'approved'])

  if (error) {
    return NextResponse.json({ error: 'No se pudo obtener la disponibilidad.' }, { status: 500 })
  }

  const occupiedByDate = (data || []).reduce<Record<string, PreferredShift[]>>((acc, request) => {
    const date = String(request.requested_date)
    const shift = request.preferred_shift as PreferredShift
    if (!acc[date]) acc[date] = []
    if (!acc[date].includes(shift)) acc[date].push(shift)
    return acc
  }, {})

  const availability = buildMonthlyAvailability(circuit, month, occupiedByDate)
  if (!availability) {
    return NextResponse.json({ error: 'No se pudo construir la disponibilidad.' }, { status: 400 })
  }

  return NextResponse.json({ data: availability })
}
