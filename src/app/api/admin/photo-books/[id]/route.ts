import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { removeArchives } from '@/lib/archivos'
import { getSql, rowValues } from '@/lib/db'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'

// maxDuration era para Vercel (su default de 10 s no alcanzaba para firmar y
// registrar 30 fotos). Con `next start` en nuestro servidor no tiene efecto:
// el tope lo pone, si acaso, el timeout del proxy (nginx).
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

  const sql = getSql()
  let data: unknown
  try {
    const rows = await sql`
      update photo_books b set ${rowValues(sql, {
        title,
        tour_date: tourDate,
        description: description || null,
        guide_name: guideName,
        people_count: peopleCount,
        updated_at: new Date().toISOString(),
      })}
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
    data = rows[0] ?? null
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el book.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Book no encontrado.' }, { status: 404 })

  // Mantiene alineado el registro histórico por guía; los books anteriores a
  // la migración pueden no tener fila, en ese caso se crea.
  const logRow = { tour_date: tourDate, title, guide_name: guideName, people_count: peopleCount }
  try {
    const logUpdated = await sql`
      update tour_guide_log set ${rowValues(sql, logRow)}
      where book_id = ${id}
      returning id
    `
    if (logUpdated.length === 0) {
      await sql`insert into tour_guide_log ${rowValues(sql, { ...logRow, book_id: id })}`.catch((insertError) =>
        console.error('No se pudo crear la fila del registro de guías:', insertError),
      )
    }
  } catch (logError) {
    console.error('No se pudo actualizar el registro de guías:', (logError as Error).message)
  }

  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const sql = getSql()
  const photos = await sql<{ storage_path: string; thumb_path: string | null }[]>`
    select storage_path, thumb_path from photo_book_photos where book_id = ${id}
  `.catch((photosError) => {
    console.error('No se pudieron leer las fotos del book a eliminar:', photosError)
    return []
  })

  // Cada foto tiene su miniatura aparte: antes quedaban huérfanas para siempre.
  const paths = photos.flatMap((photo) => (photo.thumb_path ? [photo.storage_path, photo.thumb_path] : [photo.storage_path]))
  if (paths.length) {
    try {
      await removeArchives(PHOTO_BOOK_BUCKET, paths)
    } catch {
      return NextResponse.json({ error: 'No se pudieron eliminar las fotos del almacenamiento.' }, { status: 500 })
    }
  }

  try {
    await sql`delete from photo_books where id = ${id}`
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el book.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
