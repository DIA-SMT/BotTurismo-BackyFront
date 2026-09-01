// ── Bicitour en vivo: tipos y helpers compartidos entre cliente y servidor ──
//
// Sincronización en tiempo real: el proyecto no expone Supabase al navegador
// (RLS solo-service-key), así que la sesión se sincroniza por POLLING
// VERSIONADO contra las API routes: cada acción del guía incrementa
// `bicitour_sessions.version` y los clientes piden el estado solo cuando la
// versión cambió. A escala de un grupo de bicitour (20-40 personas cada 2,5 s)
// es liviano y muy tolerante a cortes de señal. Si algún día se necesita push
// real, el punto de reemplazo es `fetchState` en los componentes cliente.

export type BicitourRouteStatus = 'draft' | 'published' | 'archived'
export type BicitourMode = 'individual' | 'teams' | 'mixed'
export type BicitourSessionStatus = 'lobby' | 'active' | 'paused' | 'finished'
export type BicitourStopStatus = 'locked' | 'open' | 'question_active' | 'question_closed' | 'completed' | 'skipped'
export type BicitourQuestionType = 'multiple_choice' | 'true_false'

export interface BicitourRoute {
  id: number
  title: string
  description: string | null
  status: BicitourRouteStatus
  mode: BicitourMode
  path: [number, number][]
  created_at: string
  updated_at: string
}

export interface BicitourStop {
  id: number
  route_id: number
  position: number
  title: string
  description: string | null
  fun_facts: string[]
  image_urls: string[]
  audio_url: string | null
  /** Pista que anticipa ESTA parada sin nombrarla (pertenece al destino). */
  hint: string | null
  hint_enabled: boolean
  lat: number
  lng: number
  radius_m: number
  is_draft: boolean
}

export type BicitourQuestionOrigin = 'manual' | 'ai'
export type BicitourQuestionCategory = 'historica' | 'cultural' | 'arquitectonica' | 'observacion'

export const bicitourQuestionCategoryLabels: Record<BicitourQuestionCategory, string> = {
  historica: 'Histórica',
  cultural: 'Cultural',
  arquitectonica: 'Arquitectónica',
  observacion: 'Observación',
}

export interface BicitourQuestionOption {
  key: string
  label: string
}

export interface BicitourQuestion {
  id: number
  stop_id: number
  position: number
  type: BicitourQuestionType
  prompt: string
  options: BicitourQuestionOption[]
  correct_key: string
  explanation: string | null
  points: number
  origin: BicitourQuestionOrigin
  category: BicitourQuestionCategory
  source_excerpt: string | null
}

export interface BicitourQuestionProposal {
  id: number
  stop_id: number
  status: 'pending' | 'approved' | 'rejected'
  type: BicitourQuestionType
  prompt: string
  options: BicitourQuestionOption[]
  correct_key: string
  explanation: string | null
  difficulty: 'facil' | 'intermedia' | 'dificil'
  category: BicitourQuestionCategory
  source_excerpt: string | null
  warning: string | null
  created_at: string
}

export interface BicitourSession {
  id: number
  code: string
  route_id: number
  status: BicitourSessionStatus
  mode: BicitourMode
  teams: string[]
  gps_enabled: boolean
  announcement: string | null
  announcement_at: string | null
  group_bonus_awarded: boolean
  version: number
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface BicitourSessionStop {
  id: number
  session_id: number
  stop_id: number
  position: number
  status: BicitourStopStatus
  active_question_id: number | null
  opened_at: string | null
  completed_at: string | null
}

export interface BicitourParticipant {
  id: number
  session_id: number
  token: string
  nickname: string
  team: string | null
  score: number
  joined_at: string
  last_seen_at: string
}

// ── Estado que reciben los participantes por polling ──

export interface ParticipantStopView {
  sessionStopId: number
  stopId: number
  position: number
  title: string
  status: BicitourStopStatus
  lat: number
  lng: number
  // El contenido llega SOLO cuando el guía abrió la parada.
  content?: {
    description: string | null
    funFacts: string[]
    imageUrls: string[]
    audioUrl: string | null
  }
  question?: {
    id: number
    type: BicitourQuestionType
    prompt: string
    options: BicitourQuestionOption[]
    points: number
    answeredCount: number
  }
  reveal?: {
    questionId: number
    correctKey: string
    explanation: string | null
    prompt: string
    options: BicitourQuestionOption[]
  }
}

export interface ParticipantRankingRow {
  nickname: string
  team: string | null
  score: number
  isMe: boolean
}

export interface ParticipantStateResponse {
  version: number
  unchanged?: boolean
  session?: {
    status: BicitourSessionStatus
    mode: BicitourMode
    teams: string[]
    routeTitle: string
    gpsActive: boolean
    announcement: { text: string; at: string } | null
  }
  stops?: ParticipantStopView[]
  openStop?: ParticipantStopView | null
  myAnswerKey?: string | null
  hint?: string | null
  path?: [number, number][]
  track?: [number, number][]
  progress?: { completed: number; total: number }
  me?: {
    nickname: string
    team: string | null
    score: number
    /** Posición en el ranking general (1 = primero). */
    position: number
    stamps: { stopId: number | null; label: string }[]
    correctAnswers: number
    totalAnswers: number
    badges: { key: string; name: string; emoji: string; reason: string; awardedAt: string }[]
    badgeProgress: {
      key: string
      name: string
      emoji: string
      description: string
      earned: boolean
      progress: number
      progressText: string
    }[]
  }
  ranking?: ParticipantRankingRow[]
  teamRanking?: { team: string; score: number; members: number }[]
  summary?: {
    distanceKm: number
    stopsCompleted: number
    totalStops: number
  } | null
}

// ── Helpers ──

const EARTH_RADIUS_M = 6371000

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

export function trackDistanceKm(points: [number, number][]) {
  let meters = 0
  for (let i = 1; i < points.length; i += 1) {
    meters += distanceMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
  }
  return Math.round((meters / 1000) * 100) / 100
}

// Reduce una polilínea a como máximo maxPoints, conservando extremos.
export function decimateTrack(points: [number, number][], maxPoints = 300): [number, number][] {
  if (points.length <= maxPoints) return points
  const stride = Math.ceil(points.length / maxPoints)
  const result: [number, number][] = []
  for (let i = 0; i < points.length; i += stride) result.push(points[i])
  if (result[result.length - 1] !== points[points.length - 1]) result.push(points[points.length - 1])
  return result
}

// Código corto de ingreso, sin caracteres ambiguos (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateSessionCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

export const bicitourStopStatusLabels: Record<BicitourStopStatus, string> = {
  locked: 'Bloqueada',
  open: 'Parada actual',
  question_active: 'Pregunta activa',
  question_closed: 'Pregunta cerrada',
  completed: 'Completada',
  skipped: 'Omitida',
}

export const bicitourSessionStatusLabels: Record<BicitourSessionStatus, string> = {
  lobby: 'En espera',
  active: 'Activa',
  paused: 'Pausada',
  finished: 'Finalizada',
}

export const BICITOUR_GROUP_BONUS_POINTS = 150
export const BICITOUR_COMPLETION_BADGE_LABEL = 'Recorrido completo'

export function normalizeNickname(raw: string) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24)
}

export function sanitizeLatLng(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const lat = Number(value[0])
  const lng = Number(value[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

export function sanitizePath(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return []
  return value.map(sanitizeLatLng).filter((point): point is [number, number] => point !== null).slice(0, 5000)
}

export function sanitizeStringArray(value: unknown, maxItems = 12, maxLength = 500): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

export function sanitizeQuestionOptions(value: unknown): BicitourQuestionOption[] {
  if (!Array.isArray(value)) return []
  return value
    .map((option) => {
      if (!option || typeof option !== 'object') return null
      const key = String((option as Record<string, unknown>).key || '').trim().slice(0, 12)
      const label = String((option as Record<string, unknown>).label || '').trim().slice(0, 300)
      if (!key || !label) return null
      return { key, label }
    })
    .filter((option): option is BicitourQuestionOption => option !== null)
    .slice(0, 6)
}
