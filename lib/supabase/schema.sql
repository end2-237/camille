-- ─────────────────────────────────────────────────────────────────────────────
-- schema.sql — Camille by Buyticle
-- PostgreSQL / Supabase schema for agent configurations.
-- Run via: supabase db push  OR paste into the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE agent_status AS ENUM (
  'draft',
  'active',
  'paused',
  'archived'
);

CREATE TYPE brand_tone AS ENUM (
  'professional',
  'friendly',
  'casual',
  'luxury',
  'technical',
  'empathetic',
  'authoritative'
);

CREATE TYPE business_sector AS ENUM (
  'ecommerce',
  'hospitality',
  'healthcare',
  'finance',
  'education',
  'real_estate',
  'legal',
  'beauty_wellness',
  'food_beverage',
  'tech_saas',
  'consulting',
  'nonprofit',
  'other'
);

CREATE TYPE agent_model AS ENUM (
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307'
);

CREATE TYPE supported_language AS ENUM (
  'fr', 'en', 'es', 'ar', 'pt', 'de', 'it', 'nl'
);

-- ── agents table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity (JSONB for schema flexibility)
  identity        JSONB NOT NULL DEFAULT '{}',

  -- Business context
  business_context JSONB NOT NULL DEFAULT '{}',

  -- Knowledge base (structured FAQ + documents)
  knowledge_base  JSONB NOT NULL DEFAULT '{}',

  -- Feature flags
  capabilities    JSONB NOT NULL DEFAULT '{
    "support_whatsapp": false,
    "content_generation": false,
    "image_creation": false,
    "community_management": false,
    "strategy_advisor": false,
    "lead_capture": false,
    "proactive_messaging": false
  }',

  -- WhatsApp integration (nullable until connected)
  whatsapp_config JSONB,

  -- Auto-generated system prompt
  system_prompt   JSONB NOT NULL DEFAULT '{}',

  -- Scalar fields
  status          agent_status NOT NULL DEFAULT 'draft',
  target_model    agent_model  NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── agent_conversations table ─────────────────────────────────────────────────
-- Stores WhatsApp conversation sessions for context window management.

CREATE TABLE IF NOT EXISTS agent_conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- The end-user's WhatsApp number (hashed for privacy)
  user_phone_hash TEXT NOT NULL,

  -- Full conversation history as JSONB array of {role, content} objects
  messages        JSONB NOT NULL DEFAULT '[]',

  -- Session metadata
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Token usage tracking
  total_tokens_used INTEGER NOT NULL DEFAULT 0
);

-- ── agent_knowledge_documents table ───────────────────────────────────────────
-- Stores chunked documents for RAG-style knowledge injection.

CREATE TABLE IF NOT EXISTS agent_knowledge_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  source_url  TEXT,
  embedding   vector(1536),  -- requires pgvector extension
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── agent_analytics table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_analytics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  messages_handled INTEGER NOT NULL DEFAULT 0,
  leads_captured   INTEGER NOT NULL DEFAULT 0,
  escalations      INTEGER NOT NULL DEFAULT 0,
  avg_response_ms  INTEGER,
  tokens_consumed  INTEGER NOT NULL DEFAULT 0,

  UNIQUE(agent_id, date)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_agents_user_id        ON agents(user_id);
CREATE INDEX idx_agents_status         ON agents(status);
CREATE INDEX idx_conversations_agent   ON agent_conversations(agent_id);
CREATE INDEX idx_conversations_active  ON agent_conversations(agent_id, is_active);
CREATE INDEX idx_analytics_agent_date  ON agent_analytics(agent_id, date);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_analytics ENABLE ROW LEVEL SECURITY;

-- Agents: users can only read/write their own agents
CREATE POLICY "agents_select_own" ON agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "agents_insert_own" ON agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agents_update_own" ON agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "agents_delete_own" ON agents
  FOR DELETE USING (auth.uid() = user_id);

-- Knowledge documents follow agent ownership
CREATE POLICY "knowledge_docs_owner" ON agent_knowledge_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_knowledge_documents.agent_id
        AND agents.user_id = auth.uid()
    )
  );

-- Analytics follow agent ownership
CREATE POLICY "analytics_owner" ON agent_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_analytics.agent_id
        AND agents.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Table: agent_conversations
-- Historique des conversations WhatsApp par session et par contact.
-- Utilisée par n8n pour injecter le contexte dans les appels LLM.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.agent_conversations (
  id             BIGSERIAL PRIMARY KEY,
  session_name   TEXT        NOT NULL,            -- ex: "default" ou "cam..."
  contact_phone  TEXT        NOT NULL,            -- ex: "33612345678@c.us"
  role           TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content        TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_session_phone
  ON camille.agent_conversations (session_name, contact_phone, created_at DESC);
