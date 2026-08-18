import { sanitizeEducationalAvailabilityMap, type EducationalAvailabilityMap } from '@/lib/educational-circuits'

export interface EducationalCircuitInput {
  name: string
  summary: string
  paragraphs: string[]
  availability: EducationalAvailabilityMap
  sortOrder: number | null
  active: boolean
}

export function parseEducationalCircuitInput(body: Record<string, unknown>): {
  input: EducationalCircuitInput
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}
  const name = String(body.name ?? '').trim()
  if (!name) errors.name = 'Ingresá el nombre del circuito.'

  const paragraphs = Array.isArray(body.paragraphs)
    ? body.paragraphs.map((item) => String(item).trim()).filter(Boolean)
    : []

  let sortOrder: number | null = null
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== '') {
    const order = Number(body.sortOrder)
    if (!Number.isInteger(order) || order < 0 || order > 10000) {
      errors.sortOrder = 'El orden debe ser un número entero.'
    } else {
      sortOrder = order
    }
  }

  return {
    input: {
      name,
      summary: String(body.summary ?? '').trim(),
      paragraphs,
      availability: sanitizeEducationalAvailabilityMap(body.availability),
      sortOrder,
      active: body.active === undefined ? true : Boolean(body.active),
    },
    errors,
  }
}

// Slugs con guion bajo para mantener el estilo de los existentes
// (historico_cultural, memoria).
export function slugifyEducationalCircuitName(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return slug || 'circuito'
}
