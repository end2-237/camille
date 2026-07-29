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
  address        TEXT,                                -- adresse tapee par le client
  lat            DOUBLE PRECISION,                    -- position partagee via WhatsApp
  lng            DOUBLE PRECISION,
  place_label    TEXT,                                -- adresse resolue depuis lat/lng

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

-- ── Livraison : coordonnees du client (rejouable sur une base deja migree) ────
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS address     TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS lat         DOUBLE PRECISION;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS lng         DOUBLE PRECISION;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS place_label TEXT;

-- Corrige les commandes enregistrees avant le correctif : une position absente
-- etait convertie en 0,0 (Number(null) === 0), soit un point au large du Ghana.
UPDATE camille.orders
   SET lat = NULL, lng = NULL, place_label = NULL
 WHERE lat = 0 AND lng = 0;

-- ── Suivi de commande : horodatage des etapes du cycle de vie ────────────────
-- nouvelle (a traiter) → en_traitement → livree ; annulee possible a tout moment.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;

-- Les commandes deja marquees "traitee" avant l'ajout du cycle : on leur donne
-- une date de traitement, sinon leur suivi apparaitrait vide.
UPDATE camille.orders
   SET processing_at = COALESCE(processing_at, updated_at)
 WHERE status = 'traitee' AND processing_at IS NULL;

-- ── Bon de commande PDF (buyfacturation) ─────────────────────────────────────
-- Memorise le document envoye au client pour ne pas le regenerer et pouvoir
-- le renvoyer depuis le dashboard.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS doc_number TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS doc_url    TEXT;
