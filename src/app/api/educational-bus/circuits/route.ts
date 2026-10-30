import { NextResponse } from 'next/server'
import { getActiveEducationalCircuits } from '@/lib/educational-circuits-server'

export async function GET() {
  try {
    const circuits = await getActiveEducationalCircuits()
    return NextResponse.json({ data: circuits })
  } catch {
    // Tabla inexistente (migración pendiente): el cliente cae al circuito fijo.
    return NextResponse.json({ error: 'No se pudo obtener el catálogo educativo.' }, { status: 500 })
  }
}
