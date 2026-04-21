-- migration file: supabase_keepalive_migration.sql
-- Proposito: Mecanismo de "latido" (keepalive) agnóstico para prevenir la suspensión por inactividad.

-- 1. Create the schema if it does not exist
CREATE SCHEMA IF NOT EXISTS api;

-- 2. Create the keepalive table
CREATE TABLE IF NOT EXISTS api.supabase_keepalive (
    id int PRIMARY KEY,
    last_pinged_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS for security
ALTER TABLE api.supabase_keepalive ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policies
-- Restringimos el acceso para interactuar UNICAMENTE con la única fila autorizada (id=1)
DROP POLICY IF EXISTS "Allow keepalive updates" ON api.supabase_keepalive;
CREATE POLICY "Allow keepalive updates" 
    ON api.supabase_keepalive
    FOR UPDATE 
    TO anon, authenticated
    USING (id = 1)
    WITH CHECK (id = 1);

DROP POLICY IF EXISTS "Allow keepalive inserts" ON api.supabase_keepalive;
CREATE POLICY "Allow keepalive inserts" 
    ON api.supabase_keepalive
    FOR INSERT 
    TO anon, authenticated
    WITH CHECK (id = 1);

DROP POLICY IF EXISTS "Allow keepalive reads" ON api.supabase_keepalive;
CREATE POLICY "Allow keepalive reads" 
    ON api.supabase_keepalive
    FOR SELECT 
    TO anon, authenticated
    USING (id = 1);

-- 5. Insert initial row for our upsert mechanism
-- Saltamos RLS de la sesión actual dado que este script se corre desde el cliente de Supabase/SQL Editor como admin.
INSERT INTO api.supabase_keepalive (id, last_pinged_at) 
VALUES (1, now()) 
ON CONFLICT (id) DO NOTHING;

-- 6. Grant minimal permissions required
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON api.supabase_keepalive TO anon, authenticated, service_role;

-- 7. Create the keepalive function (security invoker)
CREATE OR REPLACE FUNCTION api.keepalive()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    result json;
BEGIN
    INSERT INTO api.supabase_keepalive (id, last_pinged_at)
    VALUES (1, now())
    ON CONFLICT (id) DO UPDATE SET last_pinged_at = now();

    result := json_build_object(
        'ok', true, 
        'timestamp', now()
    );

    RETURN result;
END;
$$;

-- 8. Grant execution on the function
GRANT EXECUTE ON FUNCTION api.keepalive() TO anon, authenticated, service_role;

-- 9. Wrapper in the public schema
-- La función REST estándar buscará funciones en public por defecto de forma anon.
CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN api.keepalive();
END;
$$;
GRANT EXECUTE ON FUNCTION public.keepalive() TO anon, authenticated, service_role;

-- 10. Reload PostgREST schema cache
-- Forzamos la actualización de cachés para que pueda detectar public.keepalive via POST de inmediato.
NOTIFY pgrst, 'reload schema';
