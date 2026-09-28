// Utilidades del chat web de Migue: conversación guardada en el navegador,
// preparación de fotos y notas de voz, y lectura del formato de las respuestas.

export type MigueLanguage = 'es' | 'en'
export type MigueMessageKind = 'text' | 'image' | 'audio'

export interface MigueMessage {
  id: string
  role: 'user' | 'bot'
  kind: MigueMessageKind
  text: string
  // Miniatura de la foto enviada (JPEG chico, se guarda con la conversación)
  thumbnail?: string
  // Mensaje del turista que no llegó a Migue: se muestra con "Reintentar"
  failed?: boolean
}

export interface MigueStoredChat {
  sessionId: string
  messages: MigueMessage[]
}

export const MIGUE_STORAGE_KEY = 'migue-chat-v1'
export const MIGUE_TEASER_KEY = 'migue-chat-teaser-dismissed'
// Mismo idioma que eligió el turista en /turistico
export const TOURIST_LANGUAGE_KEY = 'tourist-bus-language'
export const TOURIST_LANGUAGE_EVENT = 'tourist-language-change'

const MAX_STORED_MESSAGES = 60
export const MAX_AUDIO_SECONDS = 60
export const MIN_AUDIO_SECONDS = 0.8
export const MAX_TEXT_CHARS = 1000

export function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Fallback para contextos sin randomUUID: UUID v4 con getRandomValues
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createMessageId(): string {
  return createSessionId()
}

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function loadStoredChat(): MigueStoredChat | null {
  try {
    const raw = window.localStorage.getItem(MIGUE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MigueStoredChat
    if (!parsed || typeof parsed.sessionId !== 'string' || !SESSION_ID_RE.test(parsed.sessionId)) return null
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(
          m => m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string',
        )
      : []
    return { sessionId: parsed.sessionId, messages }
  } catch {
    return null
  }
}

export function saveStoredChat(chat: MigueStoredChat) {
  const messages = chat.messages.slice(-MAX_STORED_MESSAGES)
  try {
    window.localStorage.setItem(MIGUE_STORAGE_KEY, JSON.stringify({ ...chat, messages }))
  } catch {
    // Sin lugar (o almacenamiento bloqueado): se intenta sin las miniaturas.
    try {
      const light = messages.map(({ thumbnail: _thumbnail, ...rest }) => rest)
      window.localStorage.setItem(MIGUE_STORAGE_KEY, JSON.stringify({ ...chat, messages: light }))
    } catch {
      // La conversación sigue en pantalla aunque no se pueda guardar.
    }
  }
}

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Almacenamiento bloqueado: no es crítico.
  }
}

// ── Fotos ──
// Se achican y pasan a JPEG antes de subirlas: una foto de celular pesa varios
// MB y al modelo le alcanza con ~1280 px para reconocer un edificio.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_decode_failed'))
    img.src = src
  })
}

function drawToJpeg(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas_unavailable')
  // Fondo blanco: los PNG con transparencia quedarían negros en JPEG
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

export async function prepareImage(file: File): Promise<{ dataUrl: string; thumbnail: string }> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    return {
      dataUrl: drawToJpeg(img, 1280, 0.82),
      thumbnail: drawToJpeg(img, 240, 0.7),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// ── Notas de voz ──
// Cada navegador graba en su formato (webm en Chrome, mp4 en Safari, ogg en
// Firefox) y no todos los entiende el modelo. Se decodifica lo grabado y se
// reenvía como WAV mono de 16 kHz, que funciona siempre y alcanza para voz.

type AudioContextConstructor = typeof AudioContext

function getAudioContextClass(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor }
  return w.AudioContext || w.webkitAudioContext || null
}

export function canRecordAudio(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!getAudioContextClass() &&
    typeof window.OfflineAudioContext !== 'undefined'
  )
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // tamaño del bloque fmt
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // bytes por segundo
  view.setUint16(32, 2, true) // bytes por muestra
  view.setUint16(34, 16, true) // bits por muestra
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('read_failed'))
    reader.readAsDataURL(blob)
  })
}

export async function recordingToWav(recording: Blob): Promise<{ dataUrl: string; seconds: number }> {
  const AudioContextClass = getAudioContextClass()
  if (!AudioContextClass) throw new Error('audio_unsupported')

  const context = new AudioContextClass()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(await recording.arrayBuffer())
  } finally {
    context.close().catch(() => {})
  }

  const seconds = Math.min(decoded.duration, MAX_AUDIO_SECONDS)
  const sampleRate = 16000
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination) // la mezcla a mono la hace el destino de 1 canal
  source.start()
  const rendered = await offline.startRendering()

  const wav = encodeWav(rendered.getChannelData(0), sampleRate)
  return { dataUrl: await blobToDataUrl(new Blob([wav], { type: 'audio/wav' })), seconds }
}

// ── Formato de las respuestas ──
// El modelo contesta con un Markdown mínimo (**negrita**, listas con guion y
// links). Se interpreta a una estructura simple que el componente dibuja con
// React, sin HTML crudo: el texto nunca se inyecta como markup.

export type RichInline =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: RichInline[] }
  | { type: 'link'; href: string; label: string }

export type RichBlock =
  | { type: 'paragraph'; lines: RichInline[][] }
  | { type: 'list'; items: RichInline[][] }

// A veces el modelo mezcla etiquetas HTML: se pasan a los marcadores de arriba
// (mismo criterio que el envío por Telegram).
function normalizeModelHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(strong|b)>/gi, '**')
    .replace(/<a\s+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, '\n')
    .replace(/<\/?(em|i|u|s|del|ins|span|p|div|ul|ol|code|h[1-6])(\s[^>]*)?>/gi, '')
}

const TRAILING_PUNCTUATION = /[.,;:!?¿¡"'»)\]]+$/
// Sin lookbehind: Safari anterior a 16.4 no lo soporta y rompería todo el bundle.
const INLINE_RE =
  /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)|\*([^\s*](?:[^*\n]*[^\s*])?)\*/g

function parseInline(text: string, allowBold = true): RichInline[] {
  const result: RichInline[] = []
  const pushText = (value: string) => {
    if (!value) return
    const last = result[result.length - 1]
    if (last?.type === 'text') last.value += value
    else result.push({ type: 'text', value })
  }

  let cursor = 0
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0
    const [whole, bold, linkLabel, linkUrl, bareUrl, email, singleBold] = match
    const boldContent = bold ?? singleBold

    pushText(text.slice(cursor, index))
    cursor = index + whole.length

    if (boldContent !== undefined) {
      const children = parseInline(boldContent, false)
      if (allowBold) {
        result.push({ type: 'bold', children })
      } else {
        // Negrita dentro de algo que ya es negrita (un título "### **Casa Histórica**"):
        // se quitan los asteriscos y se conservan los links que haya adentro.
        for (const child of children) {
          if (child.type === 'text') pushText(child.value)
          else result.push(child)
        }
      }
    } else if (linkUrl) {
      result.push({ type: 'link', href: linkUrl, label: linkLabel })
    } else if (bareUrl) {
      // "Reservá en https://sitio/turistico." → el punto final no es parte del link
      const trailing = bareUrl.match(TRAILING_PUNCTUATION)?.[0] ?? ''
      const url = trailing ? bareUrl.slice(0, -trailing.length) : bareUrl
      result.push({ type: 'link', href: url, label: url.replace(/^https?:\/\//, '').replace(/\/$/, '') })
      pushText(trailing)
    } else if (email) {
      result.push({ type: 'link', href: `mailto:${email}`, label: email })
    }
  }
  pushText(text.slice(cursor))
  return result
}

const BULLET_RE = /^\s*[-*•]\s+/
const HEADING_RE = /^\s*#{1,6}\s+(.+)$/

export function parseRichText(text: string): RichBlock[] {
  const blocks: RichBlock[] = []
  const paragraphs = normalizeModelHtml(text)
    .split(/\n\s*\n/)
    .map(p => p.replace(/^\n+|\n+$/g, ''))
    .filter(p => p.trim())

  for (const paragraph of paragraphs) {
    let lines: RichInline[][] = []
    let items: RichInline[][] = []
    const flushLines = () => {
      if (lines.length) blocks.push({ type: 'paragraph', lines })
      lines = []
    }
    const flushItems = () => {
      if (items.length) blocks.push({ type: 'list', items })
      items = []
    }

    for (const rawLine of paragraph.split('\n')) {
      if (!rawLine.trim()) continue
      const heading = rawLine.match(HEADING_RE)
      if (BULLET_RE.test(rawLine)) {
        flushLines()
        items.push(parseInline(rawLine.replace(BULLET_RE, '')))
      } else {
        flushItems()
        lines.push(heading ? [{ type: 'bold', children: parseInline(heading[1], false) }] : parseInline(rawLine.trim()))
      }
    }
    flushLines()
    flushItems()
  }
  return blocks
}
