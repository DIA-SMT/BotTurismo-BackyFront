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

  if (error || !book) {
    return NextResponse.json({ error: 'Este book no existe o ya venció.' }, { status: 404 })
  }

  const photos = [...(book.photo_book_photos || [])].sort((a, b) => a.sort_order - b.sort_order)
  const signedPhotos = await Promise.all(photos.map(async (photo) => {
    const [{ data: viewData }, { data: downloadData }] = await Promise.all([
      supabase.storage.from(PHOTO_BOOK_BUCKET).createSignedUrl(photo.storage_path, 60 * 60),
      supabase.storage.from(PHOTO_BOOK_BUCKET).createSignedUrl(photo.storage_path, 60 * 60, {
        download: photo.original_name,
      }),
    ])

    return {
      id: photo.id,
      name: photo.original_name,
      view_url: viewData?.signedUrl || '',
      download_url: downloadData?.signedUrl || '',
    }
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

