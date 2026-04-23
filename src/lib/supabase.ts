export interface TouristInteraction {
  id: number
  created_at: string
  chat_id: string | null
  user_name: string | null
  intent: string | null
  language: string | null
  query_text: string | null
  bot_response: string | null
  origen_provincia: string | null
  medio_transporte: string | null
  budget: string | null
  has_photo: boolean
  live_chat_url: string | null
}

export interface FAQ {
  id: number
  created_at: string
  updated_at: string
  pregunta: string
  respuesta: string
  categoria: string
  activo: boolean
  orden: number
}

export interface KpiIntent {
  intent: string
  total: number
  en_ingles: number
  en_espanol: number
}

export interface KpiOrigen {
  origen: string
  total: number
}

export interface KpiActividad {
  dia: string
  total_consultas: number
  turistas_unicos: number
}

export interface KpiFranja {
  hora: number
  total: number
}

export interface KpiInternacional {
  mes: string
  internacionales: number
  hispanoparlantes: number
  total: number
}

export interface KpiTransporte {
  medio: string
  total: number
}

export const CATEGORIAS: Record<string, { label: string; emoji: string; color: string }> = {
  excursiones:  { label: 'Excursiones',     emoji: '🗺️',  color: '#10b981' },
  transporte:   { label: 'Transporte',      emoji: '🚌',  color: '#3b82f6' },
  gastronomia:  { label: 'Gastronomía',     emoji: '🍽️',  color: '#f59e0b' },
  alojamiento:  { label: 'Alojamiento',     emoji: '🏨',  color: '#8b5cf6' },
  atracciones:  { label: 'Atracciones',     emoji: '🏛️',  color: '#ec4899' },
  museos:       { label: 'Museos',          emoji: '🏛️',  color: '#14b8a6' },
  asamblea:     { label: 'Asamblea',        emoji: '🌱',  color: '#22c55e' },
  servicios:    { label: 'Servicios',       emoji: '💱',  color: '#06b6d4' },
  nocturna:     { label: 'Vida Nocturna',   emoji: '🍺',  color: '#f97316' },
  salud:        { label: 'Salud',           emoji: '🏥',  color: '#ef4444' },
  compras:      { label: 'Compras',         emoji: '🛍️',  color: '#84cc16' },
  festivales:   { label: 'Festivales',      emoji: '🎉',  color: '#a855f7' },
  general:      { label: 'General',         emoji: '✨',  color: '#6366f1' },
}

export const INTENT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  recomendacion_gastronomica: { label: 'Gastronomía',    emoji: '🍽️', color: '#f59e0b' },
  recomendacion_alojamiento:  { label: 'Alojamiento',    emoji: '🏨', color: '#8b5cf6' },
  agenda_cultural:            { label: 'Agenda Cultural', emoji: '🎭', color: '#ec4899' },
  atraccion_turistica:        { label: 'Atracciones',    emoji: '🏛️', color: '#3b82f6' },
  bus_turistico:              { label: 'Bus Turístico',  emoji: '🚌', color: '#10b981' },
  registro_turista:           { label: 'Registro',       emoji: '📋', color: '#06b6d4' },
  geo_quiz:                   { label: 'Geo Quiz',       emoji: '📸', color: '#f97316' },
  consulta_general:           { label: 'Consulta Gral.', emoji: '💬', color: '#6366f1' },
  saludo:                     { label: 'Saludo',         emoji: '👋', color: '#84cc16' },
}
