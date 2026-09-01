import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { BicitourStop } from '@/lib/bicitour'
import { isBicitourAiConfigured, suggestStopHint } from '@/lib/bicitour-ai'

export const runtime = 'nodejs'
export const maxDuration = 30

// Sugiere una pista con IA para la parada. NO la guarda: el administrador
// la revisa, la edita si quiere, y la guarda él mismo (aprobación humana).
export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  if (!isBicitourAiConfigured()) {
    return NextResponse.json(
      { error: 'IA no configurada: falta OPENROUTER_API_KEY en el servidor.', aiConfigured: false },
      { status: 503 },
    )
  }

  const { id } = await context.params
  const stopId = Number(id)
  if (!Number.isInteger(stopId)) return NextResponse.json({ error: 'Parada inválida.' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data: stopRow } = await supabase.from('bicitour_stops').select('*').eq('id', stopId).maybeSingle()
  const stop = stopRow as BicitourStop | null
  if (!stop) return NextResponse.json({ error: 'Parada no encontrada.' }, { status: 404 })

  const hint = await suggestStopHint(stop)
  if (!hint) {
    return NextResponse.json(
      { error: 'El asistente no pudo sugerir una pista con el contenido disponible.' },
      { status: 502 },
    )
  }
  return NextResponse.json({ data: { hint } })
}
