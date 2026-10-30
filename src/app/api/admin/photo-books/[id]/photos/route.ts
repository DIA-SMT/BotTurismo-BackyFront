import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createSignedReadUrl } from '@/lib/archivos'
import { getSql } from '@/lib/db'
import { MAX_PHOTOS_PER_BOOK, PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
import { uploadPhotoFilesToBook, validatePhotoFiles } from '@/lib/photo-book-upload'

// maxDuration era para Vercel (su default de 10 s no alcanzaba para firmar y
// registrar 30 fotos). Con `next start` en nuestro servidor no tiene efecto:
// el tope lo pone, si acaso, el timeout del proxy (nginx).
export const runtime = 'nodejs'
export const maxDuration = 60

type PreviewRow = { id: string; original_name: string; storage_path: string; sort_order: number }
type BookSlots = { id: string; expires_at: string; photo_book_photos: Array<{ id: string; sort_order: number }> }

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const sql = getSql()
  let photos: PreviewRow[]
  try {
    photos = await sql<PreviewRow[]>`
      select id, original_name, storage_path, sort_order
      from photo_book_photos
      where book_id = ${id}
      order by sort_order asc
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar las previsualizaciones.' }, { status: 500 })
  }

  const previews = photos.map((photo) => {
    let previewUrl = ''
    try {
      previewUrl = createSignedReadUrl(PHOTO_BOOK_BUCKET, photo.storage_path, 60 * 60)
    } catch {
      // Sin URL la foto queda afuera de las previsualizaciones (filtro de abajo).
    }
    return {
      id: photo.id,
      name: photo.original_name,
      preview_url: previewUrl,
      sort_order: photo.sort_order,
    }
  })

  return NextResponse.json({ data: previews.filter((photo) => photo.preview_url) })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const formData = await request.formData()
  const photos = formData.getAll('photos').filter((item): item is File => item instanceof File && item.size > 0)

  if (photos.length === 0) {
    return NextResponse.json({ error: 'Seleccioná al menos una foto.' }, { status: 400 })
  }

  const validationError = validatePhotoFiles(photos)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const sql = getSql()
  let book: BookSlots | null
  try {
    const rows = await sql<BookSlots[]>`
      select b.id, b.expires_at,
        coalesce((
          select json_agg(json_build_object('id', p.id, 'sort_order', p.sort_order) order by p.sort_order, p.created_at)
          from photo_book_photos p
          where p.book_id = b.id
        ), '[]'::json) as photo_book_photos
      from photo_books b
      where b.id = ${id}
    `
    book = rows[0] ?? null
  } catch {
    return NextResponse.json({ error: 'No se pudo validar el book.' }, { status: 500 })
  }

  if (!book) return NextResponse.json({ error: 'Book no encontrado.' }, { status: 404 })
  if (new Date(book.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'No se pueden agregar fotos a un book vencido.' }, { status: 400 })
  }

  const currentPhotos = book.photo_book_photos || []
  const currentCount = currentPhotos.length
  const availableSlots = MAX_PHOTOS_PER_BOOK - currentCount

  if (availableSlots <= 0) {
    return NextResponse.json({ error: `Este book ya alcanzó el máximo de ${MAX_PHOTOS_PER_BOOK} fotos.` }, { status: 400 })
  }
  if (photos.length > availableSlots) {
    return NextResponse.json(
      { error: `Este book tiene ${currentCount} fotos. Solo podés agregar ${availableSlots} más.` },
      { status: 400 },
    )
  }

  const highestSortOrder = currentPhotos.reduce((max, photo) => Math.max(max, photo.sort_order ?? -1), -1)
  const uploadResult = await uploadPhotoFilesToBook({
    bookId: id,
    photos,
    startSortOrder: highestSortOrder + 1,
  })

  if (uploadResult.error) {
    return NextResponse.json(
      { error: 'No se pudieron subir todas las fotos. El book quedó sin cambios.' },
      { status: 500 },
    )
  }

  let updatedBook: unknown
  try {
    const rows = await sql`
      update photo_books b set updated_at = ${new Date().toISOString()}
      where b.id = ${id}
      returning b.*,
        coalesce((
          select json_agg(json_build_object(
            'id', p.id,
            'storage_path', p.storage_path,
            'original_name', p.original_name,
            'mime_type', p.mime_type,
            'size_bytes', p.size_bytes,
            'sort_order', p.sort_order
          ) order by p.sort_order, p.created_at)
          from photo_book_photos p
          where p.book_id = b.id
        ), '[]'::json) as photo_book_photos
    `
    updatedBook = rows[0]
  } catch {
    // Cae en el mismo 500 de abajo.
  }

  if (!updatedBook) {
    return NextResponse.json({ error: 'Las fotos se subieron, pero no se pudo refrescar el book.' }, { status: 500 })
  }

  return NextResponse.json({
    data: updatedBook,
    added_count: uploadResult.data.length,
  })
}
