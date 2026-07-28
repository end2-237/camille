-- ─────────────────────────────────────────────────────────────────────────────
-- Commandes initiées depuis la conversation (SANS flux de paiement).
-- La commande ENREGISTRE et NOTIFIE ; elle ne réserve pas le stock et ne gère
-- pas de cycle logistique. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.orders (
  id             BIGSERIAL PRIMARY KEY,
  ref            TEXT UNIQUE,            -- référence courte affichée au client (ex: A4F7C2)
  agent_id       UUID,
  session_name   TEXT,
  contact_phone  TEXT,
  customer_name  TEXT,

  items          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name, variant, qty, price, currency}]
  total          NUMERIC(12,2) DEFAULT 0,
  currency       TEXT DEFAULT 'XAF',

  -- Cycle de vie volontairement minimal
  status         TEXT NOT NULL DEFAULT 'nouvelle',    -- nouvelle | traitee | annulee
  note           TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_agent_time ON camille.orders (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON camille.orders (status);

-- Mode de conversion de l'agent :
--   'whatsapp' → la vente se conclut dans la conversation (défaut)
--   'boutique' → on renvoie vers le site marchand du client
ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS conversion_mode TEXT NOT NULL DEFAULT 'whatsapp';
