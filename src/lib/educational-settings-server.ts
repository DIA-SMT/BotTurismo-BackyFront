import type { SupabaseClient } from '@supabase/supabase-js'
import {
  defaultEducationalSettings,
  sanitizeEducationalSettings,
  type EducationalSettings,
} from '@/lib/educational-bus-requests'

export const educationalSettingsKey = 'educational_settings'

// Lee la configuración del educativo. Si la tabla no existe todavía (falta
// correr la migración) o no hay fila, devuelve los defaults para que el sitio
// siga funcionando igual que antes.
export async function getEducationalSettings(supabase: SupabaseClient): Promise<EducationalSettings> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', educationalSettingsKey)
      .maybeSingle()

    if (error) return defaultEducationalSettings

    if (!data) {
      await supabase
        .from('app_settings')
        .insert({ key: educationalSettingsKey, value: defaultEducationalSettings })
      return defaultEducationalSettings
    }

    return sanitizeEducationalSettings(data.value)
  } catch {
    return defaultEducationalSettings
  }
}

export async function saveEducationalSettings(
  supabase: SupabaseClient,
  raw: unknown,
): Promise<EducationalSettings | null> {
  const settings = sanitizeEducationalSettings(raw)
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: educationalSettingsKey, value: settings }, { onConflict: 'key' })

  if (error) return null
  return settings
}
