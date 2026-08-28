-- Baja autogestionada de reservas turisticas: cada reserva recibe un token
-- unico que viaja en el mail de confirmacion como link "Cancelar mi reserva".
-- Ejecutar una vez en el SQL Editor de Supabase.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE tourist_bookings
  ADD COLUMN IF NOT EXISTS cancel_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_tourist_bookings_cancel_token
  ON tourist_bookings (cancel_token);
