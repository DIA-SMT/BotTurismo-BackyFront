import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql } from '@/lib/db'
import { parsePhotoDescriptors, registerUploadedPhotos, validatePhotoDescriptors } from '@/lib/photo-book-upload'

// maxDuration era para Vercel (su default de 10 s no alcanzaba para firmar y
// registrar 30 fotos). Con `next start` en nuestro servidor no tiene efecto:
// el tope lo pone, si acaso, el timeout del proxy (nginx).
export const runtime = 'nodejs'
export const maxDuration = 60

type BookSlots = { id: string; photo_book_photos: Array<{ id: string; sort_order: number }> }

// Registra en la base las fotos que el navegador ya subió con las URLs
// firmadas (verifica contra el disco que los archivos existan).
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const descriptors = parsePhotoDescriptors(payload.photos)
  const rawItems = Array.isArray(payload.photos) ? (payload.photos as Array<Record<string, unknown>>) : []
  const photos = descriptors.map((descriptor, index) => ({
    ...descriptor,
    path: String(rawItems[index]?.path ?? ''),
    thumbPath: rawItems[index]?.thumbPath ? String(rawItems[index].thumbPath) : undefined,
  }))

  if (photos.length === 0 || photos.some((photo) => !photo.path)) {
    return NextResponse.json({ error: 'No hay fotos para registrar.' }, { status: 400 })
  }

  const validationError = validatePhotoDescriptors(photos)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const sql = getSql()
  let book: BookSlots | null
  try {
    const rows = await sql<BookSlots[]>`
      select b.id,
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

  const currentPhotos = book.photo_book_photos || []
  const highestSortOrder = currentPhotos.reduce((max, photo) => Math.max(max, photo.sort_order ?? -1), -1)

  const { error: registerError } = await registerUploadedPhotos({
    bookId: id,
    photos,
    startSortOrder: highestSortOrder + 1,
  })
  if (registerError) {
    console.error('No se pudieron registrar las fotos subidas:', registerError)
    return NextResponse.json({ error: 'No se pudieron registrar las fotos subidas.' }, { status: 500 })
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
    return NextResponse.json({ error: 'Las fotos se registraron, pero no se pudo refrescar el book.' }, { status: 500 })
  }

  return NextResponse.json({ data: updatedBook, added_count: photos.length })
}
