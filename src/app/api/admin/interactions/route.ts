import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'

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

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('tourist_interactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (intent) query = query.eq('intent', intent)
  if (language) query = query.eq('language', language)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
  if (search) query = query.ilike('query_text', `%${search}%`)

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener las interacciones.' }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
  })
}
