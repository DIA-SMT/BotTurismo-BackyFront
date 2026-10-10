-- Cierra el aviso "Security Definer View" del Security Advisor (2026-10-10).
--
-- Las seis vistas kpi_* leen de tourist_interactions, que tiene RLS con una
-- unica politica para service_role. Al crearse sin security_invoker, las
-- vistas corren con los permisos de quien las creo (postgres) y saltean ese
-- RLS: cualquiera con la clave publica del proyecto podria leerlas.
--
-- Hoy el riesgo es bajo (solo devuelven conteos agregados, sin datos
-- personales, y el navegador nunca habla con Supabase, asi que la clave
-- publica no circula), pero conviene cerrarlo antes de que alguien use esa
-- clave en el cliente.
--
-- El dashboard sigue funcionando igual: consulta desde el servidor con la
-- clave de servicio, que no esta sujeta a RLS.
--
-- Ejecutar una vez en el SQL Editor de Supabase (es idempotente).

DO $$
DECLARE
  vista TEXT;
  vistas TEXT[] := ARRAY[
    'kpi_consultas_por_intent',
    'kpi_origen_turistas',
    'kpi_actividad_diaria',
    'kpi_franja_horaria',
    'kpi_turistas_internacionales',
    'kpi_medio_transporte'
  ];
BEGIN
  FOREACH vista IN ARRAY vistas LOOP
    -- Solo si la vista existe (evita fallar si alguna se renombro).
    IF EXISTS (
      SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = vista
    ) THEN
      -- security_invoker existe desde PostgreSQL 15: la vista pasa a correr
      -- con los permisos de quien consulta, respetando el RLS de la tabla.
      IF current_setting('server_version_num')::INT >= 150000 THEN
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', vista);
      END IF;

      -- Defensa adicional, valida en cualquier version: los roles publicos no
      -- necesitan leer estas vistas (el dashboard usa la clave de servicio).
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', vista);
    END IF;
  END LOOP;
END $$;
