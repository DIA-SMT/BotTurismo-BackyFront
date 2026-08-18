import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import {
  buildMonthlyAvailability,
  defaultEducationalSettings,
  getMonthBounds,
  type PreferredShift,
} from '@/lib/educational-bus-requests'
import { getEducationalSettings } from '@/lib/educational-settings-server'
import { getEducationalCircuitBySlug } from '@/lib/educational-circuits-server'
import { mapEducationalCircuitRecord, type EducationalAvailabilityMap } from '@/lib/educational-circuits'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const circuit = searchParams.get('circuit') || ''
  const month = searchParams.get('month') || ''

  if (!circuit.trim()) {
    return NextResponse.json({ error: 'Circuito inválido.' }, { status: 400 })
  }

  const bounds = getMonthBounds(month)
  if (!bounds) {
    return NextResponse.json({ error: 'Mes inválido.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Disponibilidad por circuito desde el catálogo educativo. Si la tabla no
  // existe todavía, solo el circuito histórico sigue funcionando con los
  // valores por defecto.
  let circuitAvailabilityMap: EducationalAvailabilityMap | null = null
  try {
    const record = await getEducationalCircuitBySlug(supabase, circuit)
    if (record) {
      if (!record.active) {
        return NextResponse.json({ error: 'Ese circuito no está disponible actualmente.' }, { status: 400 })
      }
      circuitAvailabilityMap = mapEducationalCircuitRecord(record).availability
    }
  } catch {
    if (circuit === 'historico_cultural') {
      circuitAvailabilityMap = defaultEducationalSettings.availability
    }
  }

  if (!circuitAvailabilityMap) {
    return NextResponse.json({ error: 'Circuito inválido.' }, { status: 400 })
  }

  const globalSettings = await getEducationalSettings(supabase)
  const settings = { ...globalSettings, availability: circuitAvailabilityMap }

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

  const availability = buildMonthlyAvailability(circuit, month, occupiedByDate, settings)
  if (!availability) {
    return NextResponse.json({ error: 'No se pudo construir la disponibilidad.' }, { status: 400 })
  }

  return NextResponse.json({ data: availability })
}
