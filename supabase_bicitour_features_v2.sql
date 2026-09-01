-- ════════════════════════════════════════════════════════════════════
-- BICITOUR — FASE 2
-- Asistente de preguntas con IA (propuestas con aprobación humana),
-- pistas de la próxima parada, sistema de insignias.
-- Migración INCREMENTAL sobre supabase_bicitour_migration.sql (ya aplicada).
-- Idempotente: no borra datos, no recrea tablas, no toca sesiones existentes.
-- ════════════════════════════════════════════════════════════════════

-- ── Pistas: la pista pertenece a la parada de DESTINO y se puede apagar ──
ALTER TABLE bicitour_stops
  ADD COLUMN IF NOT EXISTS hint_enabled BOOLEAN NOT NULL DEFAULT true;

-- ── Preguntas: origen (manual/ia), categoría y fragmento de respaldo ──
ALTER TABLE bicitour_questions
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE bicitour_questions
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'historica';
ALTER TABLE bicitour_questions
  ADD COLUMN IF NOT EXISTS source_excerpt TEXT;

-- Restricciones de dominio (solo si no existen todavía).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bicitour_questions_origin_check') THEN
    ALTER TABLE bicitour_questions
      ADD CONSTRAINT bicitour_questions_origin_check CHECK (origin IN ('manual', 'ai'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bicitour_questions_category_check') THEN
    ALTER TABLE bicitour_questions
      ADD CONSTRAINT bicitour_questions_category_check
      CHECK (category IN ('historica', 'cultural', 'arquitectonica', 'observacion'));
  END IF;
END $$;

-- ── Propuestas de preguntas generadas por IA ─────────────────────────
-- Son BORRADORES: no forman parte del recorrido hasta que un administrador
-- las aprueba (al aprobar se copian a bicitour_questions con origin='ai').
CREATE TABLE IF NOT EXISTS bicitour_question_proposals (
  id BIGSERIAL PRIMARY KEY,
  stop_id BIGINT NOT NULL REFERENCES bicitour_stops(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (type IN ('multiple_choice', 'true_false')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_key TEXT NOT NULL,
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'intermedia' CHECK (difficulty IN ('facil', 'intermedia', 'dificil')),
  category TEXT NOT NULL DEFAULT 'historica' CHECK (category IN ('historica', 'cultural', 'arquitectonica', 'observacion')),
  source_excerpt TEXT,            -- fragmento exacto del contenido que respalda la respuesta
  warning TEXT,                   -- aviso del asistente cuando el contenido es insuficiente
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bicitour_proposals_stop ON bicitour_question_proposals(stop_id, status);

-- ── Insignias obtenidas por participante ─────────────────────────────
-- Las DEFINICIONES y reglas viven centralizadas en el código
-- (src/lib/bicitour-badges.ts); acá solo se registra lo otorgado.
CREATE TABLE IF NOT EXISTS bicitour_participant_badges (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bicitour_sessions(id) ON DELETE CASCADE,
  participant_id BIGINT NOT NULL REFERENCES bicitour_participants(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, badge_key)
);
CREATE INDEX IF NOT EXISTS idx_bicitour_participant_badges_session
  ON bicitour_participant_badges(session_id);

-- ── Seguridad: igual que el resto del módulo (solo service key) ───────
ALTER TABLE bicitour_question_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicitour_participant_badges ENABLE ROW LEVEL SECURITY;
