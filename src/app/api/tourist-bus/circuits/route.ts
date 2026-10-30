import { NextResponse } from 'next/server'
import { getActiveTouristCircuits } from '@/lib/tourist-circuits-server'

export async function GET() {
  try {
    const circuits = await getActiveTouristCircuits()
    return NextResponse.json({ data: circuits })
  } catch {
    // Tabla inexistente (migración pendiente) u otro error: el cliente cae
    // al catálogo estático.
    return NextResponse.json({ error: 'No se pudo obtener el catálogo de circuitos.' }, { status: 500 })
  }
}
