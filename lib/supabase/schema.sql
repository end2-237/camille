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


-- ─────────────────────────────────────────────────────────────────────────────
-- Colonne plan sur agents (free | starter | pro | enterprise)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';


-- ─────────────────────────────────────────────────────────────────────────────
-- Table: token_usage
-- Usage mensuel de tokens par agent — une ligne par (agent, mois YYYY-MM).
-- Upsertée par n8n après chaque réponse via POST /api/usage/record.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.token_usage (
  id                BIGSERIAL   PRIMARY KEY,
  agent_id          UUID        NOT NULL,
  period            TEXT        NOT NULL,   -- 'YYYY-MM'
  prompt_tokens     BIGINT      NOT NULL DEFAULT 0,
  completion_tokens BIGINT      NOT NULL DEFAULT 0,
  total_tokens      BIGINT      NOT NULL DEFAULT 0,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, period)
);

CREATE INDEX IF NOT EXISTS idx_token_usage_agent_period
  ON camille.token_usage (agent_id, period DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- Table: payments
-- Paiements Monetbil — une ligne par tentative de paiement.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.payments (
  id             TEXT        PRIMARY KEY,   -- CAM-timestamp-hex
  user_id        UUID        NOT NULL,
  agent_id       UUID        NOT NULL,
  plan_id        TEXT        NOT NULL,      -- starter | pro | enterprise
  amount         INTEGER     NOT NULL,      -- XAF
  currency       TEXT        NOT NULL DEFAULT 'XAF',
  status         TEXT        NOT NULL DEFAULT 'pending',  -- pending|success|failed|cancelled
  transaction_id TEXT,
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON camille.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status  ON camille.payments (status);


-- ─────────────────────────────────────────────────────────────────────────────
-- Table: plans
-- Source de vérité pour les tarifs et fonctionnalités de chaque plan.
-- Modifiable via SQL sans redéploiement.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.plans (
  id             TEXT        PRIMARY KEY,   -- 'free' | 'starter' | 'pro' | 'enterprise'
  label          TEXT        NOT NULL,      -- Nom affiché
  monthly_tokens BIGINT      NOT NULL DEFAULT 0,  -- -1 = illimité
  price_xaf      INTEGER     NOT NULL DEFAULT 0,  -- -1 = sur devis
  price_eur      INTEGER     NOT NULL DEFAULT 0,
  description    TEXT        NOT NULL DEFAULT '',
  tokens_label   TEXT        NOT NULL DEFAULT '',  -- ex: '500 000 tokens / mois'
  conv_estimate  TEXT        NOT NULL DEFAULT '',  -- ex: '~700 conversations'
  highlight      BOOLEAN     NOT NULL DEFAULT FALSE,
  badge          TEXT,                             -- ex: 'Populaire'
  cta_label      TEXT        NOT NULL DEFAULT 'Commencer',
  cta_href       TEXT        NOT NULL DEFAULT '/configure',
  is_purchasable BOOLEAN     NOT NULL DEFAULT FALSE,  -- payable via Monetbil
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  features       JSONB       NOT NULL DEFAULT '[]',  -- [{label, included}]
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION camille.plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON camille.plans
  FOR EACH ROW EXECUTE FUNCTION camille.plans_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: capabilities
-- Fonctionnalités activables par agent et leur coût en tokens.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.capabilities (
  id             TEXT        PRIMARY KEY,
  label          TEXT        NOT NULL,
  description    TEXT        NOT NULL DEFAULT '',
  tokens_per_msg INTEGER     NOT NULL DEFAULT 0,
  detail         TEXT        NOT NULL DEFAULT '',
  color          TEXT        NOT NULL DEFAULT '#D4AF37',
  icon           TEXT        NOT NULL DEFAULT 'Zap',  -- nom du composant lucide-react
  note           TEXT,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: plan_capabilities
-- Quelles capacités sont incluses dans quel plan.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.plan_capabilities (
  plan_id        TEXT        NOT NULL REFERENCES camille.plans(id)        ON DELETE CASCADE,
  capability_id  TEXT        NOT NULL REFERENCES camille.capabilities(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, capability_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: plans
-- Upsert idempotent — relancer le script met à jour sans dupliquer.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO camille.plans
  (id, label, monthly_tokens, price_xaf, price_eur,
   description, tokens_label, conv_estimate,
   highlight, badge, cta_label, cta_href,
   is_purchasable, sort_order, features)
VALUES
('free', 'Gratuit', 50000, 0, 0,
 'Pour créer votre premier agent et tester la plateforme.',
 '50 000 tokens / mois', '~80 conversations',
 FALSE, NULL, 'Commencer gratuitement', '/configure',
 FALSE, 1,
 '[
   {"label":"1 agent WhatsApp","included":true},
   {"label":"50 000 tokens / mois","included":true},
   {"label":"Historique 10 messages","included":true},
   {"label":"Prompt système auto-généré","included":true},
   {"label":"Modèle Llama 3.1 8B (Groq)","included":true},
   {"label":"Support WhatsApp de base","included":true},
   {"label":"Indicateur de frappe","included":false},
   {"label":"Capture de leads","included":false},
   {"label":"Analytics avancées","included":false},
   {"label":"Support email","included":false}
 ]'::jsonb),

('starter', 'Starter', 500000, 9900, 29,
 'Pour les entreprises qui veulent un bot professionnel.',
 '500 000 tokens / mois', '~700 conversations',
 FALSE, NULL, 'Passer au Starter', '/dashboard/billing',
 TRUE, 2,
 '[
   {"label":"1 agent WhatsApp","included":true},
   {"label":"500 000 tokens / mois","included":true},
   {"label":"Historique 50 messages","included":true},
   {"label":"Prompt système auto-généré","included":true},
   {"label":"Modèle Llama 3.1 8B (Groq)","included":true},
   {"label":"Support WhatsApp + indicateur","included":true},
   {"label":"Capture de leads","included":true},
   {"label":"Analytics de base","included":true},
   {"label":"Support email prioritaire","included":true},
   {"label":"Analytics avancées","included":false}
 ]'::jsonb),

('pro', 'Pro', 2000000, 24900, 79,
 'Pour automatiser entièrement votre relation client.',
 '2 000 000 tokens / mois', '~3 000 conversations',
 TRUE, 'Populaire', 'Passer au Pro', '/dashboard/billing',
 TRUE, 3,
 '[
   {"label":"Agents illimités","included":true},
   {"label":"2 000 000 tokens / mois","included":true},
   {"label":"Historique 200 messages","included":true},
   {"label":"Prompt système auto-généré","included":true},
   {"label":"Modèle Llama 3.1 8B (Groq)","included":true},
   {"label":"Toutes les capacités actives","included":true},
   {"label":"Analytics avancées","included":true},
   {"label":"Support dédié","included":true},
   {"label":"Bientôt : GPT-4o / Claude","included":true},
   {"label":"SLA 99,5% uptime","included":true}
 ]'::jsonb),

('enterprise', 'Enterprise', -1, -1, 199,
 'Pour les agences et équipes à fort volume.',
 'Tokens illimités', 'Illimité',
 FALSE, NULL, 'Contacter l''équipe',
 'mailto:hello@buyticle.com?subject=Camille Enterprise',
 FALSE, 4,
 '[
   {"label":"Agents illimités","included":true},
   {"label":"Tokens illimités","included":true},
   {"label":"Historique illimité","included":true},
   {"label":"Toutes les capacités","included":true},
   {"label":"Modèles IA au choix","included":true},
   {"label":"Déploiement personnalisé","included":true},
   {"label":"SLA garanti & support 24/7","included":true},
   {"label":"Account manager dédié","included":true},
   {"label":"Intégrations sur mesure","included":true},
   {"label":"Facturation sur devis","included":true}
 ]'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  label          = EXCLUDED.label,
  monthly_tokens = EXCLUDED.monthly_tokens,
  price_xaf      = EXCLUDED.price_xaf,
  price_eur      = EXCLUDED.price_eur,
  description    = EXCLUDED.description,
  tokens_label   = EXCLUDED.tokens_label,
  conv_estimate  = EXCLUDED.conv_estimate,
  highlight      = EXCLUDED.highlight,
  badge          = EXCLUDED.badge,
  cta_label      = EXCLUDED.cta_label,
  cta_href       = EXCLUDED.cta_href,
  is_purchasable = EXCLUDED.is_purchasable,
  sort_order     = EXCLUDED.sort_order,
  features       = EXCLUDED.features,
  updated_at     = NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: capabilities
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO camille.capabilities
  (id, label, description, tokens_per_msg, detail, color, icon, note, sort_order)
VALUES
('support_whatsapp',   'Support WhatsApp',
 'Le bot reçoit et répond aux messages entrants en temps réel.',
 500, '~300 prompt + ~200 réponse', '#34D399', 'MessageCircle', NULL, 1),

('typing_indicator',   'Indicateur de frappe',
 'Le bot affiche « en train d''écrire » avant d''envoyer sa réponse.',
 0, '0 token — appel API Waha uniquement', '#60a5fa', 'Zap', NULL, 2),

('conversation_history', 'Historique de conversation',
 'Le contexte des messages précédents est injecté dans chaque appel LLM.',
 250, '+~250 tokens / message (historique 10 msgs)', '#a78bfa', 'Brain',
 'Starter : +600 tokens (50 msgs) · Pro : +1 500 tokens (200 msgs)', 3),

('lead_capture',       'Capture de leads',
 'Extraction structurée des informations contact depuis la conversation.',
 150, '+~150 tokens par extraction', '#fbbf24', 'Target', NULL, 4),

('content_generation', 'Génération de contenu',
 'Rédaction de posts, emails, descriptions produit à la demande.',
 2000, '~1 500–3 000 tokens / génération', '#f97316', 'Sparkles', NULL, 5),

('strategy_advisor',   'Conseiller stratégique',
 'Analyse de la situation business et recommandations personnalisées.',
 1500, '~1 000–2 000 tokens / conseil', '#ec4899', 'BarChart3', NULL, 6),

('proactive_messaging','Messages proactifs',
 'Le bot initie la conversation (relances, rappels, promotions).',
 400, '~400 tokens / message envoyé', '#14b8a6', 'Megaphone', NULL, 7),

('community_management','Community management',
 'Modération et animation de groupes WhatsApp.',
 350, '~350 tokens / intervention', '#8b5cf6', 'Users', NULL, 8),

('image_creation',     'Génération d''images',
 'Création d''images et visuels à la demande (intégration DALL-E / SDXL).',
 3000, '~3 000 tokens + coût API image', '#f43f5e', 'Image', NULL, 9)

ON CONFLICT (id) DO UPDATE SET
  label          = EXCLUDED.label,
  description    = EXCLUDED.description,
  tokens_per_msg = EXCLUDED.tokens_per_msg,
  detail         = EXCLUDED.detail,
  color          = EXCLUDED.color,
  icon           = EXCLUDED.icon,
  note           = EXCLUDED.note,
  sort_order     = EXCLUDED.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: plan_capabilities
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO camille.plan_capabilities (plan_id, capability_id) VALUES
('free',        'support_whatsapp'),
('free',        'conversation_history'),
('starter',     'support_whatsapp'),
('starter',     'typing_indicator'),
('starter',     'conversation_history'),
('starter',     'lead_capture'),
('pro',         'support_whatsapp'),
('pro',         'typing_indicator'),
('pro',         'conversation_history'),
('pro',         'lead_capture'),
('pro',         'content_generation'),
('pro',         'strategy_advisor'),
('pro',         'proactive_messaging'),
('enterprise',  'support_whatsapp'),
('enterprise',  'typing_indicator'),
('enterprise',  'conversation_history'),
('enterprise',  'lead_capture'),
('enterprise',  'content_generation'),
('enterprise',  'strategy_advisor'),
('enterprise',  'proactive_messaging'),
('enterprise',  'community_management'),
('enterprise',  'image_creation')
ON CONFLICT DO NOTHING;
