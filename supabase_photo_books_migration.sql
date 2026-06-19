-- Books privados de fotos de recorridos.
-- Ejecutar una vez en el SQL Editor de Supabase.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS photo_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT NOT NULL,
  tour_date DATE NOT NULL,
  description TEXT,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE IF NOT EXISTS photo_book_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES photo_books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_photo_books_expires_at ON photo_books (expires_at);
CREATE INDEX IF NOT EXISTS idx_photo_books_tour_date ON photo_books (tour_date DESC);
CREATE INDEX IF NOT EXISTS idx_photo_book_photos_book_id ON photo_book_photos (book_id, sort_order);

DROP TRIGGER IF EXISTS photo_books_updated_at ON photo_books;
CREATE TRIGGER photo_books_updated_at
  BEFORE UPDATE ON photo_books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE photo_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_book_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_photo_books" ON photo_books;
CREATE POLICY "service_role_full_access_photo_books" ON photo_books
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_photo_book_photos" ON photo_book_photos;
CREATE POLICY "service_role_full_access_photo_book_photos" ON photo_book_photos
  FOR ALL USING (auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'tour-photo-books',
  'tour-photo-books',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'tour-photo-books'
);
