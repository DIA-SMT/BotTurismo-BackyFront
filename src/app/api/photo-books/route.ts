import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

type PublicBookRow = {
  id: string
  title: string
  tour_date: string
  description: string | null
  access_token: string
  expires_at: string
  photo_count: number
}

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get('date')?.trim()
  const sql = getSql()
  const dateFilter = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : ''

  let data: PublicBookRow[]
  try {
    data = await sql<PublicBookRow[]>`
      select b.id, b.title, b.tour_date, b.description, b.access_token, b.expires_at,
        (select count(*)::int from photo_book_photos p where p.book_id = b.id) as photo_count
      from photo_books b
      where b.expires_at > ${new Date().toISOString()}
        ${dateFilter ? sql`and b.tour_date = ${dateFilter}` : sql``}
      order by b.tour_date desc, b.created_at desc
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las galerías disponibles.' }, { status: 500 })
  }

  return NextResponse.json({
    data: data.map((book) => ({
      id: book.id,
      title: book.title,
      tour_date: book.tour_date,
      description: book.description,
      access_token: book.access_token,
      expires_at: book.expires_at,
      photo_count: book.photo_count || 0,
    })),
  })
}

