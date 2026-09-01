'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './bicitour.module.css'
import {
  bicitourSessionStatusLabels,
  type ParticipantStateResponse,
  type ParticipantStopView,
} from '@/lib/bicitour'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  drawBicitourMemoryCard,
  loadCardLogo,
  type BicitourMemoryCardData,
} from '@/lib/bicitour-card'

const BicitourMap = dynamic(() => import('./BicitourMap'), { ssr: false })

// Experiencia del participante: entra con QR/código + apodo, sin cuenta.
// La identidad (token UUID) vive en localStorage para sobrevivir refresh y
// cortes de conexión. Todo el estado llega por polling versionado.

interface Identity {
  token: string
  nickname: string
  team: string | null
}

const POLL_MS = 2500

function identityStorageKey(code: string) {
  return `bicitour:${code.toUpperCase()}`
}

export function ParticipantExperience({ code }: { code: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [identityLoaded, setIdentityLoaded] = useState(false)
  const [state, setState] = useState<ParticipantStateResponse | null>(null)
  const [offline, setOffline] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<'tour' | 'passport' | 'ranking'>('tour')

  const [nicknameInput, setNicknameInput] = useState('')
  const [teamInput, setTeamInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [sendingAnswer, setSendingAnswer] = useState(false)

  const [dismissedAnnouncementAt, setDismissedAnnouncementAt] = useState<string | null>(null)
  // Animación de insignia desbloqueada: solo cuando aparece una nueva
  // respecto del poll anterior (nunca tras recargar la página).
  const [badgeToast, setBadgeToast] = useState<{ emoji: string; name: string } | null>(null)
  const knownBadgeKeysRef = useRef<Set<string> | null>(null)

  const versionRef = useRef(0)
  const identityRef = useRef<Identity | null>(null)
  identityRef.current = identity

  // Identidad guardada (reconexión / refresh).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(identityStorageKey(code))
      if (raw) {
        const parsed = JSON.parse(raw) as Identity
        if (parsed?.token) setIdentity(parsed)
      }
    } catch {
      // Sin storage disponible: se puede jugar igual, pero sin reconexión.
    }
    setIdentityLoaded(true)
  }, [code])

  const fetchState = useCallback(async () => {
    const token = identityRef.current?.token
    const params = new URLSearchParams()
    if (versionRef.current > 0) params.set('since', String(versionRef.current))
    if (token) params.set('pt', token)
    try {
      const response = await fetch(`/api/bicitour/sessions/${encodeURIComponent(code)}/state?${params}`, {
        cache: 'no-store',
      })
      if (response.status === 404) {
        setNotFound(true)
        return
      }
      if (!response.ok) throw new Error('estado no disponible')
      const payload = (await response.json()) as ParticipantStateResponse
      setOffline(false)
      if (payload.unchanged) return
      versionRef.current = payload.version
      // Detección de insignia nueva para la animación (accesible vía aria-live).
      // Solo se compara entre polls CON identidad: el primer estado con `me`
      // inicializa el set sin animar, así recargar la página no repite toasts.
      const badges = payload.me?.badges
      if (badges) {
        if (knownBadgeKeysRef.current !== null) {
          const fresh = badges.find((badge) => !knownBadgeKeysRef.current?.has(badge.key))
          if (fresh) {
            setBadgeToast({ emoji: fresh.emoji, name: fresh.name })
            window.setTimeout(() => setBadgeToast(null), 4500)
          }
        }
        knownBadgeKeysRef.current = new Set(badges.map((badge) => badge.key))
      }
      setState(payload)
    } catch {
      setOffline(true)
    }
  }, [code])

  // Polling continuo (arranca aún sin identidad, para mostrar el lobby).
  useEffect(() => {
    versionRef.current = 0
    fetchState()
    const interval = window.setInterval(fetchState, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        versionRef.current = 0
        fetchState()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchState, identity?.token])

  const handleJoin = async () => {
    setJoining(true)
    setJoinError(null)
    try {
      const response = await fetch('/api/bicitour/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, nickname: nicknameInput, team: teamInput }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo ingresar.')
      const joined: Identity = payload.data
      try {
        window.localStorage.setItem(identityStorageKey(code), JSON.stringify(joined))
      } catch {
        // Sin storage: seguimos en memoria.
      }
      versionRef.current = 0
      setIdentity(joined)
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'No se pudo ingresar.')
    } finally {
      setJoining(false)
    }
  }

  const handleAnswer = async (questionId: number) => {
    if (!identity || !selectedAnswer) return
    setSendingAnswer(true)
    setAnswerError(null)
    try {
      const response = await fetch('/api/bicitour/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, token: identity.token, questionId, answerKey: selectedAnswer }),
      })
      const payload = await response.json()
      if (!response.ok && response.status !== 409) throw new Error(payload.error || 'No se pudo enviar.')
      versionRef.current = 0
      await fetchState()
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : 'No se pudo enviar tu respuesta.')
    } finally {
      setSendingAnswer(false)
    }
  }

  // Reset de selección al cambiar la pregunta activa.
  const activeQuestionId = state?.openStop?.question?.id ?? null
  useEffect(() => {
    setSelectedAnswer(null)
    setAnswerError(null)
  }, [activeQuestionId])

  if (notFound) {
    return (
      <main className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>
            <h1 className={styles.cardTitle}>Sesión no encontrada</h1>
            <p className={styles.muted}>Revisá el código o pedile al guía el QR actualizado.</p>
          </div>
        </div>
      </main>
    )
  }

  const session = state?.session
  const status = session?.status || 'lobby'

  // ── Pantalla de ingreso ──
  if (identityLoaded && !identity) {
    const teams = session?.teams || []
    const needsTeam = session ? session.mode === 'teams' : false
    const canPickTeam = session ? session.mode !== 'individual' && teams.length > 0 : false
    return (
      <main className={styles.page}>
        <div className={styles.main}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logoMuni-sm.png" alt="Municipalidad de San Miguel de Tucumán" className={styles.joinLogo} />
          <h1 className={styles.joinTitle}>Bicitour SMT</h1>
          <p className={styles.joinSubtitle}>{session ? session.routeTitle : 'Cargando sesión…'}</p>

          <div className={styles.card} style={{ display: 'grid', gap: 14 }}>
            <label className={styles.label}>
              Tu apodo
              <input
                className={styles.input}
                value={nicknameInput}
                onChange={(event) => setNicknameInput(event.target.value)}
                placeholder="Ej: Turista Veloz"
                maxLength={24}
                autoComplete="off"
              />
            </label>

            {canPickTeam ? (
              <div className={styles.label}>
                Tu equipo {needsTeam ? '' : '(opcional)'}
                <div className={styles.teamRow}>
                  {teams.map((team) => (
                    <button
                      key={team}
                      type="button"
                      className={`${styles.teamChip} ${teamInput === team ? styles.teamChipActive : ''}`}
                      onClick={() => setTeamInput((current) => (current === team ? '' : team))}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {joinError ? <p className={styles.error}>{joinError}</p> : null}

            <button className={styles.primaryButton} onClick={handleJoin} disabled={joining || !session}>
              {joining ? 'Ingresando…' : '¡Sumarme al recorrido!'}
            </button>
            <p className={styles.muted} style={{ textAlign: 'center', margin: 0 }}>
              Sin cuentas ni datos personales: solo tu apodo.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!state || !session) {
    return (
      <main className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>
            <p className={styles.muted}>Cargando la sesión…</p>
          </div>
        </div>
      </main>
    )
  }

  const openStop = state.openStop || null
  const progress = state.progress || { completed: 0, total: 0 }
  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const announcement = session.announcement
  const showAnnouncement = announcement && announcement.at !== dismissedAnnouncementAt

  const statusClass =
    status === 'active'
      ? styles.statusActive
      : status === 'paused'
        ? styles.statusPaused
        : status === 'finished'
          ? styles.statusFinished
          : styles.statusLobby

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span>Bicitour SMT</span>
          <strong>{session.routeTitle}</strong>
        </div>
        <div className={styles.scorePill}>⭐ {state.me?.score ?? 0}</div>
      </header>
      <div className={`${styles.statusBar} ${statusClass}`}>
        {bicitourSessionStatusLabels[status]}
        {session.gpsActive ? ' · 📡 GPS del guía activo' : ''}
      </div>
      {offline ? <div className={styles.connectionBanner}>Sin conexión… reintentando</div> : null}

      <div className={styles.main}>
        {status === 'finished' ? (
          <FinalSummary state={state} />
        ) : tab === 'tour' ? (
          openStop ? (
            <OpenStopView
              stop={openStop}
              myAnswerKey={state.myAnswerKey ?? null}
              selectedAnswer={selectedAnswer}
              onSelect={setSelectedAnswer}
              onSubmit={handleAnswer}
              sending={sendingAnswer}
              answerError={answerError}
              sessionActive={status === 'active'}
            />
          ) : (
            <RidingView state={state} progressPercent={progressPercent} />
          )
        ) : tab === 'passport' ? (
          <PassportView state={state} />
        ) : (
          <RankingView state={state} />
        )}

        {status === 'finished' ? (
          <>
            <PassportView state={state} />
            <RankingView state={state} />
          </>
        ) : null}
      </div>

      {badgeToast ? (
        <div className={styles.badgeToast} role="status" aria-live="polite">
          <span aria-hidden>{badgeToast.emoji}</span>
          <span>¡Insignia desbloqueada: {badgeToast.name}!</span>
        </div>
      ) : null}

      {showAnnouncement ? (
        <div className={styles.announcement} role="status">
          <span>📢 {announcement.text}</span>
          <button
            className={styles.announcementClose}
            onClick={() => setDismissedAnnouncementAt(announcement.at)}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      ) : null}

      {status !== 'finished' ? (
        <nav className={styles.tabs} aria-label="Secciones">
          <button className={`${styles.tab} ${tab === 'tour' ? styles.tabActive : ''}`} onClick={() => setTab('tour')}>
            <span aria-hidden>🚲</span>
            Recorrido
          </button>
          <button
            className={`${styles.tab} ${tab === 'passport' ? styles.tabActive : ''}`}
            onClick={() => setTab('passport')}
          >
            <span aria-hidden>📖</span>
            Pasaporte
          </button>
          <button
            className={`${styles.tab} ${tab === 'ranking' ? styles.tabActive : ''}`}
            onClick={() => setTab('ranking')}
          >
            <span aria-hidden>🏆</span>
            Ranking
          </button>
        </nav>
      ) : null}
    </main>
  )
}

// ── Modo pedaleo: información mínima, nada que leer o tocar ──
function RidingView({ state, progressPercent }: { state: ParticipantStateResponse; progressPercent: number }) {
  const progress = state.progress || { completed: 0, total: 0 }
  const status = state.session?.status
  return (
    <>
      {status === 'lobby' ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>¡Ya estás adentro! 🎉</h2>
          <p className={styles.muted}>Esperá a que el guía inicie el recorrido. Mantené esta página abierta.</p>
        </div>
      ) : null}
      {status === 'paused' ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Recorrido en pausa</h2>
          <p className={styles.muted}>El guía retoma en un momento.</p>
        </div>
      ) : null}

      <div className={styles.card} style={{ padding: 10 }}>
        <BicitourMap
          stops={(state.stops || []).map((stop) => ({
            id: stop.sessionStopId,
            position: stop.position,
            title: stop.title,
            status: stop.status,
            lat: stop.lat,
            lng: stop.lng,
          }))}
          path={state.path || []}
          track={state.track || []}
          height={300}
        />
      </div>

      <div className={styles.card}>
        <div className={styles.progressRow}>
          <span>Paradas</span>
          <span>
            {progress.completed}/{progress.total}
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
        {state.hint ? (
          <div className={styles.hint}>
            <strong>🧭 Próximo destino</strong>
            <br />
            {state.hint}
          </div>
        ) : null}
      </div>
    </>
  )
}

// ── Parada abierta: contenido histórico + pregunta ──
function OpenStopView({
  stop,
  myAnswerKey,
  selectedAnswer,
  onSelect,
  onSubmit,
  sending,
  answerError,
  sessionActive,
}: {
  stop: ParticipantStopView
  myAnswerKey: string | null
  selectedAnswer: string | null
  onSelect: (key: string) => void
  onSubmit: (questionId: number) => void
  sending: boolean
  answerError: string | null
  sessionActive: boolean
}) {
  const question = stop.question
  const reveal = stop.reveal
  return (
    <>
      <div className={styles.card}>
        <span className={styles.stopBadge}>📍 Parada {stop.position}</span>
        <h2 className={styles.cardTitle} style={{ marginTop: 8 }}>
          {stop.title}
        </h2>
        {stop.content?.imageUrls?.length ? (
          <div className={styles.stopImages}>
            {stop.content.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt={stop.title} loading="lazy" />
            ))}
          </div>
        ) : null}
        {stop.content?.description ? (
          <p className={styles.muted} style={{ fontSize: '0.98rem', color: '#2b3b52' }}>
            {stop.content.description}
          </p>
        ) : null}
        {stop.content?.funFacts?.map((fact) => (
          <div key={fact} className={styles.funFact}>
            <span aria-hidden>✨</span>
            <span>{fact}</span>
          </div>
        ))}
        {stop.content?.audioUrl ? (
          <audio controls src={stop.content.audioUrl} style={{ width: '100%', marginTop: 12 }} preload="none" />
        ) : null}
      </div>

      {question ? (
        <div className={styles.card}>
          <span className={styles.stopBadge} style={{ background: '#fff6e0', color: '#7a5b12' }}>
            ❓ Pregunta · {question.points} pts
          </span>
          <h3 className={styles.cardTitle} style={{ marginTop: 8 }}>
            {question.prompt}
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {question.options.map((option) => {
              const isMine = myAnswerKey === option.key
              const isSelected = selectedAnswer === option.key
              return (
                <button
                  key={option.key}
                  className={`${styles.optionButton} ${isMine || isSelected ? styles.optionSelected : ''}`}
                  onClick={() => !myAnswerKey && onSelect(option.key)}
                  disabled={Boolean(myAnswerKey) || sending || !sessionActive}
                >
                  <span className={styles.optionKey}>{option.key}</span>
                  {option.label}
                </button>
              )
            })}
          </div>
          {answerError ? <p className={styles.error} style={{ marginTop: 10 }}>{answerError}</p> : null}
          {myAnswerKey ? (
            <p className={styles.muted} style={{ marginTop: 12, textAlign: 'center', fontWeight: 700 }}>
              ✅ Respuesta enviada. Esperá a que el guía cierre la pregunta…
            </p>
          ) : (
            <button
              className={styles.primaryButton}
              style={{ marginTop: 14 }}
              onClick={() => onSubmit(question.id)}
              disabled={!selectedAnswer || sending || !sessionActive}
            >
              {sending ? 'Enviando…' : 'Responder'}
            </button>
          )}
        </div>
      ) : null}

      {reveal && !question ? (
        <div className={styles.card}>
          <span className={styles.stopBadge} style={{ background: '#e7f8f1', color: '#0b7a55' }}>
            ✅ Respuesta correcta
          </span>
          <h3 className={styles.cardTitle} style={{ marginTop: 8 }}>
            {reveal.prompt}
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {reveal.options.map((option) => {
              const isCorrect = option.key === reveal.correctKey
              const wasMine = myAnswerKey === option.key
              return (
                <div
                  key={option.key}
                  className={`${styles.optionButton} ${isCorrect ? styles.optionCorrect : wasMine ? styles.optionWrong : ''}`}
                >
                  <span className={styles.optionKey}>{isCorrect ? '✓' : option.key}</span>
                  {option.label}
                  {wasMine ? <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>tu respuesta</span> : null}
                </div>
              )
            })}
          </div>
          {reveal.explanation ? (
            <div className={styles.funFact} style={{ marginTop: 12 }}>
              <span aria-hidden>🎓</span>
              <span>{reveal.explanation}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!question && !reveal ? (
        <div className={styles.card}>
          <p className={styles.muted} style={{ textAlign: 'center', margin: 0 }}>
            🎧 Escuchá al guía… en un rato se habilita el desafío de esta parada.
          </p>
        </div>
      ) : null}
    </>
  )
}

// ── Pasaporte Bicitour: sellos por parada + Mis insignias ──
function PassportView({ state }: { state: ParticipantStateResponse }) {
  const stops = state.stops || []
  const stamps = state.me?.stamps || []
  const stampedStopIds = new Set(stamps.filter((stamp) => stamp.stopId !== null).map((stamp) => stamp.stopId))
  const badgeProgress = state.me?.badgeProgress || []
  return (
    <>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>📖 Pasaporte Bicitour</h2>
        <p className={styles.muted}>Un sello por cada parada completada con el grupo.</p>
        <div className={styles.passportGrid} style={{ marginTop: 14 }}>
          {stops.map((stop) => {
            const earned = stampedStopIds.has(stop.stopId)
            return (
              <div key={stop.sessionStopId} className={styles.stamp}>
                <span className={`${styles.stampCircle} ${earned ? styles.stampEarned : ''}`}>
                  {earned ? '✓' : stop.position}
                </span>
                <span>{stop.title}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>🎖 Mis insignias</h2>
        <p className={styles.muted}>Se desbloquean jugando: escuchá al guía y sumá aciertos.</p>
        {badgeProgress.map((badge) => (
          <div key={badge.key} className={`${styles.badgeRow} ${badge.earned ? styles.badgeRowEarned : ''}`}>
            <span className={`${styles.badgeEmoji} ${badge.earned ? styles.badgeEmojiEarned : ''}`} aria-hidden>
              {badge.emoji}
            </span>
            <div className={styles.badgeBody}>
              <span className={styles.badgeName}>
                {badge.name}
                {badge.earned ? ' · ¡Desbloqueada!' : ''}
              </span>
              <span className={styles.badgeDescription}>{badge.description}</span>
              <div className={styles.badgeProgressTrack} aria-hidden>
                <div className={styles.badgeProgressFill} style={{ width: `${Math.round(badge.progress * 100)}%` }} />
              </div>
              <span className={styles.badgeDescription}>{badge.earned ? '✓ Obtenida' : badge.progressText}</span>
            </div>
          </div>
        ))}
        {badgeProgress.length === 0 ? (
          <p className={styles.muted} style={{ marginTop: 8 }}>
            Las insignias aparecen cuando arranca el juego.
          </p>
        ) : null}
      </div>
    </>
  )
}

// ── Ranking individual y por equipos ──
function RankingView({ state }: { state: ParticipantStateResponse }) {
  const ranking = state.ranking || []
  const teamRanking = state.teamRanking || []
  return (
    <>
      {teamRanking.length > 0 ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>🚩 Equipos</h2>
          {teamRanking.map((team, index) => (
            <div key={team.team} className={styles.rankRow}>
              <span className={styles.rankPosition}>{index + 1}º</span>
              <span className={styles.rankName}>
                {team.team} <span className={styles.rankTeam}>({team.members})</span>
              </span>
              <span className={styles.rankScore}>{team.score}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>🏆 Ranking</h2>
        {ranking.length === 0 ? <p className={styles.muted}>Todavía no hay puntos.</p> : null}
        {ranking.map((row, index) => (
          <div key={`${row.nickname}-${index}`} className={`${styles.rankRow} ${row.isMe ? styles.rankRowMe : ''}`}>
            <span className={styles.rankPosition}>{index + 1}º</span>
            <span className={styles.rankName}>
              {row.nickname}
              {row.team ? <span className={styles.rankTeam}> · {row.team}</span> : null}
              {row.isMe ? ' (vos)' : ''}
            </span>
            <span className={styles.rankScore}>{row.score}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Resumen final + tarjeta de recuerdo ──
function FinalSummary({ state }: { state: ParticipantStateResponse }) {
  const summary = state.summary
  const me = state.me
  return (
    <>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>🏁 ¡Recorrido finalizado!</h2>
        <p className={styles.muted}>Gracias por pedalear la historia de San Miguel de Tucumán.</p>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryStat}>
            <strong>{summary?.distanceKm ?? 0} km</strong>
            <span className={styles.muted}>recorridos</span>
          </div>
          <div className={styles.summaryStat}>
            <strong>
              {summary?.stopsCompleted ?? 0}/{summary?.totalStops ?? 0}
            </strong>
            <span className={styles.muted}>paradas</span>
          </div>
          <div className={styles.summaryStat}>
            <strong>{me?.score ?? 0}</strong>
            <span className={styles.muted}>puntos</span>
          </div>
        </div>
        <div className={styles.summaryGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className={styles.summaryStat}>
            <strong>
              {me?.correctAnswers ?? 0}/{me?.totalAnswers ?? 0}
            </strong>
            <span className={styles.muted}>respuestas correctas</span>
          </div>
          <div className={styles.summaryStat}>
            <strong>{me?.position ? `${me.position}º` : '-'}</strong>
            <span className={styles.muted}>en el ranking</span>
          </div>
        </div>
      </div>
      {me ? <MemoryCard state={state} /> : null}
    </>
  )
}

// ── Tarjeta personalizada de recuerdo (canvas 1080x1350, sin datos internos) ──
function MemoryCard({ state }: { state: ParticipantStateResponse }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const buildCardData = useCallback((): BicitourMemoryCardData => {
    const me = state.me
    const ranking = state.ranking || []
    return {
      routeTitle: state.session?.routeTitle || 'Bicitour',
      nickname: me?.nickname || 'Participante',
      team: me?.team || null,
      dateLabel: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
      score: me?.score ?? 0,
      position: me?.position ?? 0,
      totalParticipants: Math.max(ranking.length, me?.position ?? 0),
      stopsCompleted: state.summary?.stopsCompleted ?? state.progress?.completed ?? 0,
      totalStops: state.summary?.totalStops ?? state.progress?.total ?? 0,
      distanceKm: state.summary?.distanceKm ?? 0,
      badges: (me?.badges || []).map((badge) => ({ emoji: badge.emoji, name: badge.name })),
      track: state.track || [],
      stops: (state.stops || []).map((stop) => [stop.lat, stop.lng] as [number, number]),
    }
  }, [state])

  const renderCard = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    try {
      const canvas = canvasRef.current || document.createElement('canvas')
      canvasRef.current = canvas
      const logo = await loadCardLogo()
      drawBicitourMemoryCard(canvas, buildCardData(), logo)
      return canvas
    } catch {
      setError('No se pudo generar la tarjeta. Probá de nuevo.')
      return null
    }
  }, [buildCardData])

  // Vista previa automática (se regenera si llegan insignias nuevas).
  const badgeCount = state.me?.badges.length ?? 0
  useEffect(() => {
    let cancelled = false
    renderCard().then((canvas) => {
      if (canvas && !cancelled) setPreviewUrl(canvas.toDataURL('image/png'))
    })
    return () => {
      cancelled = true
    }
  }, [renderCard, badgeCount])

  const toBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))

  const fileName = 'bicitour-smt-recuerdo.png'

  const handleDownload = async () => {
    setWorking(true)
    setError(null)
    try {
      const canvas = await renderCard()
      if (!canvas) return
      const blob = await toBlob(canvas)
      if (!blob) throw new Error('sin blob')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar la tarjeta.')
    } finally {
      setWorking(false)
    }
  }

  const handleShare = async () => {
    setWorking(true)
    setError(null)
    try {
      const canvas = await renderCard()
      if (!canvas) return
      const blob = await toBlob(canvas)
      if (!blob) throw new Error('sin blob')
      const file = new File([blob], fileName, { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'Bicitour San Miguel de Tucumán',
          text: '¡Completé el Bicitour de San Miguel de Tucumán! 🚲',
        })
      } else {
        // Compartir no disponible: se ofrece la descarga como alternativa.
        await handleDownload()
      }
    } catch (shareError) {
      // Cancelar el diálogo de compartir no es un error.
      if (!(shareError instanceof DOMException && shareError.name === 'AbortError')) {
        setError('No se pudo compartir. Podés descargarla e enviarla vos.')
      }
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>📸 Tu recuerdo del Bicitour</h2>
      <p className={styles.muted}>Una tarjeta con tu recorrido, lista para compartir.</p>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Tarjeta de recuerdo del Bicitour de ${state.me?.nickname || 'participante'}`}
          className={styles.cardPreview}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          style={{ height: 'auto', marginTop: 10 }}
        />
      ) : (
        <p className={styles.muted} style={{ textAlign: 'center', padding: 20 }}>
          Generando la tarjeta…
        </p>
      )}
      {error ? <p className={styles.error} style={{ marginTop: 10 }}>{error}</p> : null}
      <div className={styles.cardActions}>
        <button className={styles.secondaryButton} onClick={handleDownload} disabled={working}>
          {working ? 'Un momento…' : '⬇️ Descargar recuerdo'}
        </button>
        <button className={styles.primaryButton} onClick={handleShare} disabled={working}>
          {working ? 'Un momento…' : '📤 Compartir'}
        </button>
      </div>
    </div>
  )
}
