import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// Margen de sobra para firmar/registrar tandas grandes de fotos (el default
// de la plataforma es 10 s y con 30 fotos se quedaba corto).
export const runtime = 'nodejs'
export const maxDuration = 60

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const payload = await request.json()
  const title = String(payload.title || '').trim()
  const tourDate = String(payload.tour_date || '').trim()
  const description = String(payload.description || '').trim()
  const guideName = String(payload.guide_name || '').trim().slice(0, 80)
  const peopleCount = Number(payload.people_count)

  if (!title || !guideName || !/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
    return NextResponse.json({ error: 'Completá el recorrido, el guía y la fecha.' }, { status: 400 })
  }
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 500) {
    return NextResponse.json({ error: 'Indicá cuántas personas participaron (entre 1 y 500).' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('photo_books')
    .update({
      title,
      tour_date: tourDate,
      description: description || null,
      guide_name: guideName,
      people_count: peopleCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, photo_book_photos(id, storage_path, original_name, mime_type, size_bytes, sort_order)')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'No se pudo actualizar el book.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Book no encontrado.' }, { status: 404 })

  // Mantiene alineado el registro histórico por guía; los books anteriores a
  // la migración pueden no tener fila, en ese caso se crea.
  const logRow = { tour_date: tourDate, title, guide_name: guideName, people_count: peopleCount }
  const { data: logUpdated, error: logError } = await supabase
    .from('tour_guide_log')
    .update(logRow)
    .eq('book_id', id)
    .select('id')
  if (!logError && (logUpdated || []).length === 0) {
    await supabase.from('tour_guide_log').insert({ ...logRow, book_id: id })
  } else if (logError) {
    console.error('No se pudo actualizar el registro de guías:', logError.message)
  }

  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: photos } = await supabase
    .from('photo_book_photos')
    .select('storage_path')
    .eq('book_id', id)

  const paths = (photos || []).map((photo) => photo.storage_path)
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(PHOTO_BOOK_BUCKET).remove(paths)
    if (storageError) {
      return NextResponse.json({ error: 'No se pudieron eliminar las fotos del almacenamiento.' }, { status: 500 })
    }
  }

  const { error } = await supabase.from('photo_books').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar el book.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
