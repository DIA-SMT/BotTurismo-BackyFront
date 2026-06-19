import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import {
  MAX_PHOTOS_PER_BOOK,
  MAX_PHOTO_SIZE_BYTES,
  PHOTO_BOOK_BUCKET,
  sanitizeFileName,
} from '@/lib/photo-books'
import { createServerSupabaseClient } from '@/lib/server-supabase'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('photo_books')
    .select('*, photo_book_photos(id, storage_path, original_name, size_bytes, sort_order)')
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
  const invalidPhoto = photos.find((photo) => !ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size > MAX_PHOTO_SIZE_BYTES)
  if (invalidPhoto) {
    return NextResponse.json(
      { error: `La foto "${invalidPhoto.name}" no es válida o supera los 15 MB.` },
      { status: 400 },
    )
  }

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

  const uploadedPaths: string[] = []
  const photoRows = []

  try {
    for (const [index, photo] of photos.entries()) {
      const storagePath = `${book.id}/${String(index + 1).padStart(3, '0')}-${randomUUID()}-${sanitizeFileName(photo.name)}`
      const bytes = Buffer.from(await photo.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BOOK_BUCKET)
        .upload(storagePath, bytes, { contentType: photo.type, upsert: false })

      if (uploadError) throw uploadError
      uploadedPaths.push(storagePath)
      photoRows.push({
        book_id: book.id,
        storage_path: storagePath,
        original_name: photo.name,
        mime_type: photo.type,
        size_bytes: photo.size,
        sort_order: index,
      })
    }

    const { error: photoRowsError } = await supabase.from('photo_book_photos').insert(photoRows)
    if (photoRowsError) throw photoRowsError
  } catch {
    if (uploadedPaths.length) await supabase.storage.from(PHOTO_BOOK_BUCKET).remove(uploadedPaths)
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

