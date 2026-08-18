import {
  weekdayLabels,
  type BusinessWeekday,
  type PreferredShift,
} from '@/lib/educational-bus-requests'

// Catálogo del bus educativo: separado del turístico y solo en español.
// Cada circuito define sus propios días y turnos habilitados.

export type EducationalAvailabilityMap = Partial<Record<BusinessWeekday, PreferredShift[]>>

export interface EducationalCircuitRecord {
  id: number
  created_at: string
  updated_at: string
  slug: string
  name: string
  summary: string | null
  paragraphs: string[]
  availability: EducationalAvailabilityMap
  active: boolean
  sort_order: number
}

export interface EducationalCircuitPublic {
  slug: string
  name: string
  summary: string
  paragraphs: string[]
  availability: EducationalAvailabilityMap
}

const validWeekdays: BusinessWeekday[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const validShifts: PreferredShift[] = ['manana', 'tarde']

export function sanitizeEducationalAvailabilityMap(raw: unknown): EducationalAvailabilityMap {
  if (!raw || typeof raw !== 'object') return {}
  const result: EducationalAvailabilityMap = {}
  for (const weekday of validWeekdays) {
    const shifts = (raw as Record<string, unknown>)[weekday]
    if (!Array.isArray(shifts)) continue
    const clean = shifts.filter((shift): shift is PreferredShift =>
      typeof shift === 'string' && validShifts.includes(shift as PreferredShift),
    )
    if (clean.length > 0) result[weekday] = [...new Set(clean)]
  }
  return result
}

export function mapEducationalCircuitRecord(record: EducationalCircuitRecord): EducationalCircuitPublic {
  return {
    slug: record.slug,
    name: record.name,
    summary: record.summary || '',
    paragraphs: Array.isArray(record.paragraphs)
      ? record.paragraphs.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    availability: sanitizeEducationalAvailabilityMap(record.availability),
  }
}

// Texto tipo "Martes (mañana y tarde), Jueves (tarde) y Viernes (mañana)".
export function describeEducationalAvailability(availability: EducationalAvailabilityMap) {
  const shiftLabel: Record<PreferredShift, string> = { manana: 'mañana', tarde: 'tarde' }
  const parts = validWeekdays
    .filter((weekday) => (availability[weekday] || []).length > 0)
    .map((weekday) => {
      const shifts = availability[weekday] || []
      const shiftsText = shifts.length === 2 ? 'mañana y tarde' : shiftLabel[shifts[0]]
      return `${weekdayLabels[weekday]} (${shiftsText})`
    })

  if (parts.length === 0) return 'Sin días habilitados por el momento'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

// Semilla inicial: el circuito vigente activo y los dos nuevos como borrador
// (sin días asignados y desactivados) para que turismo los complete y active.
export function buildEducationalCircuitSeedRows() {
  return [
    {
      slug: 'historico_cultural',
      name: 'Histórico Cultural',
      summary: 'Historia, cultura e identidad tucumana.',
      paragraphs: [
        'El presente circuito histórico-cultural propone un recorrido por espacios emblemáticos de la ciudad de San Miguel de Tucumán que permiten comprender la identidad local a través de su historia, su cultura y su desarrollo productivo.',
        'A lo largo del itinerario, los visitantes podrán conocer distintos aspectos que conforman el patrimonio tucumano, desde su pasado industrial hasta sus expresiones artísticas y su legado histórico nacional.',
        'El recorrido incluye la visita al Museo de la Industria Azucarera, la Casa Natal de Mercedes Sosa, el Museo Casa de la Ciudad y la Casa Solar Belgraniana, articulando turismo, educación y patrimonio en una propuesta integral.',
        'Esta experiencia permite no solo recorrer espacios significativos, sino también reflexionar sobre la construcción de la identidad tucumana y la importancia de preservar ese legado para las futuras generaciones.',
      ],
      availability: {
        martes: ['manana', 'tarde'],
        miercoles: ['manana', 'tarde'],
        jueves: ['tarde'],
        viernes: ['manana'],
      },
      active: true,
      sort_order: 10,
    },
    {
      slug: 'escultorico_cielo_abierto',
      name: 'Circuito Escultórico Museo a Cielo Abierto',
      summary: 'Las esculturas clásicas del Parque 9 de Julio como aula a cielo abierto.',
      paragraphs: [
        'El circuito propone un recorrido guiado por las esculturas clásicas emplazadas en el Parque 9 de Julio, poniendo en valor el patrimonio cultural y paisajístico de la ciudad.',
        'Los estudiantes conocen obras como Diana y Endimión, el Apolo de Belvedere, la Venus de Milo y la Familia Laocoonte, con relatos que combinan arte, mitología e historia.',
        'Durante el guiado se abordan los procesos de restauración y conservación del patrimonio, junto con una reseña histórica del Parque 9 de Julio y su vegetación característica.',
      ],
      availability: {},
      active: false,
      sort_order: 20,
    },
    {
      slug: 'city_tour_cementerio',
      name: 'Circuito City Tour con Cementerio del Oeste',
      summary: 'Los puntos más relevantes de la ciudad con visita al Cementerio del Oeste.',
      paragraphs: [
        'Un recorrido en bus por los puntos más emblemáticos de San Miguel de Tucumán: Plaza Independencia y su entorno histórico, la avenida Sarmiento, el Parque 9 de Julio y el barrio La Ciudadela.',
        'La propuesta incorpora una visita guiada al Cementerio del Oeste, donde descansan personalidades destacadas de la historia tucumana como Lola Mora, Marco Avellaneda y Celestino Gelsi.',
        'Una experiencia que conecta la historia urbana, el patrimonio arquitectónico y la memoria de la ciudad con los contenidos escolares.',
      ],
      availability: {},
      active: false,
      sort_order: 30,
    },
  ]
}
