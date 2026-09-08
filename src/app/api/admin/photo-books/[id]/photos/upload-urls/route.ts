import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import { createSignedPhotoUploads, parsePhotoDescriptors, validatePhotoDescriptors } from '@/lib/photo-book-upload'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// URLs firmadas para AGREGAR fotos a un book existente (el navegador sube
// directo a Storage y después registra con /photos/register).
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

  const supabase = createServerSupabaseClient()
  const { data: book, error: bookError } = await supabase
    .from('photo_books')
    .select('id, expires_at, photo_book_photos(id, sort_order)')
    .eq('id', id)
    .maybeSingle()

  if (bookError) return NextResponse.json({ error: 'No se pudo validar el book.' }, { status: 500 })
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
    supabase,
    bookId: id,
    photos,
    startSortOrder: highestSortOrder + 1,
  })
  if (error) {
    return NextResponse.json({ error: 'No se pudieron preparar las subidas.' }, { status: 500 })
  }

  return NextResponse.json({ uploads })
}
