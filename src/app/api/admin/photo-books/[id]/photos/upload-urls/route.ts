import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql } from '@/lib/db'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import { createSignedPhotoUploads, parsePhotoDescriptors, validatePhotoDescriptors } from '@/lib/photo-book-upload'

// maxDuration era para Vercel (su default de 10 s no alcanzaba para firmar y
// registrar 30 fotos). Con `next start` en nuestro servidor no tiene efecto:
// el tope lo pone, si acaso, el timeout del proxy (nginx).
export const runtime = 'nodejs'
export const maxDuration = 60

type BookSlots = { id: string; expires_at: string; photo_book_photos: Array<{ id: string; sort_order: number }> }

// URLs firmadas para AGREGAR fotos a un book existente (el navegador sube
// directo con un PUT a /api/archivos y después registra con /photos/register).
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

  const photos = parsePhotoDescriptors(payload.photos)
  if (photos.length === 0) {
    return NextResponse.json({ error: 'Seleccioná al menos una foto.' }, { status: 400 })
  }

  const validationError = validatePhotoDescriptors(photos)
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
  const availableSlots = MAX_PHOTOS_PER_BOOK - currentPhotos.length
  if (availableSlots <= 0) {
    return NextResponse.json({ error: `Este book ya alcanzó el máximo de ${MAX_PHOTOS_PER_BOOK} fotos.` }, { status: 400 })
  }
  if (photos.length > availableSlots) {
    return NextResponse.json(
      { error: `Este book tiene ${currentPhotos.length} fotos. Solo podés agregar ${availableSlots} más.` },
      { status: 400 },
    )
  }

  const highestSortOrder = currentPhotos.reduce((max, photo) => Math.max(max, photo.sort_order ?? -1), -1)
  const { uploads, error } = await createSignedPhotoUploads({
    bookId: id,
    photos,
    startSortOrder: highestSortOrder + 1,
  })
  if (error) {
    return NextResponse.json({ error: 'No se pudieron preparar las subidas.' }, { status: 500 })
  }

  return NextResponse.json({ uploads })
}
