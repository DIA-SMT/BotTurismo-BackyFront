import { NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { TELEGRAM_CHAT_PREFIX, getChannel } from '@/lib/supabase'

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
    { data: uniqueRows },
    { count: internationalCount },
    { count: telegramCount },
  ] = await Promise.all([
    supabase.from('kpi_consultas_por_intent').select('*'),
    supabase.from('kpi_origen_turistas').select('*').limit(10),
    supabase.from('kpi_actividad_diaria').select('*').order('dia', { ascending: true }),
    supabase.from('kpi_franja_horaria').select('*'),
    supabase.from('kpi_turistas_internacionales').select('*').limit(6),
    supabase.from('tourist_interactions').select('*', { count: 'exact', head: true }),
    supabase.from('tourist_interactions').select('chat_id').not('chat_id', 'is', null),
    supabase.from('tourist_interactions').select('*', { count: 'exact', head: true }).eq('language', 'en'),
    supabase.from('tourist_interactions').select('*', { count: 'exact', head: true }).like('chat_id', `${TELEGRAM_CHAT_PREFIX}%`),
  ])

  const total = totalInteractions || 0
  const uniqueChats = new Set((uniqueRows || []).map((row: { chat_id: string | null }) => row.chat_id))
  const unique = uniqueChats.size
  const uniqueTelegram = [...uniqueChats].filter(chatId => getChannel(chatId) === 'telegram').length
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
        interactions: { whatsapp: total - (telegramCount || 0), telegram: telegramCount || 0 },
        tourists: { whatsapp: unique - uniqueTelegram, telegram: uniqueTelegram },
      },
    },
  })
}
