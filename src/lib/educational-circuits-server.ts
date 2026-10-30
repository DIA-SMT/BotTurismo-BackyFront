import { getSql, pgErrorCode, rowValues, UNIQUE_VIOLATION } from '@/lib/db'
import {
  buildEducationalCircuitSeedRows,
  mapEducationalCircuitRecord,
  type EducationalCircuitPublic,
  type EducationalCircuitRecord,
} from '@/lib/educational-circuits'

// Siembra el catálogo educativo la primera vez que se consulta la tabla vacía.
// Idempotente: ante una carrera el insert choca con el slug único y se ignora.
export async function ensureEducationalCircuitsSeeded() {
  const sql = getSql()
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from educational_circuits`
  if ((count || 0) > 0) return
  await sql`insert into educational_circuits ${rowValues(sql, buildEducationalCircuitSeedRows())}`.catch((error) => {
    if (pgErrorCode(error) !== UNIQUE_VIOLATION) console.error('No se pudo sembrar el catálogo educativo', error)
  })
}

export async function fetchEducationalCircuitRecords(
  options: { activeOnly?: boolean } = {},
): Promise<EducationalCircuitRecord[]> {
  await ensureEducationalCircuitsSeeded()

  const sql = getSql()
  const rows = await sql<EducationalCircuitRecord[]>`
    select * from educational_circuits
    ${options.activeOnly ? sql`where active = ${true}` : sql``}
    order by sort_order asc, id asc
  `
  return rows
}

export async function getActiveEducationalCircuits(): Promise<EducationalCircuitPublic[]> {
  const records = await fetchEducationalCircuitRecords({ activeOnly: true })
  return records.map(mapEducationalCircuitRecord)
}

export async function getEducationalCircuitBySlug(slug: string): Promise<EducationalCircuitRecord | null> {
  const sql = getSql()
  const [record] = await sql<EducationalCircuitRecord[]>`select * from educational_circuits where slug = ${slug}`
  return record ?? null
}

// Mapa slug -> nombre para mostrar etiquetas en tablas y exportaciones.
export async function getEducationalCircuitLabels(): Promise<Record<string, string>> {
  try {
    const records = await fetchEducationalCircuitRecords()
    return records.reduce<Record<string, string>>((acc, record) => {
      acc[record.slug] = record.name
      return acc
    }, {})
  } catch {
    return {}
  }
}
