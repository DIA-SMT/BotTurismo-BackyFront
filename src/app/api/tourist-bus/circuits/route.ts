import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { getActiveTouristCircuits } from '@/lib/tourist-circuits-server'

export async function GET() {
  const supabase = createServerSupabaseClient()

  try {
    const circuits = await getActiveTouristCircuits(supabase)
    return NextResponse.json({ data: circuits })
  } catch {
    // Tabla inexistente (migración pendiente) u otro error: el cliente cae
    // al catálogo estático.
    return NextResponse.json({ error: 'No se pudo obtener el catálogo de circuitos.' }, { status: 500 })
  }
}
