import { NextRequest, NextResponse } from 'next/server'
import { removeArchives } from '@/lib/archivos'
import { getSql } from '@/lib/db'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'

type ExpiredBook = { id: string; photo_book_photos: Array<{ storage_path: string; thumb_path: string | null }> }

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const sql = getSql()
  let expiredBooks: ExpiredBook[]
  try {
    expiredBooks = await sql<ExpiredBook[]>`
      select b.id,
        coalesce((
          select json_agg(json_build_object('storage_path', p.storage_path, 'thumb_path', p.thumb_path))
          from photo_book_photos p
          where p.book_id = b.id
        ), '[]'::json) as photo_book_photos
      from photo_books b
      where b.expires_at <= ${new Date().toISOString()}
      limit 100
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron consultar los books vencidos.' }, { status: 500 })
  }

  let deletedBooks = 0
  let deletedPhotos = 0

  for (const book of expiredBooks) {
    const photos = book.photo_book_photos || []
    // Cada foto tiene su miniatura aparte: antes quedaban huérfanas para siempre.
    const paths = photos.flatMap((photo) => (photo.thumb_path ? [photo.storage_path, photo.thumb_path] : [photo.storage_path]))
    if (paths.length) {
      try {
        await removeArchives(PHOTO_BOOK_BUCKET, paths)
      } catch {
        continue
      }
    }

    try {
      await sql`delete from photo_books where id = ${book.id}`
      deletedBooks += 1
      deletedPhotos += photos.length
    } catch {
      // Queda para la próxima corrida.
    }
  }

  return NextResponse.json({ ok: true, deleted_books: deletedBooks, deleted_photos: deletedPhotos })
}

