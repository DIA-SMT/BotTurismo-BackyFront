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
