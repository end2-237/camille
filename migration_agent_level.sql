-- ═══════════════════════════════════════════════════════════════════════════
-- migration_agent_level.sql — Camille · fondation du Niveau 1 (N1)
-- Ajoute le niveau d'automatisation + la configuration N1 sur les agents.
-- Idempotent : peut être rejoué sans risque.
--   À appliquer sur la base Postgres :  psql "$DATABASE_URL" -f migration_agent_level.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Niveau d'automatisation ────────────────────────────────────────────────
--   1 = Présence / support (N1)   2 = Conseil / catalogue   3 = Closing / paiement
ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS level SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE camille.agents
  DROP CONSTRAINT IF EXISTS agents_level_chk;
ALTER TABLE camille.agents
  ADD CONSTRAINT agents_level_chk CHECK (level BETWEEN 1 AND 3);

-- ── Comportement hors-périmètre ────────────────────────────────────────────
--   'site'  = redirige poliment vers le site
--   'human' = met la conversation en attente d'un humain (handoff)
ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS out_of_scope_behavior TEXT NOT NULL DEFAULT 'site';

ALTER TABLE camille.agents
  DROP CONSTRAINT IF EXISTS agents_oos_chk;
ALTER TABLE camille.agents
  ADD CONSTRAINT agents_oos_chk CHECK (out_of_scope_behavior IN ('site', 'human'));

-- ── Accueil automatique des nouveaux contacts (toggle + contenu) ───────────
ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS welcome_message TEXT DEFAULT NULL;

-- ── Webhook n8n de l'agent (auto-config depuis le dashboard) ───────────────
--   Permet de (re)configurer côté camille-core sans intervention manuelle.
ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT DEFAULT NULL;

-- ── Documentation des colonnes ─────────────────────────────────────────────
COMMENT ON COLUMN camille.agents.level IS
  'Niveau d''automatisation : 1=support (N1), 2=catalogue, 3=closing/paiement';
COMMENT ON COLUMN camille.agents.out_of_scope_behavior IS
  'Hors périmètre : site (redirection) | human (handoff)';
COMMENT ON COLUMN camille.agents.welcome_enabled IS
  'Accueil automatique des nouveaux contacts (true/false)';
COMMENT ON COLUMN camille.agents.welcome_message IS
  'Message d''accueil personnalisé (NULL = message par défaut de l''agent)';
COMMENT ON COLUMN camille.agents.n8n_webhook_url IS
  'URL du webhook n8n pour cet agent (auto-config du gateway)';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification (optionnelle) :
--   SELECT id, level, out_of_scope_behavior, welcome_enabled FROM camille.agents;
-- ═══════════════════════════════════════════════════════════════════════════
