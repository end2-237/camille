-- migration_stats_align.sql
-- Aligne les tables analytics avec ce que /api/stats et /api/usage attendent.
-- 100% idempotent : ne casse rien si les colonnes existent déjà. À coller dans le Postgres de camille.

-- ── token_usage : consommation de tokens par (agent, mois) ────────────────────
CREATE TABLE IF NOT EXISTS camille.token_usage (
  agent_id          uuid    NOT NULL,
  period            text    NOT NULL,           -- 'YYYY-MM'
  prompt_tokens     bigint  NOT NULL DEFAULT 0,
  completion_tokens bigint  NOT NULL DEFAULT 0,
  total_tokens      bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, period)
);
ALTER TABLE camille.token_usage ADD COLUMN IF NOT EXISTS prompt_tokens     bigint NOT NULL DEFAULT 0;
ALTER TABLE camille.token_usage ADD COLUMN IF NOT EXISTS completion_tokens bigint NOT NULL DEFAULT 0;
ALTER TABLE camille.token_usage ADD COLUMN IF NOT EXISTS total_tokens      bigint NOT NULL DEFAULT 0;
-- garantit le ON CONFLICT (agent_id, period)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'token_usage_agent_period_key'
  ) THEN
    BEGIN
      ALTER TABLE camille.token_usage ADD CONSTRAINT token_usage_agent_period_key UNIQUE (agent_id, period);
    EXCEPTION WHEN duplicate_table OR unique_violation OR others THEN NULL; END;
  END IF;
END $$;

-- ── agent_analytics : métriques quotidiennes par agent ────────────────────────
CREATE TABLE IF NOT EXISTS camille.agent_analytics (
  agent_id         uuid    NOT NULL,
  date             date    NOT NULL DEFAULT CURRENT_DATE,
  messages_handled bigint  NOT NULL DEFAULT 0,
  leads_captured   bigint  NOT NULL DEFAULT 0,
  escalations      bigint  NOT NULL DEFAULT 0,
  avg_response_ms  integer,
  tokens_consumed  bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, date)
);
ALTER TABLE camille.agent_analytics ADD COLUMN IF NOT EXISTS messages_handled bigint  NOT NULL DEFAULT 0;
ALTER TABLE camille.agent_analytics ADD COLUMN IF NOT EXISTS leads_captured   bigint  NOT NULL DEFAULT 0;
ALTER TABLE camille.agent_analytics ADD COLUMN IF NOT EXISTS escalations      bigint  NOT NULL DEFAULT 0;
ALTER TABLE camille.agent_analytics ADD COLUMN IF NOT EXISTS avg_response_ms  integer;
ALTER TABLE camille.agent_analytics ADD COLUMN IF NOT EXISTS tokens_consumed  bigint  NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_analytics_agent_date_key'
  ) THEN
    BEGIN
      ALTER TABLE camille.agent_analytics ADD CONSTRAINT agent_analytics_agent_date_key UNIQUE (agent_id, date);
    EXCEPTION WHEN duplicate_table OR unique_violation OR others THEN NULL; END;
  END IF;
END $$;

-- ── agent_conversations : historique messages (contacts, heures, DOW) ─────────
CREATE TABLE IF NOT EXISTS camille.agent_conversations (
  id            bigserial PRIMARY KEY,
  session_name  text,
  contact_phone text,
  role          text,
  content       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE camille.agent_conversations ADD COLUMN IF NOT EXISTS session_name  text;
ALTER TABLE camille.agent_conversations ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE camille.agent_conversations ADD COLUMN IF NOT EXISTS role          text;
ALTER TABLE camille.agent_conversations ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS agent_conv_session_created_idx ON camille.agent_conversations (session_name, created_at);
CREATE INDEX IF NOT EXISTS agent_conv_contact_idx        ON camille.agent_conversations (contact_phone);

-- ── source catalogue par agent (multi-tenant : évite la fuite OFS) ────────────
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS catalog_source text DEFAULT 'camille';
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS ofs_vendor_id  text;
