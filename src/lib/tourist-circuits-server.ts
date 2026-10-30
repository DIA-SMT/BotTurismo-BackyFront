import { getSql, pgErrorCode, rowValues, UNIQUE_VIOLATION } from '@/lib/db'
import {
  buildTouristCircuitSeedRows,
  mapTouristCircuitRecord,
  type TouristCircuit,
  type TouristCircuitRecord,
} from '@/lib/tourist-circuits'

// Siembra el catálogo con los 10 circuitos originales la primera vez que se
// consulta la tabla vacía. Idempotente: si otra request sembró antes, el
// insert falla por slug único y se ignora.
export async function ensureTouristCircuitsSeeded() {
  const sql = getSql()
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from tourist_circuits`
  if ((count || 0) > 0) return
  try {
    await sql`insert into tourist_circuits ${rowValues(sql, buildTouristCircuitSeedRows())}`
  } catch (error) {
    if (pgErrorCode(error) !== UNIQUE_VIOLATION) {
      console.error('No se pudo sembrar el catálogo de circuitos:', error)
    }
  }
}

export async function fetchTouristCircuitRecords(options: { activeOnly?: boolean } = {}): Promise<TouristCircuitRecord[]> {
  await ensureTouristCircuitsSeeded()

  const sql = getSql()
  const rows = await sql<TouristCircuitRecord[]>`
    select * from tourist_circuits
    ${options.activeOnly ? sql`where active = ${true}` : sql``}
    order by sort_order asc, id asc
  `
  return rows
}

export async function getActiveTouristCircuits(): Promise<TouristCircuit[]> {
  const records = await fetchTouristCircuitRecords({ activeOnly: true })
  return records.map(mapTouristCircuitRecord)
}

export async function getTouristCircuitRecordBySlug(slug: string): Promise<TouristCircuitRecord | null> {
  const sql = getSql()
  const [record] = await sql<TouristCircuitRecord[]>`select * from tourist_circuits where slug = ${slug}`
  return record ?? null
}
