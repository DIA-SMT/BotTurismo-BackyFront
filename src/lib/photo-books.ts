export const PHOTO_BOOK_BUCKET = 'tour-photo-books'
export const PHOTO_BOOK_LIFETIME_DAYS = 7
export const MAX_PHOTOS_PER_BOOK = 30
export const MAX_PHOTO_SIZE_BYTES = 15 * 1024 * 1024
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const

export interface PhotoBookPhoto {
  id: string
  book_id: string
  created_at: string
  storage_path: string
  original_name: string
  mime_type: string
  size_bytes: number
  sort_order: number
}

export interface PhotoBook {
  id: string
  created_at: string
  updated_at: string
  title: string
  tour_date: string
  description: string | null
  access_token: string
  expires_at: string
  photo_book_photos?: PhotoBookPhoto[]
}

export function sanitizeFileName(name: string) {
  const extension = name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : ''
  const base = name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `${base || 'foto'}${extension}`
}
