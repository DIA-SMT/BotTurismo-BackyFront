import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { BicitourParticipant } from '@/lib/bicitour'
import { buildParticipantState, getSessionByCode, loadSessionGraph } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

// Polling versionado del participante. Con ?since=<version> devuelve solo
// {version, unchanged: true} si nada cambió (1 consulta liviana); si cambió,
// arma el snapshot completo. ?pt=<token> identifica al participante.
export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params
  const supabase = createServerSupabaseClient()
  const session = await getSessionByCode(supabase, code)
  if (!session) {
    return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const since = Number(searchParams.get('since') || 0)
  const token = String(searchParams.get('pt') || '')

  let participant: BicitourParticipant | null = null
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = await supabase
      .from('bicitour_participants')
      .select('*')
      .eq('token', token)
      .eq('session_id', session.id)
      .maybeSingle()
    participant = (data as BicitourParticipant) || null
    if (participant) {
      // Presencia: el guía ve "conectados" a quienes pollearon hace <15 s.
      await supabase
        .from('bicitour_participants')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', participant.id)
    }
  }

  if (since > 0 && Number(session.version) === since) {
    return NextResponse.json({ version: session.version, unchanged: true })
  }

  const graph = await loadSessionGraph(supabase, session)
  if (!graph) {
    return NextResponse.json({ error: 'Sesión no disponible.' }, { status: 500 })
  }

  const state = await buildParticipantState(supabase, graph, participant)
  return NextResponse.json(state)
}
