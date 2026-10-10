-- Miniaturas de las fotos de los books (2026-10-10).
-- Motivo: la galeria publica servia cada foto a resolucion completa y por
-- visitante, lo que agoto la cuota de egress de Supabase. Ahora cada foto
-- guarda ademas una miniatura liviana que es la que carga la grilla.
-- Las fotos anteriores quedan con thumb_path NULL y siguen mostrandose con
-- la imagen grande (fallback), asi que esta migracion no rompe nada.
-- Ejecutar una vez en el SQL Editor de Supabase (es idempotente).

ALTER TABLE photo_book_photos
  ADD COLUMN IF NOT EXISTS thumb_path TEXT;
