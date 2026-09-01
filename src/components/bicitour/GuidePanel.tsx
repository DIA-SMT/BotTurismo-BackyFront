'use client'

import dynamic from 'next/dynamic'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './bicitour.module.css'
import {
  bicitourSessionStatusLabels,
  bicitourStopStatusLabels,
  distanceMeters,
  type BicitourSession,
  type BicitourStopStatus,
} from '@/lib/bicitour'

const BicitourMap = dynamic(() => import('./BicitourMap'), { ssr: false })

// Panel del guía: pensado para usarse EN LA CALLE desde el celular.
// Botones grandes, una sola acción importante por momento, y todo el estado
// real vive en el servidor (si se recarga la página no se pierde nada).

interface GuideQuestion {
  id: number
  prompt: string
  type: string
  points: number
  correctKey: string
  answeredCount: number
}

interface GuideStop {
  sessionStopId: number
  stopId: number
  position: number
  status: BicitourStopStatus
  activeQuestionId: number | null
  title: string
  lat: number
  lng: number
  radiusM: number
  hint: string | null
  questions: GuideQuestion[]
}

interface GuideState {
  version: number
  unchanged?: boolean
  session: BicitourSession
  route: { id: number; title: string; path: [number, number][] }
  stops: GuideStop[]
  participants: {
    id: number
    nickname: string
    team: string | null
    score: number
    badgeCount: number
    connected: boolean
  }[]
  connectedCount: number
  badgesAwarded: number
  track: [number, number][]
  trackCount: number
  teamRanking: { team: string; score: number }[]
}

const POLL_MS = 2500
const TRACK_MIN_DISTANCE_M = 15
const TRACK_FLUSH_MS = 10000

export function GuidePanel({ sessionId }: { sessionId: number }) {
  const [state, setState] = useState<GuideState | null>(null)
  const [offline, setOffline] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [announceText, setAnnounceText] = useState('')
  const [guidePosition, setGuidePosition] = useState<[number, number] | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)

  const versionRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)
  const pendingPointsRef = useRef<{ lat: number; lng: number }[]>([])
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)
  const alertedStopRef = useRef<number | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const params = versionRef.current > 0 ? `?since=${versionRef.current}` : ''
      const response = await fetch(`/api/admin/bicitour/sessions/${sessionId}${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('estado no disponible')
      const payload = (await response.json()) as GuideState
      setOffline(false)
      if (payload.unchanged) return
      versionRef.current = payload.version
      setState(payload)
    } catch {
      setOffline(true)
    }
  }, [sessionId])

  useEffect(() => {
    fetchState()
    const interval = window.setInterval(fetchState, POLL_MS)
    return () => window.clearInterval(interval)
  }, [fetchState])

  // QR de ingreso.
  const code = state?.session.code
  useEffect(() => {
    if (!code) return
    const joinUrl = `${window.location.origin}/bicitour/${code}`
    QRCode.toDataURL(joinUrl, { width: 480, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
  }, [code])

  const sendAction = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(true)
      setFeedback(null)
      try {
        const response = await fetch(`/api/admin/bicitour/sessions/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...extra }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'No se pudo ejecutar la acción.')
        versionRef.current = 0
        await fetchState()
        return true
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo ejecutar la acción.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [fetchState, sessionId],
  )

  // ── GPS del guía: watchPosition + filtro por distancia + envío por lotes ──
  const flushTrack = useCallback(async () => {
    const points = pendingPointsRef.current.splice(0)
    if (points.length === 0) return
    try {
      await fetch(`/api/admin/bicitour/sessions/${sessionId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      })
    } catch {
      // Si falló el envío, se reintenta con el próximo lote.
      pendingPointsRef.current.unshift(...points)
    }
  }, [sessionId])

  const gpsEnabled = state?.session.gps_enabled === true
  useEffect(() => {
    if (!gpsEnabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      wakeLockRef.current?.release().catch(() => undefined)
      wakeLockRef.current = null
      return
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Este navegador no tiene GPS disponible.')
      return
    }

    setGpsError(null)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsError(null)
        const point = { lat: position.coords.latitude, lng: position.coords.longitude }
        setGuidePosition([point.lat, point.lng])
        const last = lastPointRef.current
        if (!last || distanceMeters(last.lat, last.lng, point.lat, point.lng) >= TRACK_MIN_DISTANCE_M) {
          lastPointRef.current = point
          pendingPointsRef.current.push(point)
        }
      },
      (error) => {
        setGpsError(
          error.code === error.PERMISSION_DENIED
            ? 'Permiso de ubicación rechazado. Activalo en la configuración del navegador.'
            : 'Señal GPS débil o no disponible. Se reintenta solo.',
        )
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    )

    const flushInterval = window.setInterval(flushTrack, TRACK_FLUSH_MS)

    // Mejor esfuerzo para que la pantalla no se apague mientras se graba.
    // Limitación de navegadores móviles: con la pantalla bloqueada o la
    // pestaña en segundo plano, el GPS se pausa (no hay tracking background
    // real desde la web). El wake lock mitiga manteniendo la pantalla activa.
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock
      ?.request('screen')
      .then((lock) => {
        wakeLockRef.current = lock
      })
      .catch(() => undefined)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      window.clearInterval(flushInterval)
      flushTrack()
      wakeLockRef.current?.release().catch(() => undefined)
      wakeLockRef.current = null
    }
  }, [gpsEnabled, flushTrack])

  // ── Aviso de proximidad a la próxima parada (nunca la abre sola) ──
  const stops = state?.stops || []
  const nextStop = stops.find((stop) => stop.status === 'locked')
  const openStop = stops.find((stop) => ['open', 'question_active', 'question_closed'].includes(stop.status))
  const nextStopDistance =
    guidePosition && nextStop
      ? Math.round(distanceMeters(guidePosition[0], guidePosition[1], nextStop.lat, nextStop.lng))
      : null
  const nearNextStop = nextStop && nextStopDistance !== null && nextStopDistance <= nextStop.radiusM + 40

  useEffect(() => {
    if (nearNextStop && nextStop && alertedStopRef.current !== nextStop.sessionStopId) {
      alertedStopRef.current = nextStop.sessionStopId
      navigator.vibrate?.([200, 100, 200])
    }
  }, [nearNextStop, nextStop])

  if (!state) {
    return (
      <div className="table-container" style={{ padding: 18 }}>
        <div className="loading-state">
          <div className="spinner" />
          Cargando sesión…
        </div>
      </div>
    )
  }

  const session = state.session
  const status = session.status
  const activeQuestion = openStop?.questions.find((question) => question.id === openStop.activeQuestionId) || null

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 720 }}>
      <div className="table-container" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🚲 {state.route.title}</h2>
            <p className="td-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              Código <strong style={{ letterSpacing: 2 }}>{session.code}</strong> · {bicitourSessionStatusLabels[status]} ·{' '}
              👥 {state.connectedCount} conectados
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status === 'lobby' ? (
              <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => sendAction('start')} disabled={busy}>
                ▶ Iniciar recorrido
              </button>
            ) : null}
            {status === 'active' ? (
              <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => sendAction('pause')} disabled={busy}>
                ⏸ Pausar
              </button>
            ) : null}
            {status === 'paused' ? (
              <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => sendAction('resume')} disabled={busy}>
                ▶ Reanudar
              </button>
            ) : null}
            {status !== 'finished' && status !== 'lobby' ? (
              <button
                className="btn btn-secondary"
                style={{ minHeight: 44, color: '#ef4444' }}
                onClick={() => {
                  if (!window.confirm('¿Finalizar la sesión? Se cierra el recorrido y se muestran los resúmenes.')) return
                  if (!window.confirm('Confirmá de nuevo: FINALIZAR sesión para todo el grupo.')) return
                  sendAction('finish')
                }}
                disabled={busy}
              >
                🏁 Finalizar
              </button>
            ) : null}
            {status === 'finished' ? (
              <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => sendAction('reopen')} disabled={busy}>
                ↩ Reabrir (finalizada por error)
              </button>
            ) : null}
          </div>
        </div>
        {feedback ? (
          <div className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', marginTop: 10 }}>
            {feedback}
          </div>
        ) : null}
        {offline ? (
          <div className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', marginTop: 10 }}>
            Sin conexión… reintentando (la sesión sigue guardada en el servidor)
          </div>
        ) : null}
      </div>

      {status === 'lobby' ? (
        <div className="table-container" style={{ padding: 18, textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 4px' }}>Lobby de ingreso</h3>
          <p className="td-muted" style={{ margin: 0, fontSize: 13 }}>
            Mostrá este QR o dictá el código. Los participantes entran desde el navegador, sin instalar nada.
          </p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR para unirse a la sesión ${session.code}`} style={{ width: 260, maxWidth: '80%', margin: '12px auto' }} />
          ) : null}
          <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: 8 }}>{session.code}</div>
          <p className="td-muted" style={{ fontSize: 13 }}>
            busturistico.smt.gob.ar/bicitour/{session.code}
          </p>
          <div className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 14 }}>
            👥 {state.participants.length} inscriptos · {state.connectedCount} conectados
          </div>
        </div>
      ) : null}

      {status !== 'lobby' && status !== 'finished' ? (
        <>
          {/* GPS */}
          <div className="table-container" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>📡 Registro GPS {gpsEnabled ? 'ACTIVO' : 'apagado'}</strong>
              <button
                className={gpsEnabled ? 'btn btn-secondary' : 'btn btn-primary'}
                style={{ minHeight: 44 }}
                onClick={() => sendAction('gps', { enabled: !gpsEnabled })}
                disabled={busy}
              >
                {gpsEnabled ? 'Pausar registro' : 'Activar registro GPS'}
              </button>
            </div>
            {gpsEnabled ? (
              <p className="td-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                Mantené la pantalla encendida: los navegadores pausan el GPS con la pantalla bloqueada. {state.trackCount}{' '}
                puntos registrados.
              </p>
            ) : null}
            {gpsError ? (
              <div className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', marginTop: 8 }}>
                {gpsError}
              </div>
            ) : null}
          </div>

          {/* Aviso de proximidad */}
          {nearNextStop && nextStop ? (
            <div
              className="table-container"
              style={{ padding: 14, border: '2px solid #126ff5', background: 'rgba(18,111,245,0.06)' }}
            >
              <strong>📍 Estás llegando a “{nextStop.title}” ({nextStopDistance} m)</strong>
              <button
                className="btn btn-primary"
                style={{ width: '100%', minHeight: 50, marginTop: 10, fontSize: 15 }}
                onClick={() => sendAction('open_stop', { sessionStopId: nextStop.sessionStopId })}
                disabled={busy || Boolean(openStop)}
              >
                Abrir parada {nextStop.position}
              </button>
            </div>
          ) : null}

          {/* Parada abierta: control de la pregunta */}
          {openStop ? (
            <div className="table-container" style={{ padding: 16, border: '2px solid #10b981' }}>
              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                Parada actual · {bicitourStopStatusLabels[openStop.status]}
              </span>
              <h3 style={{ margin: '8px 0 10px' }}>
                {openStop.position}. {openStop.title}
              </h3>

              {openStop.status === 'open' || openStop.status === 'question_closed' ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {openStop.questions.length === 0 ? (
                    <p className="td-muted" style={{ margin: 0, fontSize: 13 }}>
                      Esta parada no tiene preguntas cargadas.
                    </p>
                  ) : null}
                  {openStop.questions.map((question) => (
                    <button
                      key={question.id}
                      className="btn btn-secondary"
                      style={{ minHeight: 48, justifyContent: 'flex-start', textAlign: 'left' }}
                      onClick={() => sendAction('activate_question', { sessionStopId: openStop.sessionStopId, questionId: question.id })}
                      disabled={busy}
                    >
                      ❓ Lanzar: {question.prompt.slice(0, 60)}
                      {question.prompt.length > 60 ? '…' : ''} ({question.points} pts)
                    </button>
                  ))}
                </div>
              ) : null}

              {openStop.status === 'question_active' && activeQuestion ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>❓ {activeQuestion.prompt}</p>
                  <div className="badge" style={{ background: 'rgba(18,111,245,0.12)', color: '#126ff5', fontSize: 14 }}>
                    ✋ {activeQuestion.answeredCount} de {state.participants.length} respondieron
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ minHeight: 50, fontSize: 15 }}
                    onClick={() => sendAction('close_question', { sessionStopId: openStop.sessionStopId })}
                    disabled={busy}
                  >
                    Cerrar pregunta y revelar respuesta
                  </button>
                </div>
              ) : null}

              <button
                className="btn btn-primary"
                style={{ width: '100%', minHeight: 50, marginTop: 12, fontSize: 15, background: '#10b981' }}
                onClick={() => sendAction('complete_stop', { sessionStopId: openStop.sessionStopId })}
                disabled={busy || openStop.status === 'question_active'}
                title={openStop.status === 'question_active' ? 'Cerrá la pregunta primero' : ''}
              >
                ✅ Completar parada (entrega los sellos)
              </button>
            </div>
          ) : null}

          {/* Lista de paradas */}
          <div className="table-container" style={{ padding: 14 }}>
            <strong style={{ fontSize: 14 }}>Paradas</strong>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {stops.map((stop) => {
                const distance =
                  guidePosition ? Math.round(distanceMeters(guidePosition[0], guidePosition[1], stop.lat, stop.lng)) : null
                return (
                  <div
                    key={stop.sessionStopId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: 'rgba(148,163,184,0.08)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong style={{ flex: '1 1 auto', minWidth: 140 }}>
                      {stop.position}. {stop.title}
                    </strong>
                    <span className="td-muted" style={{ fontSize: 12 }}>
                      {bicitourStopStatusLabels[stop.status]}
                      {distance !== null && stop.status === 'locked' ? ` · ${distance} m` : ''}
                    </span>
                    {stop.status === 'locked' ? (
                      <>
                        <button
                          className="btn btn-secondary"
                          style={{ height: 36, padding: '0 12px', fontSize: 13 }}
                          onClick={() => sendAction('open_stop', { sessionStopId: stop.sessionStopId })}
                          disabled={busy || Boolean(openStop)}
                        >
                          Abrir
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ height: 36, padding: '0 12px', fontSize: 13, color: '#64748b' }}
                          onClick={() => sendAction('skip_stop', { sessionStopId: stop.sessionStopId })}
                          disabled={busy}
                        >
                          Omitir
                        </button>
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', minHeight: 44, marginTop: 10 }}
              onClick={() => {
                if (!guidePosition) {
                  setFeedback('Activá el GPS para crear una parada acá.')
                  return
                }
                const title = window.prompt('Nombre de la parada espontánea (queda como borrador para revisar después):')
                if (!title) return
                sendAction('spontaneous_stop', { title, lat: guidePosition[0], lng: guidePosition[1] })
              }}
              disabled={busy}
            >
              ➕ Parada espontánea acá (borrador)
            </button>
          </div>

          {/* Aviso a participantes */}
          <div className="table-container" style={{ padding: 14 }}>
            <strong style={{ fontSize: 14 }}>📢 Aviso al grupo</strong>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                className="input"
                style={{ flex: 1, minHeight: 44 }}
                value={announceText}
                onChange={(event) => setAnnounceText(event.target.value)}
                placeholder="Ej: Nos detenemos 5 minutos acá"
                maxLength={200}
              />
              <button
                className="btn btn-primary"
                style={{ minHeight: 44 }}
                onClick={async () => {
                  if (await sendAction('announce', { text: announceText })) setAnnounceText('')
                }}
                disabled={busy || !announceText.trim()}
              >
                Enviar
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* Mapa */}
      <div className="table-container" style={{ padding: 10 }}>
        <BicitourMap
          stops={stops.map((stop) => ({
            id: stop.sessionStopId,
            position: stop.position,
            title: stop.title,
            status: stop.status,
            lat: stop.lat,
            lng: stop.lng,
          }))}
          path={state.route.path}
          track={state.track}
          guidePosition={guidePosition}
          height={300}
        />
      </div>

      {/* Ranking + participantes */}
      <div className="table-container" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>
            🏆 Ranking parcial
            {state.badgesAwarded > 0 ? (
              <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', marginLeft: 8, fontSize: 12 }}>
                🎖 {state.badgesAwarded} insignia{state.badgesAwarded === 1 ? '' : 's'} entregada{state.badgesAwarded === 1 ? '' : 's'}
              </span>
            ) : null}
          </strong>
          <button className="btn btn-secondary" style={{ height: 34, padding: '0 12px', fontSize: 13 }} onClick={() => setShowParticipants((value) => !value)}>
            {showParticipants ? 'Ver top 5' : `Ver todos (${state.participants.length})`}
          </button>
        </div>
        {state.teamRanking.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {state.teamRanking.map((team, index) => (
              <span key={team.team} className="badge" style={{ background: 'rgba(18,111,245,0.12)', color: '#126ff5', fontSize: 13 }}>
                {index + 1}º {team.team}: {team.score}
              </span>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {(showParticipants ? state.participants : state.participants.slice(0, 5)).map((participant, index) => (
            <div key={participant.id} className={styles.rankRow} style={{ marginTop: 0 }}>
              <span className={styles.rankPosition}>{index + 1}º</span>
              <span className={styles.rankName}>
                {participant.connected ? '🟢' : '⚪'} {participant.nickname}
                {participant.team ? <span className={styles.rankTeam}> · {participant.team}</span> : null}
                {participant.badgeCount > 0 ? (
                  <span className={styles.rankTeam}> · 🎖×{participant.badgeCount}</span>
                ) : null}
              </span>
              <span className={styles.rankScore}>{participant.score}</span>
            </div>
          ))}
          {state.participants.length === 0 ? (
            <p className="td-muted" style={{ margin: 0, fontSize: 13 }}>
              Todavía no ingresó nadie.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
