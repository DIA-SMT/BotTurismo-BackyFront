import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import type { PhotoBook } from '@/lib/photo-books'
import { createSignedPhotoUploads, parsePhotoDescriptors, validatePhotoDescriptors } from '@/lib/photo-book-upload'

// maxDuration era para Vercel (su default de 10 s no alcanzaba para firmar y
// registrar 30 fotos). Con `next start` en nuestro servidor no tiene efecto:
// el tope lo pone, si acaso, el timeout del proxy (nginx).
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const sql = getSql()
  let data: readonly unknown[]
  try {
    data = await sql`
      select b.*,
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
      from photo_books b
      order by b.created_at desc
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener los books de fotos.' }, { status: 500 })
  }

  // Registro histórico para el conteo de recorridos por guía (si la tabla
  // todavía no existe, se devuelve vacío sin romper el listado).
  let guideLog: readonly unknown[] = []
  try {
    guideLog = await sql`
      select id, created_at, book_id, tour_date, title, guide_name, people_count
      from tour_guide_log
      order by tour_date desc
    `
  } catch (guideLogError) {
    console.error('No se pudo obtener el registro de guías:', (guideLogError as Error).message)
  }

  return NextResponse.json({ data, guideLog })
}

// Crea el book y devuelve URLs firmadas para que el navegador suba las fotos
// con un PUT directo a /api/archivos (en paralelo, y sin meter bodies grandes
// en esta ruta JSON). El cliente después llama a /[id]/photos/register para
// registrar las que subió.
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

  const sql = getSql()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  let book: PhotoBook | undefined
  try {
    const rows = await sql<PhotoBook[]>`
      insert into photo_books ${rowValues(sql, {
        title,
        tour_date: tourDate,
        description: description || null,
        guide_name: guideName,
        people_count: peopleCount,
        expires_at: expiresAt,
      })}
      returning *
    `
    book = rows[0]
  } catch {
    // Cae en el mismo 500 de abajo.
  }

  if (!book) {
    return NextResponse.json({ error: 'No se pudo crear el book de fotos.' }, { status: 500 })
  }

  // Registro histórico por guía: sobrevive a la limpieza semanal de books.
  // Si falla no se frena la creación (solo se pierde una fila de estadística).
  try {
    await sql`
      insert into tour_guide_log ${rowValues(sql, {
        book_id: book.id,
        tour_date: tourDate,
        title,
        guide_name: guideName,
        people_count: peopleCount,
      })}
    `
  } catch (logError) {
    console.error('No se pudo registrar el recorrido en tour_guide_log:', (logError as Error).message)
  }

  const { uploads, error: uploadsError } = await createSignedPhotoUploads({
    bookId: book.id,
    photos,
    startSortOrder: 0,
  })
  if (uploadsError) {
    await sql`delete from photo_books where id = ${book.id}`.catch((error) =>
      console.error('No se pudo borrar el book sin subidas:', error),
    )
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
