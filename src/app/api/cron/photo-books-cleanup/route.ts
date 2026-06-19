import { NextRequest, NextResponse } from 'next/server'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const { data: expiredBooks, error } = await supabase
    .from('photo_books')
    .select('id, photo_book_photos(storage_path)')
    .lte('expires_at', new Date().toISOString())
    .limit(100)

  if (error) return NextResponse.json({ error: 'No se pudieron consultar los books vencidos.' }, { status: 500 })

  let deletedBooks = 0
  let deletedPhotos = 0

  for (const book of expiredBooks || []) {
    const paths = (book.photo_book_photos || []).map((photo) => photo.storage_path)
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(PHOTO_BOOK_BUCKET).remove(paths)
      if (storageError) continue
    }

    const { error: deleteError } = await supabase.from('photo_books').delete().eq('id', book.id)
    if (!deleteError) {
      deletedBooks += 1
      deletedPhotos += paths.length
    }
  }

  return NextResponse.json({ ok: true, deleted_books: deletedBooks, deleted_photos: deletedPhotos })
}

