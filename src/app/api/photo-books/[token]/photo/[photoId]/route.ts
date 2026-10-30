import { NextRequest, NextResponse } from 'next/server'
import { readArchive } from '@/lib/archivos'
import { getSql } from '@/lib/db'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'

export const runtime = 'nodejs'

type PhotoBookForServing = {
  id: string
  expires_at: string
  photo_book_photos: Array<{
    id: string
    storage_path: string
    thumb_path: string | null
    original_name: string
    mime_type: string
  }>
}

// Sirve una foto del book desde el disco de NUESTRO servidor, con URL estable
// para que el navegador (y cualquier caché delante) la pueda reutilizar.
//
// Historia: con Supabase cada visitante recibía una URL firmada distinta
// (válida 1 hora), así que el CDN no podía cachear nada y las mismas fotos
// salían de Supabase una vez por turista. Eso agotó la cuota de egress
// (2026-10-10) y por eso nació esta ruta. Hoy los archivos están en nuestro
// disco y no hay cuota de egress, pero la URL estable sigue ahorrando ancho de
// banda: cada navegador baja la foto una sola vez.
//
// La privacidad se mantiene: hay que tener el token del book (el del QR) y el
// book no tiene que estar vencido. Además el caché nunca dura más que lo que
// le queda de vida al book, así que una foto no sobrevive a su vencimiento.
export async function GET(request: NextRequest, context: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await context.params
  const wantsThumb = request.nextUrl.searchParams.get('size') === 'thumb'
  const asDownload = request.nextUrl.searchParams.get('download') === '1'

  const sql = getSql()
  let book: PhotoBookForServing | null
  try {
    const rows = await sql<PhotoBookForServing[]>`
      select b.id, b.expires_at,
        coalesce((
          select json_agg(json_build_object(
            'id', p.id,
            'storage_path', p.storage_path,
            'thumb_path', p.thumb_path,
            'original_name', p.original_name,
            'mime_type', p.mime_type
          ))
          from photo_book_photos p
          where p.book_id = b.id
        ), '[]'::json) as photo_book_photos
      from photo_books b
      where b.access_token = ${token}
        and b.expires_at > ${new Date().toISOString()}
    `
    book = rows[0] ?? null
  } catch (error) {
    console.error('No se pudo leer el book para servir la foto:', (error as Error).message)
    return NextResponse.json({ error: 'No pudimos abrir la foto en este momento.' }, { status: 503 })
  }
  if (!book) {
    return NextResponse.json({ error: 'Este book no existe o ya venció.' }, { status: 404 })
  }

  const photo = (book.photo_book_photos || []).find((item) => item.id === photoId)
  if (!photo) {
    return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 })
  }

  // Fotos anteriores a las miniaturas: se sirve la grande también en la grilla.
  const path = wantsThumb && photo.thumb_path ? photo.thumb_path : photo.storage_path
  let file: Buffer | null = null
  try {
    file = await readArchive(PHOTO_BOOK_BUCKET, path)
  } catch {
    // Cae en el mismo 502 de abajo.
  }
  if (!file) {
    return NextResponse.json({ error: 'No se pudo abrir la foto.' }, { status: 502 })
  }

  // El caché expira junto con el book (tope de 7 días, piso de 1 minuto).
  const secondsLeft = Math.floor((new Date(book.expires_at).getTime() - Date.now()) / 1000)
  const maxAge = Math.max(60, Math.min(secondsLeft, 7 * 24 * 60 * 60))

  const headers: Record<string, string> = {
    'Content-Type': photo.mime_type || 'image/jpeg',
    // s-maxage: lo que cachea un caché compartido (CDN/proxy). max-age: lo que
    // cachea el navegador.
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, immutable`,
  }
  if (asDownload) {
    const safeName = (photo.original_name || 'foto.jpg').replace(/["\\]/g, '')
    headers['Content-Disposition'] = `attachment; filename="${safeName}"`
  }

  return new NextResponse(new Uint8Array(file), { status: 200, headers })
}
