import type { SupabaseClient } from '@supabase/supabase-js'
import { getTouristCircuitBySlug, isTouristCircuitIcon } from '@/lib/tourist-circuits'
import { getTouristCircuitRecordBySlug } from '@/lib/tourist-circuits-server'
import { translateTouristCircuitContent } from '@/lib/ai-translate'

// Resuelve el circuito de una salida contra el catálogo de la base; si la
// tabla todavía no existe cae al catálogo estático del código.
export async function resolveCircuitForDeparture(supabase: SupabaseClient, circuitSlug: string | null) {
  if (!circuitSlug) {
    return { slug: null as string | null, title: null as string | null, inactive: false, defaultCapacity: null as number | null, defaultMeetingPoint: null as string | null }
  }
  try {
    const record = await getTouristCircuitRecordBySlug(supabase, circuitSlug)
    if (record) {
      return {
        slug: record.slug,
        title: record.name_es,
        inactive: !record.active,
        defaultCapacity: record.default_capacity,
        defaultMeetingPoint: record.default_meeting_point,
      }
    }
  } catch {
    // tabla inexistente: probar catálogo estático
  }
  const staticCircuit = getTouristCircuitBySlug(circuitSlug)
  if (staticCircuit) {
    return {
      slug: staticCircuit.slug,
      title: staticCircuit.content.es.name,
      inactive: false,
      defaultCapacity: null,
      defaultMeetingPoint: null,
    }
  }
  return { slug: null, title: null, inactive: false, defaultCapacity: null, defaultMeetingPoint: null }
}

export interface TouristCircuitInput {
  name: string
  schedule: string
  duration: string
  summary: string
  description: string
  highlights: string[]
  icon: string
  sortOrder: number | null
  defaultCapacity: number | null
  defaultMeetingPoint: string
  active: boolean
}

export function parseCircuitInput(body: Record<string, unknown>): {
  input: TouristCircuitInput
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}
  const name = String(body.name ?? '').trim()
  if (!name) errors.name = 'Ingresá el nombre del circuito.'

  const highlights = Array.isArray(body.highlights)
    ? body.highlights.map((item) => String(item).trim()).filter(Boolean)
    : []

  let defaultCapacity: number | null = null
  if (body.defaultCapacity !== undefined && body.defaultCapacity !== null && body.defaultCapacity !== '') {
    const capacity = Number(body.defaultCapacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      errors.defaultCapacity = 'El cupo por defecto debe ser un número entre 1 y 500.'
    } else {
      defaultCapacity = capacity
    }
  }

  let sortOrder: number | null = null
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== '') {
    const order = Number(body.sortOrder)
    if (!Number.isInteger(order) || order < 0 || order > 10000) {
      errors.sortOrder = 'El orden debe ser un número entero.'
    } else {
      sortOrder = order
    }
  }

  const iconRaw = String(body.icon ?? 'bus')

  return {
    input: {
      name,
      schedule: String(body.schedule ?? '').trim(),
      duration: String(body.duration ?? '').trim(),
      summary: String(body.summary ?? '').trim(),
      description: String(body.description ?? '').trim(),
      highlights,
      icon: isTouristCircuitIcon(iconRaw) ? iconRaw : 'bus',
      sortOrder,
      defaultCapacity,
      defaultMeetingPoint: String(body.defaultMeetingPoint ?? '').trim(),
      active: body.active === undefined ? true : Boolean(body.active),
    },
    errors,
  }
}

export function slugifyCircuitName(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'circuito'
}

export async function buildEnglishFields(input: TouristCircuitInput) {
  const translation = await translateTouristCircuitContent({
    name: input.name,
    schedule: input.schedule || null,
    duration: input.duration || null,
    summary: input.summary || null,
    description: input.description || null,
    highlights: input.highlights,
  })

  if (!translation) return { translated: false, fields: {} as Record<string, unknown> }

  return {
    translated: true,
    fields: {
      name_en: translation.name,
      schedule_en: translation.schedule,
      duration_en: translation.duration,
      summary_en: translation.summary,
      description_en: translation.description,
      highlights_en: translation.highlights,
    } as Record<string, unknown>,
  }
}

export function circuitInputToSpanishFields(input: TouristCircuitInput) {
  return {
    icon: input.icon,
    active: input.active,
    default_capacity: input.defaultCapacity,
    default_meeting_point: input.defaultMeetingPoint || null,
    name_es: input.name,
    schedule_es: input.schedule || null,
    duration_es: input.duration || null,
    summary_es: input.summary || null,
    description_es: input.description || null,
    highlights_es: input.highlights,
  }
}
