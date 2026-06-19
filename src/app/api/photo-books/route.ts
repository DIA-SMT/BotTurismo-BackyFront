import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get('date')?.trim()
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('photo_books')
    .select('id, title, tour_date, description, access_token, expires_at, photo_book_photos(id)')
    .gt('expires_at', new Date().toISOString())
    .order('tour_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    query = query.eq('tour_date', requestedDate)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener las galerías disponibles.' }, { status: 500 })
  }

  return NextResponse.json({
    data: (data || []).map((book) => ({
      id: book.id,
      title: book.title,
      tour_date: book.tour_date,
      description: book.description,
      access_token: book.access_token,
      expires_at: book.expires_at,
      photo_count: book.photo_book_photos?.length || 0,
    })),
  })
}

