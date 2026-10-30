import { NextRequest, NextResponse } from 'next/server'
import { getSql, pgErrorCode, rowValues, UNIQUE_VIOLATION } from '@/lib/db'
import { normalizeNickname, type BicitourParticipant } from '@/lib/bicitour'
import { bumpSessionVersion, getParticipantByToken, getSessionByCode, logSessionEvent } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

// Ingreso de un participante con apodo (sin cuenta). Devuelve un token UUID
// que el celular guarda en localStorage para reconectarse con su identidad,
// respuestas y puntaje intactos.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const sql = getSql()
  const session = await getSessionByCode(String(body.code || ''))
  if (!session) {
    return NextResponse.json({ error: 'No encontramos esa sesión. Revisá el código.' }, { status: 404 })
  }
  if (session.status === 'finished') {
    return NextResponse.json({ error: 'Esta sesión ya finalizó.' }, { status: 409 })
  }

  // Reconexión: si ya tiene token de esta sesión, se le devuelve su identidad.
  const existingToken = typeof body.token === 'string' ? body.token : null
  if (existingToken && /^[0-9a-f-]{36}$/i.test(existingToken)) {
    const participant = await getParticipantByToken(session.id, existingToken)
    if (participant) {
      await sql`
        update bicitour_participants set last_seen_at = ${new Date().toISOString()} where id = ${participant.id}
      `.catch((error) => {
        console.error('Error actualizando la presencia del participante de bicitour:', error)
      })
      return NextResponse.json({
        data: { token: participant.token, nickname: participant.nickname, team: participant.team },
      })
    }
  }

  const nickname = normalizeNickname(String(body.nickname || ''))
  if (nickname.length < 2) {
    return NextResponse.json({ error: 'Elegí un apodo de al menos 2 letras.' }, { status: 400 })
  }

  let team: string | null = null
  if (session.mode !== 'individual') {
    const requestedTeam = String(body.team || '').trim()
    const teams = session.teams || []
    if (session.mode === 'teams' && !teams.includes(requestedTeam)) {
      return NextResponse.json({ error: 'Elegí un equipo.' }, { status: 400 })
    }
    team = teams.includes(requestedTeam) ? requestedTeam : null
  }

  let participant: BicitourParticipant
  try {
    const [created] = await sql<BicitourParticipant[]>`
      insert into bicitour_participants ${rowValues(sql, { session_id: session.id, nickname, team })}
      returning *
    `
    participant = created
  } catch (error) {
    // Violación del índice único (session_id, lower(nickname)).
    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: 'Ese apodo ya está en uso en esta sesión. Probá con otro.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No pudimos sumarte a la sesión. Probá de nuevo.' }, { status: 500 })
  }

  await Promise.all([
    logSessionEvent(session.id, 'participant_joined', { nickname }),
    bumpSessionVersion(session.id),
  ])

  return NextResponse.json(
    { data: { token: participant.token, nickname: participant.nickname, team: participant.team } },
    { status: 201 },
  )
}
