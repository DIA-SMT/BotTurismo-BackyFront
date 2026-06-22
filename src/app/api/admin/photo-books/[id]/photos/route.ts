import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import { uploadPhotoFilesToBook, validatePhotoFiles } from '@/lib/photo-book-upload'
import { createServerSupabaseClient } from '@/lib/server-supabase'

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
    supabase,
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

  const { data: updatedBook, error: updatedError } = await supabase
    .from('photo_books')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, photo_book_photos(id, storage_path, original_name, mime_type, size_bytes, sort_order)')
    .single()

  if (updatedError) {
    return NextResponse.json({ error: 'Las fotos se subieron, pero no se pudo refrescar el book.' }, { status: 500 })
  }

  return NextResponse.json({
    data: updatedBook,
    added_count: uploadResult.data.length,
  })
}
