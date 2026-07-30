-- ─────────────────────────────────────────────────────────────────────────────
-- Cles d'API publiques : permettent au site d'un client d'appeler Camille
-- comme n'importe quel consommateur d'API.
--
-- Deux natures de cle :
--   cam_pk_… (publique) — LECTURE seule du catalogue. Exposable dans un
--                         navigateur, protegee par la liste des domaines.
--   cam_sk_… (secrete)  — CREATION de commandes. Serveur uniquement.
--
-- On ne stocke JAMAIS la cle en clair : seulement son empreinte SHA-256.
-- Elle n'est affichee qu'une fois, a la creation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL,
  user_id      UUID NOT NULL,

  label        TEXT NOT NULL DEFAULT 'Site web',
  kind         TEXT NOT NULL CHECK (kind IN ('public', 'secret')),
  key_hash     TEXT NOT NULL UNIQUE,     -- SHA-256 de la cle
  key_prefix   TEXT NOT NULL,            -- 12 premiers caracteres, pour reconnaitre la cle

  -- Domaines autorises pour les appels navigateur (CORS). Vide = tous.
  origins      JSONB NOT NULL DEFAULT '[]'::jsonb,

  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  calls_count  BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_agent ON camille.api_keys (agent_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash  ON camille.api_keys (key_hash);

-- Origine d'une commande : conversation WhatsApp, ou site du client via l'API.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'whatsapp';
