import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import type { PhotoBookPhoto } from '@/lib/photo-books'

type TokenBookRow = {
  id: string
  title: string
  tour_date: string
  description: string | null
  expires_at: string
  photo_book_photos: PhotoBookPhoto[]
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const sql = getSql()
  let book: TokenBookRow | null
  try {
    const rows = await sql<TokenBookRow[]>`
      select b.id, b.title, b.tour_date, b.description, b.expires_at,
        coalesce((
          select json_agg(p order by p.sort_order, p.created_at)
          from photo_book_photos p
          where p.book_id = b.id
        ), '[]'::json) as photo_book_photos
      from photo_books b
      where b.access_token = ${token}
        and b.expires_at > ${new Date().toISOString()}
    `
    book = rows[0] ?? null
  } catch (error) {
    // Distinguir "no existe" de "la base no responde": durante la caída por
    // cuota (2026-10-10) los turistas veían "no existe o venció" cuando sus
    // fotos estaban perfectamente guardadas, y daban el link por perdido.
    console.error('No se pudo leer el book:', (error as Error).message)
    return NextResponse.json(
      { error: 'No pudimos abrir tus fotos en este momento. Volvé a intentar en un rato: siguen guardadas.' },
      { status: 503 },
    )
  }
  if (!book) {
    return NextResponse.json({ error: 'Este book no existe o ya venció.' }, { status: 404 })
  }

  // URLs propias y ESTABLES (no firmadas): así el navegador (y cualquier caché
  // delante del servidor) las reutiliza, en vez de bajar la misma foto en cada
  // visita. La grilla usa thumb_url (miniatura liviana) y la grande solo se
  // pide al ampliar.
  const photos = [...(book.photo_book_photos || [])].sort((a, b) => a.sort_order - b.sort_order)
  const base = `/api/photo-books/${encodeURIComponent(token)}/photo`
  const signedPhotos = photos.map((photo) => ({
    id: photo.id,
    name: photo.original_name,
    thumb_url: `${base}/${photo.id}?size=thumb`,
    view_url: `${base}/${photo.id}`,
    download_url: `${base}/${photo.id}?download=1`,
  }))

  return NextResponse.json({
    data: {
      title: book.title,
      tour_date: book.tour_date,
      description: book.description,
      expires_at: book.expires_at,
      photos: signedPhotos.filter((photo) => photo.view_url && photo.download_url),
    },
  })
}

