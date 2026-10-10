import { NextRequest, NextResponse } from 'next/server'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export const runtime = 'nodejs'

// Sirve una foto del book a través de NUESTRO servidor, con URL estable para
// que el CDN la pueda cachear.
//
// Antes cada visitante recibía una URL firmada distinta (válida 1 hora), así
// que el CDN no podía cachear nada y las mismas fotos salían de Supabase una
// vez por turista. Eso agotó la cuota de egress (2026-10-10). Ahora la primera
// visita calienta el caché y las siguientes se sirven desde el CDN sin tocar
// Supabase.
//
// La privacidad se mantiene: hay que tener el token del book (el del QR) y el
// book no tiene que estar vencido. Además el caché nunca dura más que lo que
// le queda de vida al book, así que una foto no sobrevive a su vencimiento.
export async function GET(request: NextRequest, context: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await context.params
  const wantsThumb = request.nextUrl.searchParams.get('size') === 'thumb'
  const asDownload = request.nextUrl.searchParams.get('download') === '1'

  const supabase = createServerSupabaseClient()
  const { data: book, error } = await supabase
    .from('photo_books')
    .select('id, expires_at, photo_book_photos(id, storage_path, thumb_path, original_name, mime_type)')
    .eq('access_token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error('No se pudo leer el book para servir la foto:', error.message)
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
  const { data: file, error: downloadError } = await supabase.storage.from(PHOTO_BOOK_BUCKET).download(path)
  if (downloadError || !file) {
    return NextResponse.json({ error: 'No se pudo abrir la foto.' }, { status: 502 })
  }

  // El caché expira junto con el book (tope de 7 días, piso de 1 minuto).
  const secondsLeft = Math.floor((new Date(book.expires_at).getTime() - Date.now()) / 1000)
  const maxAge = Math.max(60, Math.min(secondsLeft, 7 * 24 * 60 * 60))

  const headers: Record<string, string> = {
    'Content-Type': photo.mime_type || 'image/jpeg',
    // s-maxage: lo que cachea el CDN. max-age: lo que cachea el navegador.
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, immutable`,
  }
  if (asDownload) {
    const safeName = (photo.original_name || 'foto.jpg').replace(/["\\]/g, '')
    headers['Content-Disposition'] = `attachment; filename="${safeName}"`
  }

  return new NextResponse(await file.arrayBuffer(), { status: 200, headers })
}
