-- Autogestion del panel admin: catalogo de circuitos turisticos editable
-- y configuracion del bus educativo.
-- Ejecutar una vez en el SQL Editor de Supabase.
-- Los 10 circuitos actuales se siembran solos desde la app la primera vez
-- que se consulta el catalogo (no hace falta insertarlos aca).

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Catalogo editorial de circuitos turisticos (lo que antes vivia en el codigo).
CREATE TABLE IF NOT EXISTS tourist_circuits (
  id                     BIGSERIAL PRIMARY KEY,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slug                   TEXT NOT NULL UNIQUE,
  icon                   TEXT NOT NULL DEFAULT 'bus',
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order             INT NOT NULL DEFAULT 0,
  default_capacity       INT CHECK (default_capacity IS NULL OR default_capacity > 0),
  default_meeting_point  TEXT,
  name_es                TEXT NOT NULL,
  schedule_es            TEXT,
  duration_es            TEXT,
  summary_es             TEXT,
  description_es         TEXT,
  highlights_es          JSONB NOT NULL DEFAULT '[]',
  name_en                TEXT,
  schedule_en            TEXT,
  duration_en            TEXT,
  summary_en             TEXT,
  description_en         TEXT,
  highlights_en          JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_tourist_circuits_active_order ON tourist_circuits (active, sort_order, id);

DROP TRIGGER IF EXISTS tourist_circuits_updated_at ON tourist_circuits;
CREATE TRIGGER tourist_circuits_updated_at
  BEFORE UPDATE ON tourist_circuits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tourist_circuits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_tourist_circuits" ON tourist_circuits;
CREATE POLICY "service_role_full_access_tourist_circuits" ON tourist_circuits
  FOR ALL USING (auth.role() = 'service_role');

-- Catalogo de circuitos del bus educativo (separado del turistico,
-- solo en espanol, cada circuito con sus propios dias y turnos).
CREATE TABLE IF NOT EXISTS educational_circuits (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  summary       TEXT,
  paragraphs    JSONB NOT NULL DEFAULT '[]',
  availability  JSONB NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_educational_circuits_active_order ON educational_circuits (active, sort_order, id);

DROP TRIGGER IF EXISTS educational_circuits_updated_at ON educational_circuits;
CREATE TRIGGER educational_circuits_updated_at
  BEFORE UPDATE ON educational_circuits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE educational_circuits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_educational_circuits" ON educational_circuits;
CREATE POLICY "service_role_full_access_educational_circuits" ON educational_circuits
  FOR ALL USING (auth.role() = 'service_role');

-- Con circuitos educativos dinamicos, el CHECK fijo de valores ya no aplica
-- (las solicitudes historicas conservan sus valores).
ALTER TABLE educational_bus_requests DROP CONSTRAINT IF EXISTS educational_bus_requests_circuit_check;

-- Configuracion generica de la aplicacion (clave -> JSON).
-- Hoy guarda 'educational_settings': bloqueo de reservas, min/max de
-- alumnos y dias/turnos habilitados del bus educativo.
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value       JSONB NOT NULL
);

DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_app_settings" ON app_settings;
CREATE POLICY "service_role_full_access_app_settings" ON app_settings
  FOR ALL USING (auth.role() = 'service_role');
