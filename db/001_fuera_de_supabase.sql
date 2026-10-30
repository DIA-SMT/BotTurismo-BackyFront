-- ============================================================
-- Turismo fuera de Supabase: deja la base lista para el Postgres de la VPS.
--
-- Se corre UNA vez sobre la base restaurada desde el volcado de Supabase
-- (o sobre una base armada con los supabase_*.sql del repo), como el dueño
-- de la base. Es idempotente: correrla dos veces no rompe nada.
--
-- Antes de esto, si existe auth.users (volcado real), las claves de los
-- admins se copian a admin_profiles: son hashes bcrypt y se siguen
-- validando igual, así que nadie tiene que cambiar su contraseña.
-- ============================================================

BEGIN;

-- ── Admins: auth propio en lugar de Supabase Auth ──

ALTER TABLE admin_profiles DROP CONSTRAINT IF EXISTS admin_profiles_id_fkey;
ALTER TABLE admin_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
-- Recuperación de clave: se guarda el sha256 del token, nunca el token.
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    UPDATE admin_profiles p
       SET password_hash = u.encrypted_password,
           email = COALESCE(p.email, u.email)
      FROM auth.users u
     WHERE u.id = p.id
       AND p.password_hash IS NULL
       AND u.encrypted_password IS NOT NULL
       AND u.encrypted_password <> '';
  END IF;
END $$;

-- El email es el usuario del login.
UPDATE admin_profiles SET email = lower(trim(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_profiles_email_key ON admin_profiles (lower(email));

CREATE TABLE IF NOT EXISTS admin_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES admin_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at);

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_auth_user_created_admin_profile ON auth.users;
  END IF;
END $$;
DROP FUNCTION IF EXISTS handle_new_admin_user();

-- ── Lo que sólo tenía sentido en Supabase ──

-- La aplicación se conecta como dueña de las tablas, así que RLS no la
-- alcanza; las políticas "service_role"/"anon" eran para la API de Supabase.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
  FOR pol IN SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', pol.relname);
  END LOOP;
END $$;

-- Keepalive: evitaba que el plan gratuito de Supabase pausara el proyecto.
DROP FUNCTION IF EXISTS public.keepalive();
DROP SCHEMA IF EXISTS api CASCADE;

COMMIT;
