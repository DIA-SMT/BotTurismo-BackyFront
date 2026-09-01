-- ════════════════════════════════════════════════════════════════════
-- MÓDULO BICITOUR EN VIVO
-- Recorridos guiados con sesiones en vivo, paradas históricas, preguntas,
-- puntaje, sellos y registro GPS del guía.
-- Correr en el SQL Editor de Supabase. Idempotente (IF NOT EXISTS).
-- Seguridad: RLS activado sin políticas => solo la service key del backend
-- accede (mismo criterio que el resto de las tablas del proyecto).
-- ════════════════════════════════════════════════════════════════════

-- ── Recorridos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bicitour_routes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  mode TEXT NOT NULL DEFAULT 'individual' CHECK (mode IN ('individual', 'teams', 'mixed')),
  -- Traza preconfigurada del recorrido: [[lat, lng], ...]
  path JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Paradas históricas ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bicitour_stops (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT NOT NULL REFERENCES bicitour_routes(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,                          -- explicación histórica
  fun_facts JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["dato 1", "dato 2"]
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb, -- URLs de imágenes
  audio_url TEXT,
  hint TEXT,                                 -- pista del próximo lugar
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m INT NOT NULL DEFAULT 60,          -- radio de proximidad para el aviso al guía
  is_draft BOOLEAN NOT NULL DEFAULT false,   -- paradas espontáneas creadas en vivo, a revisar
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bicitour_stops_route ON bicitour_stops(route_id, position);

-- ── Preguntas por parada ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bicitour_questions (
  id BIGSERIAL PRIMARY KEY,
  stop_id BIGINT NOT NULL REFERENCES bicitour_stops(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (type IN ('multiple_choice', 'true_false')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{"key":"a","label":"..."}]
  correct_key TEXT NOT NULL,
  explanation TEXT,                           -- explicación educativa post-respuesta
  points INT NOT NULL DEFAULT 100
);
CREATE INDEX IF NOT EXISTS idx_bicitour_questions_stop ON bicitour_questions(stop_id, position);

-- ── Sesiones en vivo ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bicitour_sessions (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,                 -- código corto de ingreso (QR)
  route_id BIGINT NOT NULL REFERENCES bicitour_routes(id),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'paused', 'finished')),
  mode TEXT NOT NULL DEFAULT 'individual' CHECK (mode IN ('individual', 'teams', 'mixed')),
  teams JSONB NOT NULL DEFAULT '[]'::jsonb,  -- nombres de equipos
  gps_enabled BOOLEAN NOT NULL DEFAULT false,
  announcement TEXT,
  announcement_at TIMESTAMPTZ,
  group_bonus_awarded BOOLEAN NOT NULL DEFAULT false,
  -- Versión monótona para el polling: cada cambio relevante la incrementa y
  -- los clientes solo bajan el estado completo cuando cambió.
  version BIGINT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bicitour_sessions_code ON bicitour_sessions(code);

-- ── Estado de cada parada dentro de una sesión ───────────────────────
CREATE TABLE IF NOT EXISTS bicitour_session_stops (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bicitour_sessions(id) ON DELETE CASCADE,
  stop_id BIGINT NOT NULL REFERENCES bicitour_stops(id),
  position INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'locked'
    CHECK (status IN ('locked', 'open', 'question_active', 'question_closed', 'completed', 'skipped')),
  active_question_id BIGINT REFERENCES bicitour_questions(id),
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (session_id, stop_id)
);
CREATE INDEX IF NOT EXISTS idx_bicitour_session_stops_session ON bicitour_session_stops(session_id, position);

-- ── Participantes (anónimos: apodo + token de reconexión) ────────────
CREATE TABLE IF NOT EXISTS bicitour_participants (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bicitour_sessions(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  team TEXT,
  score INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bicitour_participants_nickname
  ON bicitour_participants(session_id, lower(nickname));
CREATE INDEX IF NOT EXISTS idx_bicitour_participants_session ON bicitour_participants(session_id);

-- ── Respuestas (una por participante y pregunta, garantizado por DB) ─
CREATE TABLE IF NOT EXISTS bicitour_answers (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bicitour_sessions(id) ON DELETE CASCADE,
  participant_id BIGINT NOT NULL REFERENCES bicitour_participants(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES bicitour_questions(id),
  answer_key TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_bicitour_answers_question ON bicitour_answers(question_id);

-- ── Sellos del Pasaporte Bicitour ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bicitour_stamps (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bicitour_sessions(id) ON DELETE CASCADE,
  participant_id BIGINT NOT NULL REFERENCES bicitour_participants(id) ON DELETE CASCADE,
  stop_id BIGINT REFERENCES bicitour_stops(id),  -- NULL => insignia de recorrido completo
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, stop_id)
);

-- ── Puntos GPS del recorrido (solo el GPS del guía) ──────────────────
CREATE TABLE IF NOT EXISTS bicitour_track_points (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bicitour_sessions(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bicitour_track_session ON bicitour_track_points(session_id, id);

-- ── Bitácora de eventos de la sesión ─────────────────────────────────
CREATE TABLE IF NOT EXISTS bicitour_session_events (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bicitour_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bicitour_events_session ON bicitour_session_events(session_id, id);

-- ── Incremento atómico de versión (para el polling de los clientes) ──
CREATE OR REPLACE FUNCTION bicitour_bump_version(p_session_id BIGINT) RETURNS VOID AS $$
  UPDATE bicitour_sessions SET version = version + 1 WHERE id = p_session_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Seguridad: solo la service key del backend ───────────────────────
ALTER TABLE bicitour_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_session_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_track_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_session_events ENABLE ROW LEVEL SECURITY;

-- ── Recorrido de DEMOSTRACIÓN (borrador, contenido placeholder) ──────
-- El contenido histórico real lo carga el equipo de turismo desde el admin.
DO $$
DECLARE
  demo_route_id BIGINT;
  stop1 BIGINT;
  stop2 BIGINT;
  stop3 BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bicitour_routes WHERE title LIKE '%[DEMO]%') THEN
    INSERT INTO bicitour_routes (title, description, status, mode, path)
    VALUES (
      'Bicitour Centro Histórico [DEMO]',
      '[DEMO] Recorrido de demostración con contenido de ejemplo. Reemplazar textos por la información histórica oficial antes de publicar.',
      'draft',
      'mixed',
      '[[-26.8368, -65.2042], [-26.8341, -65.2040], [-26.8306, -65.2039], [-26.8290, -65.1970], [-26.8283, -65.1908]]'::jsonb
    )
    RETURNING id INTO demo_route_id;

    INSERT INTO bicitour_stops (route_id, position, title, description, fun_facts, hint, lat, lng)
    VALUES (
      demo_route_id, 1, 'Casa Histórica de la Independencia',
      '[DEMO] Texto de ejemplo: acá va la explicación histórica oficial de la Casa Histórica, provista por el equipo de turismo.',
      '["[DEMO] Dato curioso de ejemplo 1", "[DEMO] Dato curioso de ejemplo 2"]'::jsonb,
      'Vamos hacia la plaza principal de la ciudad…',
      -26.8368, -65.2042
    ) RETURNING id INTO stop1;

    INSERT INTO bicitour_stops (route_id, position, title, description, fun_facts, hint, lat, lng)
    VALUES (
      demo_route_id, 2, 'Plaza Independencia',
      '[DEMO] Texto de ejemplo: acá va la explicación histórica oficial de la Plaza Independencia.',
      '["[DEMO] Dato curioso de ejemplo"]'::jsonb,
      'El próximo destino es el pulmón verde más grande de la ciudad…',
      -26.8306, -65.2039
    ) RETURNING id INTO stop2;

    INSERT INTO bicitour_stops (route_id, position, title, description, fun_facts, lat, lng)
    VALUES (
      demo_route_id, 3, 'Parque 9 de Julio',
      '[DEMO] Texto de ejemplo: acá va la explicación histórica oficial del Parque 9 de Julio.',
      '["[DEMO] Dato curioso de ejemplo"]'::jsonb,
      -26.8283, -65.1908
    ) RETURNING id INTO stop3;

    INSERT INTO bicitour_questions (stop_id, position, type, prompt, options, correct_key, explanation, points) VALUES
    (stop1, 1, 'multiple_choice', '[DEMO] ¿En qué año se declaró la Independencia argentina?',
     '[{"key":"a","label":"1810"},{"key":"b","label":"1816"},{"key":"c","label":"1820"}]'::jsonb,
     'b', '[DEMO] El 9 de julio de 1816 se declaró la Independencia en esta casa.', 100),
    (stop2, 1, 'true_false', '[DEMO] ¿Verdadero o falso? La Plaza Independencia es la plaza principal de San Miguel de Tucumán.',
     '[{"key":"true","label":"Verdadero"},{"key":"false","label":"Falso"}]'::jsonb,
     'true', '[DEMO] Explicación de ejemplo para la respuesta.', 100),
    (stop3, 1, 'multiple_choice', '[DEMO] ¿Qué conmemora el nombre del Parque 9 de Julio?',
     '[{"key":"a","label":"La fundación de la ciudad"},{"key":"b","label":"La declaración de la Independencia"},{"key":"c","label":"La batalla de Tucumán"}]'::jsonb,
     'b', '[DEMO] Explicación de ejemplo para la respuesta.', 100);
  END IF;
END $$;
