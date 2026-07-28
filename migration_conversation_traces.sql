-- ─────────────────────────────────────────────────────────────────────────────
-- Boîte noire conversationnelle : une ligne par TOUR de conversation.
-- Permet d'analyser une DISCUSSION entière (parcours, signature, friction),
-- et de rejouer de vraies conversations contre une nouvelle version du workflow.
-- Idempotent : réexécutable sans risque.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.conversation_traces (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        UUID,
  session_name    TEXT,
  contact_phone   TEXT,

  -- Le message du client (nécessaire au rejeu)
  user_msg        TEXT,

  -- Ce que la recherche a décidé
  search_q        TEXT,
  search_off      INT,
  search_kind     TEXT,          -- new | ctx | more

  -- Ce que le LLM a proposé vs ce que l'Ancrage a retenu
  llm_intent      TEXT,
  final_intent    TEXT,
  corrected       BOOLEAN DEFAULT FALSE,

  -- Ce qui a été répondu
  resolved_product TEXT,
  reply_mode      TEXT,          -- text | card | category
  items           INT,
  cart_size       INT,

  -- Coûts
  tokens          INT,
  latency_ms      INT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traces_agent_time
  ON camille.conversation_traces (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_traces_contact
  ON camille.conversation_traces (session_name, contact_phone, created_at);

-- Purge : on ne garde que 90 jours de traces.
-- (à brancher sur un cron, ou exécuter manuellement)
-- DELETE FROM camille.conversation_traces WHERE created_at < NOW() - INTERVAL '90 days';
