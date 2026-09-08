import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import { createSignedPhotoUploads, parsePhotoDescriptors, validatePhotoDescriptors } from '@/lib/photo-book-upload'
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

  // Registro histórico para el conteo de recorridos por guía (si la tabla
  // todavía no existe, se devuelve vacío sin romper el listado).
  const { data: guideLog, error: guideLogError } = await supabase
    .from('tour_guide_log')
    .select('id, created_at, book_id, tour_date, title, guide_name, people_count')
    .order('tour_date', { ascending: false })

  if (guideLogError) {
    console.error('No se pudo obtener el registro de guías:', guideLogError.message)
  }

  return NextResponse.json({ data: data || [], guideLog: guideLog || [] })
}

// Crea el book y devuelve URLs firmadas para que el navegador suba las fotos
// DIRECTO a Supabase Storage (los bodies por Vercel se cortan en ~4,5 MB, así
// que las fotos no pueden viajar por esta función). El cliente después llama
// a /[id]/photos/register para registrar las que subió.
export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const title = String(payload.title || '').trim()
  const tourDate = String(payload.tour_date || '').trim()
  const description = String(payload.description || '').trim()
  const guideName = String(payload.guide_name || '').trim().slice(0, 80)
  const peopleCount = Number(payload.people_count)
  const photos = parsePhotoDescriptors(payload.photos)

  if (!title || !guideName || !/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
    return NextResponse.json({ error: 'Completá el recorrido, el guía y la fecha.' }, { status: 400 })
  }
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 500) {
    return NextResponse.json({ error: 'Indicá cuántas personas participaron (entre 1 y 500).' }, { status: 400 })
  }
  if (photos.length === 0 || photos.length > MAX_PHOTOS_PER_BOOK) {
    return NextResponse.json({ error: `Seleccioná entre 1 y ${MAX_PHOTOS_PER_BOOK} fotos.` }, { status: 400 })
  }

  const validationError = validatePhotoDescriptors(photos)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: book, error: bookError } = await supabase
    .from('photo_books')
    .insert({ title, tour_date: tourDate, description: description || null, guide_name: guideName, people_count: peopleCount, expires_at: expiresAt })
    .select('*')
    .single()

  if (bookError || !book) {
    return NextResponse.json({ error: 'No se pudo crear el book de fotos.' }, { status: 500 })
  }

  // Registro histórico por guía: sobrevive a la limpieza semanal de books.
  // Si falla no se frena la creación (solo se pierde una fila de estadística).
  const { error: logError } = await supabase
    .from('tour_guide_log')
    .insert({ book_id: book.id, tour_date: tourDate, title, guide_name: guideName, people_count: peopleCount })
  if (logError) {
    console.error('No se pudo registrar el recorrido en tour_guide_log:', logError.message)
  }

  const { uploads, error: uploadsError } = await createSignedPhotoUploads({
    supabase,
    bookId: book.id,
    photos,
    startSortOrder: 0,
  })
  if (uploadsError) {
    await supabase.from('photo_books').delete().eq('id', book.id)
    return NextResponse.json({ error: 'No se pudieron preparar las subidas. No se guardó el book.' }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      ...book,
      access_url: `${request.nextUrl.origin}/fotos/${book.access_token}`,
    },
    uploads,
  }, { status: 201 })
}
