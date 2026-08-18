import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildTouristCircuitSeedRows,
  mapTouristCircuitRecord,
  type TouristCircuit,
  type TouristCircuitRecord,
} from '@/lib/tourist-circuits'

// Siembra el catálogo con los 10 circuitos originales la primera vez que se
// consulta la tabla vacía. Idempotente: si otra request sembró antes, el
// insert falla por slug único y se ignora.
export async function ensureTouristCircuitsSeeded(supabase: SupabaseClient) {
  const { count, error } = await supabase.from('tourist_circuits').select('*', { count: 'exact', head: true })
  if (error) throw error
  if ((count || 0) > 0) return
  await supabase.from('tourist_circuits').insert(buildTouristCircuitSeedRows())
}

export async function fetchTouristCircuitRecords(
  supabase: SupabaseClient,
  options: { activeOnly?: boolean } = {},
): Promise<TouristCircuitRecord[]> {
  await ensureTouristCircuitsSeeded(supabase)

  let query = supabase
    .from('tourist_circuits')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (options.activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as TouristCircuitRecord[]
}

export async function getActiveTouristCircuits(supabase: SupabaseClient): Promise<TouristCircuit[]> {
  const records = await fetchTouristCircuitRecords(supabase, { activeOnly: true })
  return records.map(mapTouristCircuitRecord)
}

export async function getTouristCircuitRecordBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<TouristCircuitRecord | null> {
  const { data, error } = await supabase.from('tourist_circuits').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return (data as TouristCircuitRecord) || null
}
