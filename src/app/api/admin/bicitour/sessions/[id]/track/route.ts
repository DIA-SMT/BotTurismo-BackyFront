import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { distanceMeters } from '@/lib/bicitour'
import { bumpSessionVersion } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

// Recibe lotes de puntos GPS del guía. El cliente ya filtra por distancia,
// pero acá se vuelve a filtrar contra el último punto guardado para no
// acumular coordenadas redundantes si el navegador reenvía un lote.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const rawPoints = Array.isArray(body.points) ? body.points.slice(0, 200) : []
  const points = rawPoints
    .map((point) => {
      if (!point || typeof point !== 'object') return null
      const lat = Number((point as Record<string, unknown>).lat)
      const lng = Number((point as Record<string, unknown>).lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
      return { lat, lng }
    })
    .filter((point): point is { lat: number; lng: number } => point !== null)
  if (points.length === 0) return NextResponse.json({ data: { inserted: 0 } })

  const supabase = createServerSupabaseClient()
  const { data: session } = await supabase
    .from('bicitour_sessions')
    .select('id,gps_enabled,status')
    .eq('id', sessionId)
    .maybeSingle()
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })
  if (!session.gps_enabled || session.status === 'finished') {
    return NextResponse.json({ data: { inserted: 0, gpsDisabled: true } })
  }

  const { data: lastRows } = await supabase
    .from('bicitour_track_points')
    .select('lat,lng')
    .eq('session_id', sessionId)
    .order('id', { ascending: false })
    .limit(25)

  const recent = (lastRows || []) as { lat: number; lng: number }[]

  const MIN_DISTANCE_M = 12
  const DUPLICATE_TOLERANCE_M = 1
  // Retransmisiones: si el navegador reenvía un lote cuya respuesta se
  // perdió, los puntos que ya están guardados (a <1 m de alguno reciente)
  // se descartan para no dibujar zigzags hacia atrás.
  const isRetransmission = (point: { lat: number; lng: number }) =>
    recent.some((saved) => distanceMeters(saved.lat, saved.lng, point.lat, point.lng) < DUPLICATE_TOLERANCE_M)

  const toInsert: { session_id: number; lat: number; lng: number }[] = []
  let previous = recent.length > 0 ? recent[0] : null
  for (const point of points) {
    if (isRetransmission(point)) continue
    if (previous && distanceMeters(previous.lat, previous.lng, point.lat, point.lng) < MIN_DISTANCE_M) continue
    toInsert.push({ session_id: sessionId, lat: point.lat, lng: point.lng })
    previous = point
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('bicitour_track_points').insert(toInsert)
    if (error) return NextResponse.json({ error: 'No se pudieron guardar los puntos.' }, { status: 500 })
    await bumpSessionVersion(supabase, sessionId)
  }

  return NextResponse.json({ data: { inserted: toInsert.length } })
}
