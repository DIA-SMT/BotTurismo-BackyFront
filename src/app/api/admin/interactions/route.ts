import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql } from '@/lib/db'
import { TELEGRAM_CHAT_PREFIX, WEB_CHAT_PREFIX } from '@/lib/supabase'

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') || '0')
  const intent = searchParams.get('intent') || ''
  const language = searchParams.get('language') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo = searchParams.get('dateTo') || ''
  const search = searchParams.get('search') || ''
  const channel = searchParams.get('channel') || ''

  const sql = getSql()
  // Los mismos filtros para la página y para el total.
  const filters = () => sql`
    where true
      ${intent ? sql`and intent = ${intent}` : sql``}
      ${language ? sql`and language = ${language}` : sql``}
      ${dateFrom ? sql`and created_at >= ${dateFrom}` : sql``}
      ${dateTo ? sql`and created_at <= ${`${dateTo}T23:59:59`}` : sql``}
      ${search ? sql`and query_text ilike ${`%${search}%`}` : sql``}
      ${channel === 'telegram' ? sql`and chat_id like ${`${TELEGRAM_CHAT_PREFIX}%`}` : sql``}
      ${channel === 'web' ? sql`and chat_id like ${`${WEB_CHAT_PREFIX}%`}` : sql``}
      ${
        channel === 'whatsapp'
          ? sql`and (chat_id is null or (chat_id not like ${`${TELEGRAM_CHAT_PREFIX}%`} and chat_id not like ${`${WEB_CHAT_PREFIX}%`}))`
          : sql``
      }
  `

  try {
    const [data, [{ count }]] = await Promise.all([
      sql`
        select * from tourist_interactions
        ${filters()}
        order by created_at desc
        limit ${PAGE_SIZE} offset ${page * PAGE_SIZE}
      `,
      sql<{ count: number }[]>`select count(*)::int as count from tourist_interactions ${filters()}`,
    ])

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las interacciones.' }, { status: 500 })
  }
}
