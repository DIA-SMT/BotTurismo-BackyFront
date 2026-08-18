import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildEducationalCircuitSeedRows,
  mapEducationalCircuitRecord,
  type EducationalCircuitPublic,
  type EducationalCircuitRecord,
} from '@/lib/educational-circuits'

// Siembra el catálogo educativo la primera vez que se consulta la tabla vacía.
// Idempotente: ante una carrera el insert choca con el slug único y se ignora.
export async function ensureEducationalCircuitsSeeded(supabase: SupabaseClient) {
  const { count, error } = await supabase.from('educational_circuits').select('*', { count: 'exact', head: true })
  if (error) throw error
  if ((count || 0) > 0) return
  await supabase.from('educational_circuits').insert(buildEducationalCircuitSeedRows())
}

export async function fetchEducationalCircuitRecords(
  supabase: SupabaseClient,
  options: { activeOnly?: boolean } = {},
): Promise<EducationalCircuitRecord[]> {
  await ensureEducationalCircuitsSeeded(supabase)

  let query = supabase
    .from('educational_circuits')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (options.activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as EducationalCircuitRecord[]
}

export async function getActiveEducationalCircuits(supabase: SupabaseClient): Promise<EducationalCircuitPublic[]> {
  const records = await fetchEducationalCircuitRecords(supabase, { activeOnly: true })
  return records.map(mapEducationalCircuitRecord)
}

export async function getEducationalCircuitBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<EducationalCircuitRecord | null> {
  const { data, error } = await supabase.from('educational_circuits').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return (data as EducationalCircuitRecord) || null
}

// Mapa slug -> nombre para mostrar etiquetas en tablas y exportaciones.
export async function getEducationalCircuitLabels(supabase: SupabaseClient): Promise<Record<string, string>> {
  try {
    const records = await fetchEducationalCircuitRecords(supabase)
    return records.reduce<Record<string, string>>((acc, record) => {
      acc[record.slug] = record.name
      return acc
    }, {})
  } catch {
    return {}
  }
}
