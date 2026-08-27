-- Memoria conversacional persistente del bot de WhatsApp.
-- Ejecutar una vez en el SQL Editor de Supabase.
-- Antes la memoria vivia en la RAM del servidor y se perdia en cada reinicio.

CREATE TABLE IF NOT EXISTS bot_chat_messages (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chat_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_chat_messages_chat ON bot_chat_messages (chat_id, id DESC);

ALTER TABLE bot_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_bot_chat_messages" ON bot_chat_messages;
CREATE POLICY "service_role_full_access_bot_chat_messages" ON bot_chat_messages
  FOR ALL USING (auth.role() = 'service_role');
