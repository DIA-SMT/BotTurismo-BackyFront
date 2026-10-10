import { NextRequest, NextResponse } from 'next/server'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: book, error } = await supabase
    .from('photo_books')
    .select('id, title, tour_date, description, expires_at, photo_book_photos(*)')
    .eq('access_token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  // Distinguir "no existe" de "la base no responde": durante la caída por
  // cuota (2026-10-10) los turistas veían "no existe o venció" cuando sus
  // fotos estaban perfectamente guardadas, y daban el link por perdido.
  if (error) {
    console.error('No se pudo leer el book:', error.message)
    return NextResponse.json(
      { error: 'No pudimos abrir tus fotos en este momento. Volvé a intentar en un rato: siguen guardadas.' },
      { status: 503 },
    )
  }
  if (!book) {
    return NextResponse.json({ error: 'Este book no existe o ya venció.' }, { status: 404 })
  }

  // URLs propias y ESTABLES (no firmadas): así el CDN las cachea y cada foto
  // sale una sola vez de Supabase, en vez de una vez por turista. La grilla usa
  // thumb_url (miniatura liviana) y la grande solo se pide al ampliar.
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

