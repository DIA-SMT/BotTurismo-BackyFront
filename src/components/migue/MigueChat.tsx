'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Camera, Mic, RotateCcw, Send, Square, X } from 'lucide-react'
import styles from './migue-chat.module.css'
import {
  MAX_AUDIO_SECONDS,
  MAX_TEXT_CHARS,
  MIGUE_TEASER_KEY,
  MIN_AUDIO_SECONDS,
  TOURIST_LANGUAGE_EVENT,
  TOURIST_LANGUAGE_KEY,
  canRecordAudio,
  createMessageId,
  createSessionId,
  loadStoredChat,
  parseRichText,
  prepareImage,
  readStorage,
  recordingToWav,
  saveStoredChat,
  writeStorage,
} from '@/lib/migue-chat'
import type { MigueLanguage, MigueMessage, MigueMessageKind, RichInline } from '@/lib/migue-chat'

// Chat de Migue Turista en el sitio: mismo asistente que WhatsApp y Telegram
// (backend del bot, endpoint /api/chat/web). Sin NEXT_PUBLIC_MIGUE_CHAT_URL no
// se muestra, así el sitio se puede publicar antes que el backend.
const CHAT_URL = process.env.NEXT_PUBLIC_MIGUE_CHAT_URL || ''

// Paneles, sesiones en vivo y galerías privadas: ahí el chat estorba.
const HIDDEN_PREFIXES = ['/admin', '/login', '/update-password', '/bicitour', '/fotos', '/faqs', '/interactions']
// Donde aparece el globito de bienvenida la primera vez
const TEASER_PATHS = ['/', '/turistico']

const REQUEST_TIMEOUT_MS = 90_000

type Payload =
  | { kind: 'text'; text: string }
  | { kind: 'image'; media: string; caption: string }
  | { kind: 'audio'; media: string }

type ErrorCode =
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'busy'
  | 'payload_too_large'
  | 'invalid_media'
  | 'message_too_long'
  | 'bot_error'

const COPY = {
  es: {
    name: 'Migue',
    subtitle: 'Asistente turístico · Municipalidad de SMT',
    launcherLabel: '¿Consultas? Hablá con Migue',
    close: 'Cerrar chat',
    newChat: 'Nueva conversación',
    newChatConfirm: '¿Empezar una conversación nueva? Se borra la actual.',
    welcome: `¡Hola! 👋 Soy **Migue**, el asistente turístico oficial de la Dirección de Turismo de San Miguel de Tucumán.

Preguntame qué visitar, dónde comer o dormir, la agenda cultural o cómo reservar el Bus Turístico (es gratis).

También podés mandarme una nota de voz 🎙️, o una foto de un edificio o lugar de la ciudad y te cuento su historia 📸`,
    suggestions: [
      '¿Qué circuitos tiene el Bus Turístico?',
      '¿Dónde como empanadas tucumanas?',
      '¿Qué hay para hacer este fin de semana?',
      '¿Qué visito si tengo un solo día?',
    ],
    teaser: '¡Hola! Soy Migue 👋 ¿Te ayudo a planear tu recorrido?',
    dismissTeaser: 'Cerrar mensaje',
    placeholder: 'Escribile a Migue…',
    captionPlaceholder: 'Agregá un comentario (opcional)…',
    send: 'Enviar',
    attachPhoto: 'Mandar una foto',
    removePhoto: 'Quitar foto',
    record: 'Grabar nota de voz',
    stopRecording: 'Terminar y enviar',
    cancelRecording: 'Cancelar grabación',
    recording: 'Grabando',
    processingAudio: 'Preparando la nota de voz…',
    voiceNote: 'Nota de voz',
    photo: 'Foto',
    typing: 'Migue está escribiendo',
    lookingPhoto: 'Migue está mirando tu foto',
    listening: 'Migue está escuchando tu nota de voz',
    retry: 'Reintentar',
    notSent: 'No se envió.',
    disclaimer: 'Migue responde con inteligencia artificial y puede equivocarse. No compartas datos personales.',
    micDenied: 'Necesito permiso para usar el micrófono. Podés habilitarlo desde la configuración del navegador.',
    micUnavailable: 'No encontré un micrófono disponible.',
    micUnsupported: 'Tu navegador no permite grabar notas de voz. Podés escribirme o mandarme una foto.',
    audioTooShort: 'La nota de voz es muy corta. Mantené la grabación un poco más.',
    audioFailed: 'No pude preparar la nota de voz. Probá de nuevo o escribime.',
    imageFailed: 'No pude leer esa imagen. Probá con otra foto (JPG o PNG).',
    errors: {
      network: 'No me pude conectar. Revisá tu conexión y probá de nuevo.',
      timeout: 'Tardé demasiado en responder. Probá de nuevo.',
      rate_limited: 'Recibí muchos mensajes seguidos. Esperá un momento y volvé a escribirme.',
      busy: 'Todavía estoy respondiendo tu mensaje anterior.',
      payload_too_large: 'El archivo es demasiado pesado.',
      invalid_media: 'No pude leer el archivo que mandaste.',
      message_too_long: `El mensaje es muy largo (máximo ${MAX_TEXT_CHARS} caracteres).`,
      bot_error: 'Tuve un problema para responderte. Probá de nuevo en un ratito o escribinos a turismo@smt.gob.ar',
    } satisfies Record<ErrorCode, string>,
  },
  en: {
    name: 'Migue',
    subtitle: 'Tourist assistant · City of San Miguel de Tucumán',
    launcherLabel: 'Questions? Ask Migue',
    close: 'Close chat',
    newChat: 'New conversation',
    newChatConfirm: 'Start a new conversation? The current one will be deleted.',
    welcome: `Hi! 👋 I'm **Migue**, the official tourist assistant of the San Miguel de Tucumán Tourism Office.

Ask me what to visit, where to eat or stay, what's on in the cultural agenda, or how to book the Tourist Bus (it's free).

You can also send me a voice note 🎙️, or a photo of a building or place in the city and I'll tell you its story 📸`,
    suggestions: [
      'Which Tourist Bus tours are available?',
      'Where can I eat empanadas?',
      "What's on this weekend?",
      'What should I see if I only have one day?',
    ],
    teaser: "Hi! I'm Migue 👋 Can I help you plan your visit?",
    dismissTeaser: 'Dismiss message',
    placeholder: 'Write to Migue…',
    captionPlaceholder: 'Add a comment (optional)…',
    send: 'Send',
    attachPhoto: 'Send a photo',
    removePhoto: 'Remove photo',
    record: 'Record a voice note',
    stopRecording: 'Finish and send',
    cancelRecording: 'Cancel recording',
    recording: 'Recording',
    processingAudio: 'Preparing your voice note…',
    voiceNote: 'Voice note',
    photo: 'Photo',
    typing: 'Migue is typing',
    lookingPhoto: 'Migue is looking at your photo',
    listening: 'Migue is listening to your voice note',
    retry: 'Retry',
    notSent: 'Not sent.',
    disclaimer: 'Migue answers using artificial intelligence and can make mistakes. Please don’t share personal data.',
    micDenied: 'I need permission to use your microphone. You can enable it in your browser settings.',
    micUnavailable: 'No microphone was found.',
    micUnsupported: "Your browser can't record voice notes. You can type or send me a photo instead.",
    audioTooShort: 'That voice note is too short. Please record a bit longer.',
    audioFailed: "I couldn't prepare your voice note. Try again or type your question.",
    imageFailed: "I couldn't read that image. Try another photo (JPG or PNG).",
    errors: {
      network: "I couldn't connect. Check your connection and try again.",
      timeout: 'I took too long to answer. Please try again.',
      rate_limited: 'I got too many messages in a row. Please wait a moment and write again.',
      busy: "I'm still answering your previous message.",
      payload_too_large: 'That file is too large.',
      invalid_media: "I couldn't read the file you sent.",
      message_too_long: `That message is too long (up to ${MAX_TEXT_CHARS} characters).`,
      bot_error: 'I had a problem answering. Please try again shortly or email turismo@smt.gob.ar',
    } satisfies Record<ErrorCode, string>,
  },
} as const

type Copy = (typeof COPY)[MigueLanguage]

function detectLanguage(): MigueLanguage {
  const stored = readStorage(TOURIST_LANGUAGE_KEY)
  if (stored === 'es' || stored === 'en') return stored
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

function formatSeconds(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const ERROR_CODES = new Set<ErrorCode>([
  'rate_limited',
  'busy',
  'payload_too_large',
  'invalid_media',
  'message_too_long',
  'bot_error',
])

async function postToMigue(
  sessionId: string,
  payload: Payload,
): Promise<{ ok: true; reply: string } | { ok: false; code: ErrorCode | 'invalid_session' }> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...payload }),
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => null)) as { reply?: string; error?: string } | null
    if (response.ok && typeof data?.reply === 'string') return { ok: true, reply: data.reply }
    if (data?.error === 'invalid_session') return { ok: false, code: 'invalid_session' }
    if (data?.error && ERROR_CODES.has(data.error as ErrorCode)) return { ok: false, code: data.error as ErrorCode }
    // Respuestas sin JSON (por ejemplo, el 413 de nginx)
    if (response.status === 413) return { ok: false, code: 'payload_too_large' }
    if (response.status === 429) return { ok: false, code: 'rate_limited' }
    return { ok: false, code: 'bot_error' }
  } catch (err) {
    return { ok: false, code: (err as Error)?.name === 'AbortError' ? 'timeout' : 'network' }
  } finally {
    window.clearTimeout(timer)
  }
}

// ── Texto de las respuestas ──

function isSameOrigin(href: string) {
  try {
    return new URL(href, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

function renderInline(nodes: RichInline[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    if (node.type === 'text') return <Fragment key={key}>{node.value}</Fragment>
    if (node.type === 'bold') return <strong key={key}>{renderInline(node.children, key)}</strong>
    const external = !node.href.startsWith('mailto:') && !isSameOrigin(node.href)
    return (
      <a
        key={key}
        href={node.href}
        className={styles.link}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {node.label}
      </a>
    )
  })
}

function RichText({ text }: { text: string }) {
  const blocks = useMemo(() => parseRichText(text), [text])
  return (
    <>
      {blocks.map((block, blockIndex) =>
        block.type === 'list' ? (
          <ul key={blockIndex} className={styles.list}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item, `${blockIndex}-${itemIndex}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={blockIndex} className={styles.paragraph}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </>
  )
}

// ── Componente ──

export function MigueChat() {
  const pathname = usePathname() || '/'
  const hidden = !CHAT_URL || HIDDEN_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (hidden) return null
  return <MigueChatWidget pathname={pathname} />
}

type RecordingState = 'idle' | 'recording' | 'processing'

function MigueChatWidget({ pathname }: { pathname: string }) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState<MigueLanguage>('es')
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<MigueMessage[]>([])
  const [draft, setDraft] = useState('')
  const [stagedImage, setStagedImage] = useState<{ dataUrl: string; thumbnail: string } | null>(null)
  const [pendingKind, setPendingKind] = useState<MigueMessageKind | null>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [notice, setNotice] = useState('')
  const [showTeaser, setShowTeaser] = useState(false)

  const copy: Copy = COPY[language]
  const pending = pendingKind !== null

  const panelRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  // Contenido de los mensajes que fallaron (fotos y audio no se guardan en el navegador)
  const failedPayloads = useRef(new Map<string, Payload>())
  const sessionRef = useRef('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardRecordingRef = useRef(false)
  const recordTimerRef = useRef<number | null>(null)
  // Pedido de micrófono en curso (el permiso puede tardar): evita dos
  // grabaciones a la vez y descarta el micrófono si el chat se cerró mientras tanto.
  const startingMicRef = useRef(false)
  const micRequestRef = useRef(0)
  const returnFocusRef = useRef(false)
  const stopButtonRef = useRef<HTMLButtonElement>(null)

  // 1. Restaurar la conversación y el idioma (solo en el navegador)
  useEffect(() => {
    const stored = loadStoredChat()
    const id = stored?.sessionId || createSessionId()
    sessionRef.current = id
    setSessionId(id)
    // Si la página se recargó mientras Migue respondía, esa respuesta se perdió:
    // el último mensaje queda como no enviado para poder reintentarlo.
    const restored = stored?.messages || []
    const last = restored[restored.length - 1]
    setMessages(
      last?.role === 'user' && !last.failed ? [...restored.slice(0, -1), { ...last, failed: true }] : restored,
    )
    setLanguage(detectLanguage())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready && sessionId) saveStoredChat({ sessionId, messages })
  }, [ready, sessionId, messages])

  // 2. Idioma sincronizado con el selector ES/EN de /turistico
  useEffect(() => {
    const onLanguage = (event: Event) => {
      const value = (event as CustomEvent<string>).detail
      if (value === 'es' || value === 'en') setLanguage(value)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOURIST_LANGUAGE_KEY && (event.newValue === 'es' || event.newValue === 'en')) {
        setLanguage(event.newValue)
      }
    }
    window.addEventListener(TOURIST_LANGUAGE_EVENT, onLanguage)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(TOURIST_LANGUAGE_EVENT, onLanguage)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // 3. Globito de bienvenida: una sola vez, a quien todavía no habló con Migue
  useEffect(() => {
    if (!ready || open || messages.length > 0 || !TEASER_PATHS.includes(pathname)) return
    if (readStorage(MIGUE_TEASER_KEY)) return
    const timer = window.setTimeout(() => setShowTeaser(true), 4000)
    return () => window.clearTimeout(timer)
  }, [ready, open, messages.length, pathname])

  const dismissTeaser = useCallback(() => {
    setShowTeaser(false)
    writeStorage(MIGUE_TEASER_KEY, '1')
  }, [])

  // 4. Foco dentro del chat: en el campo si hay mouse; en celular, en el panel
  //    (enfocar el campo abriría el teclado).
  const focusInside = useCallback(() => {
    if (window.matchMedia?.('(pointer: fine)').matches && inputRef.current) inputRef.current.focus()
    else panelRef.current?.focus()
  }, [])

  useEffect(() => {
    if (open) focusInside()
  }, [open, focusInside])

  // Celular: con el teclado abierto el navegador solo achica el área visible
  // (visual viewport) y el panel quedaría con el encabezado tapado. Se ajusta
  // el panel a esa área.
  useEffect(() => {
    const viewport = window.visualViewport
    const panel = panelRef.current
    if (!open || !viewport || !panel) return
    const narrow = window.matchMedia('(max-width: 560px)')
    const sync = () => {
      if (narrow.matches) {
        panel.style.setProperty('--migue-vv-top', `${viewport.offsetTop}px`)
        panel.style.setProperty('--migue-vv-height', `${viewport.height}px`)
      } else {
        panel.style.removeProperty('--migue-vv-top')
        panel.style.removeProperty('--migue-vv-height')
      }
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [open])

  // Respuesta nueva de Migue: se muestra desde su comienzo (suelen ser largas);
  // en cualquier otro caso, al final de la conversación.
  const lastMessage = messages[messages.length - 1]
  const lastBubbleRef = useRef<HTMLDivElement>(null)
  const scrolledReplyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) return
    if (lastMessage?.role === 'bot' && scrolledReplyRef.current !== lastMessage.id && scrolledReplyRef.current !== null) {
      scrolledReplyRef.current = lastMessage.id
      lastBubbleRef.current?.scrollIntoView({ block: 'start' })
      return
    }
    scrolledReplyRef.current = lastMessage?.id ?? ''
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [open, lastMessage, pendingKind, stagedImage, notice])

  // El campo crece con el texto hasta ~5 líneas
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    // scrollHeight no incluye el borde: sin sumarlo, el campo queda 2 px corto
    // y aparece la barra de scroll aunque el texto entre.
    const border = input.offsetHeight - input.clientHeight
    input.style.height = 'auto'
    const wanted = input.scrollHeight + border
    input.style.height = `${Math.min(wanted, 120)}px`
    input.style.overflowY = wanted > 120 ? 'auto' : 'hidden'
  }, [draft, open, recordingState])

  // El aviso (permiso de micrófono, imagen inválida...) se va solo
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 7000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const releaseMicrophone = useCallback(() => {
    if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  // Al desmontar (cambio a una página sin chat) se corta el micrófono
  useEffect(
    () => () => {
      micRequestRef.current++
      discardRecordingRef.current = true
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      releaseMicrophone()
    },
    [releaseMicrophone],
  )

  // ── Envío ──

  const deliver = useCallback(
    async (messageId: string, payload: Payload) => {
      setPendingKind(payload.kind)
      let result = await postToMigue(sessionRef.current, payload)
      if (!result.ok && result.code === 'invalid_session') {
        // Sesión corrupta: se genera otra y se reintenta una vez
        const id = createSessionId()
        sessionRef.current = id
        setSessionId(id)
        result = await postToMigue(id, payload)
      }
      setPendingKind(null)

      if (result.ok) {
        failedPayloads.current.delete(messageId)
        setMessages(prev => [
          ...prev.map(m => (m.id === messageId && m.failed ? { ...m, failed: false } : m)),
          { id: createMessageId(), role: 'bot', kind: 'text', text: result.reply },
        ])
        return
      }

      failedPayloads.current.set(messageId, payload)
      const code = result.code === 'invalid_session' ? 'bot_error' : result.code
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, failed: true } : m)))
      setNotice(COPY[language].errors[code])
    },
    [language],
  )

  const sendMessage = useCallback(
    (message: Omit<MigueMessage, 'id' | 'role'>, payload: Payload) => {
      if (pending) return
      const id = createMessageId()
      setNotice('')
      setMessages(prev => [...prev, { ...message, id, role: 'user' }])
      void deliver(id, payload)
    },
    [deliver, pending],
  )

  const retry = useCallback(
    (message: MigueMessage) => {
      if (pending || recordingState !== 'idle') return
      const payload =
        failedPayloads.current.get(message.id) ||
        (message.kind === 'text' ? ({ kind: 'text', text: message.text } as Payload) : null)
      if (!payload) return
      setNotice('')
      setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, failed: false } : m)))
      void deliver(message.id, payload)
      // El botón desaparece: el foco se queda dentro del chat
      focusInside()
    },
    [deliver, focusInside, pending, recordingState],
  )

  // Las sugerencias no se pueden usar mientras se graba: la nota de voz se
  // enviaría en paralelo al terminar.
  const sendSuggestion = (text: string) => {
    if (recordingState !== 'idle') return
    sendMessage({ kind: 'text', text }, { kind: 'text', text })
    focusInside()
  }

  const submit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault()
      if (pending || recordingState !== 'idle') return
      const text = draft.trim().slice(0, MAX_TEXT_CHARS)

      if (stagedImage) {
        sendMessage(
          { kind: 'image', text, thumbnail: stagedImage.thumbnail },
          { kind: 'image', media: stagedImage.dataUrl, caption: text },
        )
        setStagedImage(null)
        setDraft('')
        return
      }
      if (!text) return
      sendMessage({ kind: 'text', text }, { kind: 'text', text })
      setDraft('')
    },
    [draft, pending, recordingState, sendMessage, stagedImage],
  )

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // keyCode 229: Safari confirma una palabra del teclado japonés/chino con
    // Enter y no marca isComposing; ese Enter no debe enviar el mensaje.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault()
      submit()
    }
  }

  // ── Foto ──

  const onPickImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setStagedImage(await prepareImage(file))
      setNotice('')
      inputRef.current?.focus()
    } catch {
      setNotice(copy.imageFailed)
    }
  }

  // ── Nota de voz ──

  const finishRecording = useCallback(
    async (blob: Blob) => {
      setRecordingState('processing')
      try {
        const { dataUrl, seconds } = await recordingToWav(blob)
        if (seconds < MIN_AUDIO_SECONDS) {
          setNotice(COPY[language].audioTooShort)
          return
        }
        sendMessage({ kind: 'audio', text: formatSeconds(seconds) }, { kind: 'audio', media: dataUrl })
      } catch {
        setNotice(COPY[language].audioFailed)
      } finally {
        setRecordingState('idle')
      }
    },
    [language, sendMessage],
  )

  const startRecording = async () => {
    if (pending || recordingState !== 'idle' || startingMicRef.current || recorderRef.current) return
    if (!canRecordAudio()) {
      setNotice(copy.micUnsupported)
      return
    }

    startingMicRef.current = true
    const request = ++micRequestRef.current
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const name = (err as Error)?.name
      setNotice(name === 'NotAllowedError' || name === 'SecurityError' ? copy.micDenied : copy.micUnavailable)
      return
    } finally {
      startingMicRef.current = false
    }
    // El chat se cerró (o se cambió de página) mientras el navegador pedía permiso
    if (request !== micRequestRef.current) {
      stream.getTracks().forEach(track => track.stop())
      return
    }

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream)
    } catch {
      stream.getTracks().forEach(track => track.stop())
      setNotice(copy.micUnsupported)
      return
    }

    streamRef.current = stream
    recorderRef.current = recorder
    chunksRef.current = []
    discardRecordingRef.current = false

    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      releaseMicrophone()
      recorderRef.current = null
      if (discardRecordingRef.current) {
        setRecordingState('idle')
        return
      }
      void finishRecording(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
    }

    const startedAt = Date.now()
    setRecordSeconds(0)
    setNotice('')
    setRecordingState('recording')
    recorder.start()
    recordTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000
      setRecordSeconds(elapsed)
      // Tope de duración: se envía lo grabado
      if (elapsed >= MAX_AUDIO_SECONDS && recorder.state === 'recording') recorder.stop()
    }, 250)
  }

  const stopRecording = (discard: boolean) => {
    discardRecordingRef.current = discard
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    else {
      releaseMicrophone()
      setRecordingState('idle')
    }
  }

  // ── Abrir / cerrar ──

  const openChat = () => {
    setOpen(true)
    if (showTeaser) dismissTeaser()
    else writeStorage(MIGUE_TEASER_KEY, '1')
  }

  const closeChat = () => {
    micRequestRef.current++
    if (recordingState === 'recording') stopRecording(true)
    setOpen(false)
    returnFocusRef.current = true
  }

  // Al cerrar, el foco vuelve al botón de Migue (recién montado de nuevo)
  useEffect(() => {
    if (open || !returnFocusRef.current) return
    returnFocusRef.current = false
    launcherRef.current?.focus()
  }, [open])

  // Escape cierra el chat esté donde esté el foco: varios botones desaparecen
  // al usarlos (sugerencias, reintentar, micrófono) y el foco queda en la página.
  const closeChatRef = useRef(closeChat)
  closeChatRef.current = closeChat
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeChatRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Al grabar, el foco pasa a "Terminar y enviar"; al terminar, vuelve al chat
  useEffect(() => {
    if (!open) return
    if (recordingState === 'recording') stopButtonRef.current?.focus()
    else if (recordingState === 'idle' && document.activeElement === document.body) focusInside()
  }, [recordingState, open, focusInside])

  const startNewChat = () => {
    if (pending) return
    if (messages.length > 0 && !window.confirm(copy.newChatConfirm)) return
    const id = createSessionId()
    sessionRef.current = id
    failedPayloads.current.clear()
    setSessionId(id)
    setMessages([])
    setDraft('')
    setStagedImage(null)
    setNotice('')
  }

  const hasUserMessages = messages.some(m => m.role === 'user')
  const canSend = !pending && recordingState === 'idle' && (!!stagedImage || !!draft.trim())
  const pendingLabel =
    pendingKind === 'image' ? copy.lookingPhoto : pendingKind === 'audio' ? copy.listening : copy.typing

  if (!ready) return null

  return (
    <div className={styles.root}>
      {open && (
        <div
          ref={panelRef}
          id="migue-chat-panel"
          className={styles.panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby="migue-chat-title"
          tabIndex={-1}
        >
          <header className={styles.header}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/migue.jpg" alt="" className={styles.headerAvatar} width={44} height={44} />
            <div className={styles.headerText}>
              <h2 id="migue-chat-title" className={styles.headerTitle}>
                {copy.name}
                <span className={styles.onlineDot} aria-hidden="true" />
              </h2>
              <p className={styles.headerSubtitle}>{copy.subtitle}</p>
            </div>
            <button
              type="button"
              className={styles.headerButton}
              onClick={startNewChat}
              disabled={pending}
              aria-label={copy.newChat}
              title={copy.newChat}
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              className={styles.headerButton}
              onClick={closeChat}
              aria-label={copy.close}
              title={copy.close}
            >
              <X size={20} />
            </button>
          </header>

          <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={`${styles.bubble} ${styles.bubbleBot}`}>
                <RichText text={copy.welcome} />
              </div>
            </div>

            {!hasUserMessages && (
              <div className={styles.suggestions}>
                {copy.suggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    className={styles.suggestion}
                    disabled={pending || recordingState !== 'idle'}
                    onClick={() => sendSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={message.id}
                ref={index === messages.length - 1 ? lastBubbleRef : undefined}
                className={`${styles.row} ${message.role === 'user' ? styles.rowUser : styles.rowBot}`}
              >
                <div
                  className={`${styles.bubble} ${message.role === 'user' ? styles.bubbleUser : styles.bubbleBot} ${
                    message.failed ? styles.bubbleFailed : ''
                  }`.trim()}
                >
                  {message.role === 'bot' ? (
                    <RichText text={message.text} />
                  ) : message.kind === 'image' ? (
                    <>
                      {message.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={message.thumbnail} alt={copy.photo} className={styles.photo} />
                      ) : (
                        <span className={styles.mediaLabel}>
                          <Camera size={16} aria-hidden="true" /> {copy.photo}
                        </span>
                      )}
                      {message.text && <p className={styles.paragraph}>{message.text}</p>}
                    </>
                  ) : message.kind === 'audio' ? (
                    <span className={styles.mediaLabel}>
                      <Mic size={16} aria-hidden="true" /> {copy.voiceNote} · {message.text}
                    </span>
                  ) : (
                    <p className={styles.paragraph}>{message.text}</p>
                  )}
                </div>
                {message.failed && (
                  <div className={styles.failedNote}>
                    {copy.notSent}{' '}
                    {(failedPayloads.current.has(message.id) || message.kind === 'text') && (
                      <button
                        type="button"
                        className={styles.retryButton}
                        onClick={() => retry(message)}
                        disabled={pending || recordingState !== 'idle'}
                      >
                        {copy.retry}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {pending && (
              <div className={`${styles.row} ${styles.rowBot}`}>
                <div className={`${styles.bubble} ${styles.bubbleBot} ${styles.typing}`}>
                  <span className={styles.typingLabel}>{pendingLabel}</span>
                  <span className={styles.dots} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}

            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form className={styles.composer} onSubmit={submit}>
            {stagedImage && (
              <div className={styles.staged}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stagedImage.thumbnail} alt={copy.photo} className={styles.stagedImage} />
                <button
                  type="button"
                  className={styles.stagedRemove}
                  onClick={() => setStagedImage(null)}
                  aria-label={copy.removePhoto}
                  title={copy.removePhoto}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {recordingState === 'idle' ? (
              <div className={styles.inputRow}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={onPickImage}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                  aria-label={copy.attachPhoto}
                  title={copy.attachPhoto}
                >
                  <Camera size={20} />
                </button>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={stagedImage ? copy.captionPlaceholder : copy.placeholder}
                  aria-label={stagedImage ? copy.captionPlaceholder : copy.placeholder}
                  maxLength={MAX_TEXT_CHARS}
                  rows={1}
                />
                {draft.trim() || stagedImage ? (
                  <button
                    type="submit"
                    className={`${styles.iconButton} ${styles.sendButton}`}
                    disabled={!canSend}
                    aria-label={copy.send}
                    title={copy.send}
                  >
                    <Send size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.sendButton}`}
                    onClick={startRecording}
                    disabled={pending}
                    aria-label={copy.record}
                    title={copy.record}
                  >
                    <Mic size={20} />
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.recordingRow} role="status">
                {recordingState === 'recording' ? (
                  <>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => stopRecording(true)}
                      aria-label={copy.cancelRecording}
                      title={copy.cancelRecording}
                    >
                      <X size={20} />
                    </button>
                    <span className={styles.recordingLabel}>
                      <span className={styles.recordingDot} aria-hidden="true" />
                      {copy.recording} {formatSeconds(recordSeconds)} / {formatSeconds(MAX_AUDIO_SECONDS)}
                    </span>
                    <button
                      ref={stopButtonRef}
                      type="button"
                      className={`${styles.iconButton} ${styles.sendButton}`}
                      onClick={() => stopRecording(false)}
                      aria-label={copy.stopRecording}
                      title={copy.stopRecording}
                    >
                      <Square size={16} fill="currentColor" />
                    </button>
                  </>
                ) : (
                  <span className={styles.recordingLabel}>{copy.processingAudio}</span>
                )}
              </div>
            )}
            <p className={styles.disclaimer}>{copy.disclaimer}</p>
          </form>
        </div>
      )}

      {!open && showTeaser && (
        <div className={styles.teaser}>
          <button type="button" className={styles.teaserText} onClick={openChat}>
            {copy.teaser}
          </button>
          <button
            type="button"
            className={styles.teaserClose}
            onClick={dismissTeaser}
            aria-label={copy.dismissTeaser}
            title={copy.dismissTeaser}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {!open && (
        <button
          ref={launcherRef}
          type="button"
          className={styles.launcher}
          onClick={openChat}
          aria-label={copy.launcherLabel}
          aria-expanded={open}
          aria-controls="migue-chat-panel"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/migue.jpg" alt="" className={styles.launcherAvatar} width={60} height={60} />
          <span className={styles.launcherLabel}>{copy.launcherLabel}</span>
        </button>
      )}
    </div>
  )
}
