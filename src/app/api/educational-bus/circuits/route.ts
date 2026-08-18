import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { getActiveEducationalCircuits } from '@/lib/educational-circuits-server'

export async function GET() {
  const supabase = createServerSupabaseClient()

  try {
    const circuits = await getActiveEducationalCircuits(supabase)
    return NextResponse.json({ data: circuits })
  } catch {
    // Tabla inexistente (migración pendiente): el cliente cae al circuito fijo.
    return NextResponse.json({ error: 'No se pudo obtener el catálogo educativo.' }, { status: 500 })
  }
}
