import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { parsePhotoDescriptors, registerUploadedPhotos, validatePhotoDescriptors } from '@/lib/photo-book-upload'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// Registra en la base las fotos que el navegador ya subió a Storage con las
// URLs firmadas (verifica contra el bucket que los archivos existan).
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
  }))

  if (photos.length === 0 || photos.some((photo) => !photo.path)) {
    return NextResponse.json({ error: 'No hay fotos para registrar.' }, { status: 400 })
  }

  const validationError = validatePhotoDescriptors(photos)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data: book, error: bookError } = await supabase
    .from('photo_books')
    .select('id, photo_book_photos(id, sort_order)')
    .eq('id', id)
    .maybeSingle()

  if (bookError) return NextResponse.json({ error: 'No se pudo validar el book.' }, { status: 500 })
  if (!book) return NextResponse.json({ error: 'Book no encontrado.' }, { status: 404 })

  const currentPhotos = book.photo_book_photos || []
  const highestSortOrder = currentPhotos.reduce((max, photo) => Math.max(max, photo.sort_order ?? -1), -1)

  const { error: registerError } = await registerUploadedPhotos({
    supabase,
    bookId: id,
    photos,
    startSortOrder: highestSortOrder + 1,
  })
  if (registerError) {
    console.error('No se pudieron registrar las fotos subidas:', registerError)
    return NextResponse.json({ error: 'No se pudieron registrar las fotos subidas.' }, { status: 500 })
  }

  const { data: updatedBook, error: updatedError } = await supabase
    .from('photo_books')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, photo_book_photos(id, storage_path, original_name, mime_type, size_bytes, sort_order)')
    .single()

  if (updatedError || !updatedBook) {
    return NextResponse.json({ error: 'Las fotos se registraron, pero no se pudo refrescar el book.' }, { status: 500 })
  }

  return NextResponse.json({ data: updatedBook, added_count: photos.length })
}
