import { NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql } from '@/lib/db'
import { TELEGRAM_CHAT_PREFIX, WEB_CHAT_PREFIX, getChannel } from '@/lib/supabase'

// Cada métrica es independiente: si una consulta falla se registra y esa
// métrica queda vacía, sin tirar abajo el dashboard entero.
function rowsOrEmpty<T>(query: Promise<T[]>, label: string): Promise<T[]> {
  return query.catch((error) => {
    console.error(`Dashboard: no se pudieron leer ${label}`, error instanceof Error ? error.message : error)
    return []
  })
}

async function countOrZero(query: Promise<{ count: number }[]>, label: string) {
  const [row] = await rowsOrEmpty(query, label)
  return row?.count || 0
}

// Turistas únicos: todos los chat_id distintos de una sola vez (sin el tope
// de 1000 filas por consulta que tenía Supabase).
async function fetchUniqueChatIds() {
  const sql = getSql()
  const rows = await rowsOrEmpty(
    sql<{ chat_id: string }[]>`select distinct chat_id from tourist_interactions where chat_id is not null`,
    'los chat_id',
  )
  return new Set(rows.map((row) => row.chat_id))
}

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const sql = getSql()
  const [
    intents,
    origins,
    activity,
    timeSlots,
    international,
    totalInteractions,
    uniqueChats,
    internationalCount,
    telegramCount,
    webCount,
  ] = await Promise.all([
    rowsOrEmpty(sql`select * from kpi_consultas_por_intent`, 'kpi_consultas_por_intent'),
    rowsOrEmpty(sql`select * from kpi_origen_turistas limit 10`, 'kpi_origen_turistas'),
    rowsOrEmpty(sql`select * from kpi_actividad_diaria order by dia asc`, 'kpi_actividad_diaria'),
    rowsOrEmpty(sql`select * from kpi_franja_horaria`, 'kpi_franja_horaria'),
    rowsOrEmpty(sql`select * from kpi_turistas_internacionales limit 6`, 'kpi_turistas_internacionales'),
    countOrZero(sql`select count(*)::int as count from tourist_interactions`, 'el total de interacciones'),
    fetchUniqueChatIds(),
    countOrZero(
      sql`select count(*)::int as count from tourist_interactions where language = 'en'`,
      'las interacciones en inglés',
    ),
    countOrZero(
      sql`select count(*)::int as count from tourist_interactions where chat_id like ${`${TELEGRAM_CHAT_PREFIX}%`}`,
      'las interacciones de Telegram',
    ),
    countOrZero(
      sql`select count(*)::int as count from tourist_interactions where chat_id like ${`${WEB_CHAT_PREFIX}%`}`,
      'las interacciones de la web',
    ),
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
