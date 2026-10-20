-- ─────────────────────────────────────────────────────────────────────────────
-- migration_ouverture.sql
--
--   - le délai annoncé au client et la commande minimum, par agent ;
--   - la preuve de remise d'une commande (photo, position du livreur) ;
--   - les articles Meta supprimés dans Camille, pour ne pas les réimporter.
--
-- Additive et idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS delivery_delay TEXT;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS min_order      NUMERIC(12,2);

COMMENT ON COLUMN camille.agents.delivery_delay IS 'Délai de livraison annoncé au client (« 1 h à 2 h »).';
COMMENT ON COLUMN camille.agents.min_order      IS 'Montant minimum des articles d''une commande, hors livraison.';

ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS proof_url     TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS delivered_lat DOUBLE PRECISION;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS delivered_lng DOUBLE PRECISION;

COMMENT ON COLUMN camille.orders.proof_url IS 'Photo de remise prise par le livreur.';

-- Un article importé de Meta puis supprimé dans Camille : si son retrait chez
-- Meta échoue, la synchronisation suivante le réimportait. On s'en souvient.
CREATE TABLE IF NOT EXISTS camille.meta_retraits (
  agent_id    UUID NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  retailer_id TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, retailer_id)
);

-- Ce que les clients ont demandé sans le trouver : le commerçant sait quoi
-- ajouter à son catalogue (« 14 clients ont demandé des sandales »).
CREATE TABLE IF NOT EXISTS camille.demandes_manquees (
  id         BIGSERIAL PRIMARY KEY,
  agent_id   UUID NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  phone      TEXT,
  texte      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demandes_manquees_agent ON camille.demandes_manquees (agent_id, created_at DESC);

-- Le bilan du matin : un par agent et par jour, pas plus.
CREATE TABLE IF NOT EXISTS camille.bilans_envoyes (
  agent_id UUID NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  jour     DATE NOT NULL,
  PRIMARY KEY (agent_id, jour)
);

-- L'option « Site » : la demande du commerçant et le brief préparé pour DIP.
CREATE TABLE IF NOT EXISTS camille.site_demandes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES camille.users(id) ON DELETE SET NULL,
  statut     TEXT NOT NULL DEFAULT 'demande',   -- demande | en_cours | en_ligne | annule
  domaine    TEXT,
  envies     TEXT,
  brief      TEXT NOT NULL,
  url        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_site_demandes_agent ON camille.site_demandes (agent_id, created_at DESC);

COMMIT;
