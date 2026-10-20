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

COMMIT;
