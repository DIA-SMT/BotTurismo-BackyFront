import { NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { TELEGRAM_CHAT_PREFIX, WEB_CHAT_PREFIX, getChannel } from '@/lib/supabase'

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>

// Supabase devuelve como mucho 1000 filas por consulta: los chat_id se leen por
// páginas para que los turistas únicos no se corten (los chats nuevos, como los
// de la web, quedaban afuera).
const PAGE_SIZE = 1000

async function fetchUniqueChatIds(supabase: SupabaseClient) {
  const chatIds = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('tourist_interactions')
      .select('chat_id')
      .not('chat_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    // Como el resto de las métricas: un error no tira abajo el dashboard entero
    if (error) {
      console.error('Dashboard: no se pudieron leer los chat_id', error.message)
      return chatIds
    }
    for (const row of (data || []) as { chat_id: string | null }[]) {
      if (row.chat_id) chatIds.add(row.chat_id)
    }
    if (!data || data.length < PAGE_SIZE) return chatIds
  }
}

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const [
    { data: intents },
    { data: origins },
    { data: activity },
    { data: timeSlots },
    { data: international },
    { count: totalInteractions },
    uniqueChats,
    { count: internationalCount },
    { count: telegramCount },
    { count: webCount },
  ] = await Promise.all([
    supabase.from('kpi_consultas_por_intent').select('*'),
    supabase.from('kpi_origen_turistas').select('*').limit(10),
    supabase.from('kpi_actividad_diaria').select('*').order('dia', { ascending: true }),
    supabase.from('kpi_franja_horaria').select('*'),
    supabase.from('kpi_turistas_internacionales').select('*').limit(6),
    supabase.from('tourist_interactions').select('*', { count: 'exact', head: true }),
    fetchUniqueChatIds(supabase),
    supabase.from('tourist_interactions').select('*', { count: 'exact', head: true }).eq('language', 'en'),
    supabase.from('tourist_interactions').select('*', { count: 'exact', head: true }).like('chat_id', `${TELEGRAM_CHAT_PREFIX}%`),
    supabase.from('tourist_interactions').select('*', { count: 'exact', head: true }).like('chat_id', `${WEB_CHAT_PREFIX}%`),
  ])

  const total = totalInteractions || 0
  const unique = uniqueChats.size
  const uniqueTelegram = [...uniqueChats].filter(chatId => getChannel(chatId) === 'telegram').length
  const uniqueWeb = [...uniqueChats].filter(chatId => getChannel(chatId) === 'web').length
  const internationalPct = internationalCount && total > 0 ? Math.round((internationalCount / total) * 100) : 0

  return NextResponse.json({
    data: {
      intents: intents || [],
      origins: origins || [],
      activity: activity || [],
      timeSlots: timeSlots || [],
      international: international || [],
      totalInteractions: total,
      totalTourists: unique,
      internationalPct,
      byChannel: {
        interactions: {
          whatsapp: total - (telegramCount || 0) - (webCount || 0),
          telegram: telegramCount || 0,
          web: webCount || 0,
        },
        tourists: { whatsapp: unique - uniqueTelegram - uniqueWeb, telegram: uniqueTelegram, web: uniqueWeb },
      },
    },
  })
}
