import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import { uploadPhotoFilesToBook, validatePhotoFiles } from '@/lib/photo-book-upload'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('photo_books')
    .select('*, photo_book_photos(id, storage_path, original_name, mime_type, size_bytes, sort_order)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener los books de fotos.' }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const formData = await request.formData()
  const title = String(formData.get('title') || '').trim()
  const tourDate = String(formData.get('tour_date') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const photos = formData.getAll('photos').filter((item): item is File => item instanceof File && item.size > 0)

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
    return NextResponse.json({ error: 'Completá el nombre y la fecha del recorrido.' }, { status: 400 })
  }
  if (photos.length === 0 || photos.length > MAX_PHOTOS_PER_BOOK) {
    return NextResponse.json({ error: `Seleccioná entre 1 y ${MAX_PHOTOS_PER_BOOK} fotos.` }, { status: 400 })
  }

  const validationError = validatePhotoFiles(photos)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: book, error: bookError } = await supabase
    .from('photo_books')
    .insert({ title, tour_date: tourDate, description: description || null, expires_at: expiresAt })
    .select('*')
    .single()

  if (bookError || !book) {
    return NextResponse.json({ error: 'No se pudo crear el book de fotos.' }, { status: 500 })
  }

  const uploadResult = await uploadPhotoFilesToBook({ supabase, bookId: book.id, photos, startSortOrder: 0 })
  if (uploadResult.error) {
    await supabase.from('photo_books').delete().eq('id', book.id)
    return NextResponse.json({ error: 'No se pudieron subir todas las fotos. No se guardó el book.' }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      ...book,
      photo_count: photos.length,
      access_url: `${request.nextUrl.origin}/fotos/${book.access_token}`,
    },
  }, { status: 201 })
}
