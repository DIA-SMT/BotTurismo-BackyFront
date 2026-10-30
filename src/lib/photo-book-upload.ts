import { randomUUID } from 'crypto'
import { createSignedUploadUrl, listArchives, removeArchives, uploadArchive } from '@/lib/archivos'
import { getSql, rowValues } from '@/lib/db'
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  PHOTO_BOOK_BUCKET,
  sanitizeFileName,
} from '@/lib/photo-books'

const allowedImageTypes = new Set<string>(ALLOWED_PHOTO_MIME_TYPES)

export function validatePhotoFiles(photos: File[]) {
  const invalidPhoto = photos.find((photo) => !allowedImageTypes.has(photo.type) || photo.size > MAX_PHOTO_SIZE_BYTES)
  if (!invalidPhoto) return null

  return `La foto "${invalidPhoto.name}" no es válida o supera los 15 MB.`
}

// ── Subida directa al almacenamiento con URLs firmadas ──
// El server solo firma las URLs de subida y registra las filas; los bytes van
// del navegador con un PUT a /api/archivos (que los guarda en el disco). Así
// las fotos suben en paralelo, cada una por su lado, y los bodies grandes no
// pasan por las rutas JSON de la API.

export interface PhotoUploadDescriptor {
  name: string
  type: string
  size: number
}

export function parsePhotoDescriptors(value: unknown): PhotoUploadDescriptor[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      name: String((item as Record<string, unknown>)?.name ?? '').slice(0, 200),
      type: String((item as Record<string, unknown>)?.type ?? ''),
      size: Number((item as Record<string, unknown>)?.size ?? 0),
    }))
    .filter((item) => item.name)
}

export function validatePhotoDescriptors(photos: PhotoUploadDescriptor[]) {
  const invalid = photos.find(
    (photo) => !allowedImageTypes.has(photo.type) || !Number.isFinite(photo.size) || photo.size <= 0 || photo.size > MAX_PHOTO_SIZE_BYTES,
  )
  if (!invalid) return null
  return `La foto "${invalid.name}" no es válida o supera los 15 MB.`
}

export interface SignedPhotoUpload {
  path: string
  signedUrl: string
  name: string
  // Miniatura (2026-10-10): la grilla de la galería carga esta y no la grande.
  thumbPath: string
  thumbSignedUrl: string
}

export async function createSignedPhotoUploads({
  bookId,
  photos,
  startSortOrder,
}: {
  bookId: string
  photos: PhotoUploadDescriptor[]
  startSortOrder: number
}): Promise<{ uploads: SignedPhotoUpload[]; error: unknown }> {
  // Con Supabase cada firma era un pedido por red: firmar de a una tardaba ~8 s
  // con 30 fotos y una sola firma lenta tumbaba el book entero (reporte de
  // guías 2026-09-21), por eso se firmaba en tandas y con reintento. Ahora la
  // firma es un HMAC local e instantáneo: si falla (falta AUTH_SECRET, nombre
  // inválido) falla igual para todas, así que no hay nada que reintentar.
  try {
    const uploads = photos.map((photo, index): SignedPhotoUpload => {
      const displayOrder = startSortOrder + index + 1
      const base = `${bookId}/${String(displayOrder).padStart(3, '0')}-${randomUUID()}-${sanitizeFileName(photo.name)}`
      const thumbBase = `${bookId}/thumb-${String(displayOrder).padStart(3, '0')}-${randomUUID()}-${sanitizeFileName(photo.name)}`
      return {
        path: base,
        signedUrl: createSignedUploadUrl(PHOTO_BOOK_BUCKET, base),
        name: photo.name,
        thumbPath: thumbBase,
        thumbSignedUrl: createSignedUploadUrl(PHOTO_BOOK_BUCKET, thumbBase),
      }
    })
    return { uploads, error: null }
  } catch (error) {
    return { uploads: [], error }
  }
}

// Registra en la base las fotos que el navegador ya subió con las URLs
// firmadas. Verifica contra el disco que los archivos existan (no confía en
// el cliente).
export async function registerUploadedPhotos({
  bookId,
  photos,
  startSortOrder,
}: {
  bookId: string
  photos: Array<PhotoUploadDescriptor & { path: string; thumbPath?: string }>
  startSortOrder: number
}): Promise<{ data: unknown[]; error: unknown }> {
  const outsideBook = photos.find(
    (photo) => !photo.path.startsWith(`${bookId}/`) || (photo.thumbPath && !photo.thumbPath.startsWith(`${bookId}/`)),
  )
  if (outsideBook) return { data: [], error: new Error('path fuera del book') }

  let objects: string[]
  try {
    objects = await listArchives(PHOTO_BOOK_BUCKET, bookId)
  } catch (listError) {
    return { data: [], error: listError }
  }

  const existing = new Set(objects.map((name) => `${bookId}/${name}`))
  const missing = photos.find((photo) => !existing.has(photo.path))
  if (missing) return { data: [], error: new Error(`no está en el almacenamiento: ${missing.path}`) }

  const rows = photos.map((photo, index) => ({
    book_id: bookId,
    storage_path: photo.path,
    // Si la miniatura no llegó a subir, se queda en null y la galería cae a la
    // imagen grande: mejor eso que perder la foto.
    thumb_path: photo.thumbPath && existing.has(photo.thumbPath) ? photo.thumbPath : null,
    original_name: photo.name,
    mime_type: photo.type,
    size_bytes: photo.size,
    sort_order: startSortOrder + index,
  }))

  try {
    const sql = getSql()
    const data = await sql`insert into photo_book_photos ${rowValues(sql, rows)} returning *`
    return { data: [...data], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

export async function uploadPhotoFilesToBook({
  bookId,
  photos,
  startSortOrder,
}: {
  bookId: string
  photos: File[]
  startSortOrder: number
}) {
  const uploadedPaths: string[] = []
  const photoRows = []

  try {
    for (const [index, photo] of photos.entries()) {
      const displayOrder = startSortOrder + index + 1
      const storagePath = `${bookId}/${String(displayOrder).padStart(3, '0')}-${randomUUID()}-${sanitizeFileName(photo.name)}`
      const bytes = Buffer.from(await photo.arrayBuffer())
      await uploadArchive(PHOTO_BOOK_BUCKET, storagePath, bytes, { upsert: false })

      uploadedPaths.push(storagePath)
      photoRows.push({
        book_id: bookId,
        storage_path: storagePath,
        original_name: photo.name,
        mime_type: photo.type,
        size_bytes: photo.size,
        sort_order: startSortOrder + index,
      })
    }

    const sql = getSql()
    const data = await sql`insert into photo_book_photos ${rowValues(sql, photoRows)} returning *`

    return { data: [...data], error: null }
  } catch (error) {
    if (uploadedPaths.length) {
      await removeArchives(PHOTO_BOOK_BUCKET, uploadedPaths).catch((removeError) =>
        console.error('No se pudieron borrar las fotos de una subida fallida:', removeError),
      )
    }
    return { data: [], error }
  }
}
