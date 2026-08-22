-- ─────────────────────────────────────────────────────────────────────────────
-- migration_site_traffic.sql
--
-- Deux manques constatés une fois qu'un marchand a branché son site :
--
--   1. Il ne sait pas ce qui se passe dessus. Camille voyait les commandes,
--      jamais les visites : impossible de dire si personne ne vient ou si tout
--      le monde repart du panier. → camille.site_events
--
--   2. La commande arrivait sans son contexte : mode de paiement annoncé,
--      livraison ou retrait, code promo. Tout cela était écrasé dans la note,
--      tronquée à 120 caractères. → trois colonnes sur camille.orders
--
-- Purement additive et idempotente : aucune colonne existante n'est touchée.
-- Le code retombe sur les chemins sans ces objets (erreur 42703 rattrapée),
-- une base non migrée continue donc de fonctionner.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Trafic du site ───────────────────────────────────────────────────────
-- Un événement = une page vue, un produit consulté, un panier, un paiement
-- entamé. Rien de nominatif : le visiteur est un identifiant aléatoire posé
-- par son navigateur, sans cookie tiers ni adresse IP conservée.
CREATE TABLE IF NOT EXISTS camille.site_events (
  id            BIGSERIAL PRIMARY KEY,
  agent_id      UUID NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'page_view',  -- page_view | product_view | add_to_cart | checkout_start | order
  path          TEXT,                               -- chemin visité, sans domaine
  title         TEXT,
  referrer_host TEXT,                               -- d'où vient le visiteur (google.com, facebook.com…)
  visitor       TEXT,                               -- identifiant anonyme, stable ~30 jours
  session_id    TEXT,                               -- visite en cours
  device        TEXT,                               -- mobile | tablet | desktop
  locale        TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb, -- {product_id, name, value…}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_events_agent_time
  ON camille.site_events (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_events_agent_kind
  ON camille.site_events (agent_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_events_visitor
  ON camille.site_events (agent_id, visitor, created_at DESC);

COMMENT ON TABLE camille.site_events IS
  'Trafic des sites branchés sur l''API publique. Anonyme : aucun nom, aucune IP.';

-- ── 2. Contexte de la commande ──────────────────────────────────────────────
-- Ce que le site sait et que Camille perdait : comment le client compte payer,
-- s'il se fait livrer ou s'il vient chercher, et le code promo qu'il a saisi.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS fulfillment    TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS promo_code     TEXT;

COMMENT ON COLUMN camille.orders.payment_method IS
  'Moyen de paiement annoncé par le client (espèces à la livraison, Orange Money…). Aucun encaissement.';
COMMENT ON COLUMN camille.orders.fulfillment IS
  'livraison | retrait. NULL = livraison (comportement historique).';
COMMENT ON COLUMN camille.orders.promo_code IS
  'Code promo saisi sur le site, à vérifier par le commerçant.';

COMMIT;

-- ── Entretien (à planifier, hors transaction) ────────────────────────────────
-- Le trafic n'a d'intérêt que récent : on ne garde pas six mois de pages vues.
--   DELETE FROM camille.site_events WHERE created_at < NOW() - INTERVAL '180 days';
