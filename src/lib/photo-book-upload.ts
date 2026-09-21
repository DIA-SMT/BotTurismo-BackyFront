import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
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

// ── Subida directa a Storage con URLs firmadas ──
// Vercel corta los request bodies en ~4,5 MB ("Request Entity Too Large"),
// así que las fotos NO pueden viajar por la función: el server solo firma las
// URLs de subida y registra las filas; los bytes van del navegador a Supabase.

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
}

export async function createSignedPhotoUploads({
  supabase,
  bookId,
  photos,
  startSortOrder,
}: {
  supabase: SupabaseClient
  bookId: string
  photos: PhotoUploadDescriptor[]
  startSortOrder: number
}): Promise<{ uploads: SignedPhotoUpload[]; error: unknown }> {
  // Firmar de a una tardaba ~8 s con 30 fotos (peligrosamente cerca del límite
  // de la función) y una sola firma lenta tumbaba el book entero: reporte de
  // guías 2026-09-21. Ahora se firman en tandas concurrentes y cada firma
  // reintenta una vez antes de darse por perdida.
  const CONCURRENCY = 6
  const uploads: SignedPhotoUpload[] = new Array(photos.length)
  let failure: unknown = null

  const signOne = async (photo: PhotoUploadDescriptor, index: number) => {
    const displayOrder = startSortOrder + index + 1
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const storagePath = `${bookId}/${String(displayOrder).padStart(3, '0')}-${randomUUID()}-${sanitizeFileName(photo.name)}`
      const { data, error } = await supabase.storage.from(PHOTO_BOOK_BUCKET).createSignedUploadUrl(storagePath)
      if (!error && data?.signedUrl) {
        uploads[index] = { path: storagePath, signedUrl: data.signedUrl, name: photo.name }
        return
      }
      failure = error || new Error('sin signedUrl')
    }
  }

  for (let start = 0; start < photos.length; start += CONCURRENCY) {
    const batch = photos.slice(start, start + CONCURRENCY)
    await Promise.all(batch.map((photo, offset) => signOne(photo, start + offset)))
  }

  if (uploads.some((upload) => !upload)) return { uploads: [], error: failure || new Error('firmas incompletas') }
  return { uploads, error: null }
}

// Registra en la base las fotos que el navegador ya subió a Storage. Verifica
// contra el bucket que los archivos existan (no confía en el cliente).
export async function registerUploadedPhotos({
  supabase,
  bookId,
  photos,
  startSortOrder,
}: {
  supabase: SupabaseClient
  bookId: string
  photos: Array<PhotoUploadDescriptor & { path: string }>
  startSortOrder: number
}): Promise<{ data: unknown[]; error: unknown }> {
  const outsideBook = photos.find((photo) => !photo.path.startsWith(`${bookId}/`))
  if (outsideBook) return { data: [], error: new Error('path fuera del book') }

  const { data: objects, error: listError } = await supabase.storage
    .from(PHOTO_BOOK_BUCKET)
    .list(bookId, { limit: 200 })
  if (listError) return { data: [], error: listError }

  const existing = new Set((objects || []).map((object) => `${bookId}/${object.name}`))
  const missing = photos.find((photo) => !existing.has(photo.path))
  if (missing) return { data: [], error: new Error(`no está en Storage: ${missing.path}`) }

  const rows = photos.map((photo, index) => ({
    book_id: bookId,
    storage_path: photo.path,
    original_name: photo.name,
    mime_type: photo.type,
    size_bytes: photo.size,
    sort_order: startSortOrder + index,
  }))

  const { data, error } = await supabase.from('photo_book_photos').insert(rows).select('*')
  return { data: data || [], error }
}

export async function uploadPhotoFilesToBook({
  supabase,
  bookId,
  photos,
  startSortOrder,
}: {
  supabase: SupabaseClient
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
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BOOK_BUCKET)
        .upload(storagePath, bytes, { contentType: photo.type, upsert: false })

      if (uploadError) throw uploadError
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

    const { data, error } = await supabase.from('photo_book_photos').insert(photoRows).select('*')
    if (error) throw error

    return { data: data || [], error: null }
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(PHOTO_BOOK_BUCKET).remove(uploadedPaths)
    return { data: [], error }
  }
}
