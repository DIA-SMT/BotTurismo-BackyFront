import { getSql, rowValues } from '@/lib/db'
import {
  defaultEducationalSettings,
  sanitizeEducationalSettings,
  type EducationalSettings,
} from '@/lib/educational-bus-requests'

export const educationalSettingsKey = 'educational_settings'

// Lee la configuración del educativo. Si la tabla no existe todavía (falta
// correr la migración) o no hay fila, devuelve los defaults para que el sitio
// siga funcionando igual que antes.
export async function getEducationalSettings(): Promise<EducationalSettings> {
  try {
    const sql = getSql()
    const [data] = await sql<{ value: unknown }[]>`
      select value from app_settings where key = ${educationalSettingsKey}
    `

    if (!data) {
      await sql`insert into app_settings ${rowValues(sql, { key: educationalSettingsKey, value: defaultEducationalSettings })}`
      return defaultEducationalSettings
    }

    return sanitizeEducationalSettings(data.value)
  } catch {
    return defaultEducationalSettings
  }
}

export async function saveEducationalSettings(raw: unknown): Promise<EducationalSettings | null> {
  const settings = sanitizeEducationalSettings(raw)
  try {
    const sql = getSql()
    await sql`
      insert into app_settings ${rowValues(sql, { key: educationalSettingsKey, value: settings })}
      on conflict (key) do update set value = excluded.value
    `
  } catch {
    return null
  }
  return settings
}
