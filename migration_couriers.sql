-- ─────────────────────────────────────────────────────────────────────────────
-- migration_couriers.sql
--
-- Déléguer la livraison.
--
-- Jusqu'ici, tout passait par le compte du commerçant : lui seul voyait les
-- commandes, lui seul pouvait les faire avancer. Un livreur n'avait aucune
-- place — on lui téléphonait l'adresse, et personne ne savait où il en était.
--
-- Le livreur ouvre son propre compte Camille. Son profil lui donne un CODE.
-- Le commerçant colle ce code dans son tableau de bord : le livreur est
-- rattaché à la boutique, et rien d'autre. Son écran ne montre que les
-- commandes parties en livraison, leur itinéraire, et le bouton qui les
-- marque livrées. Ni catalogue, ni chiffre d'affaires, ni fiches clients.
--
-- Additive et idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Le code que le livreur donne au commerçant ───────────────────────────
-- Il vit sur le compte : un livreur peut travailler pour plusieurs boutiques
-- avec le même code, et le régénérer s'il l'a diffusé par erreur.
ALTER TABLE camille.users ADD COLUMN IF NOT EXISTS courier_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_courier_code
  ON camille.users (courier_code) WHERE courier_code IS NOT NULL;

COMMENT ON COLUMN camille.users.courier_code IS
  'Code livreur à remettre au commerçant pour être rattaché à sa boutique.';

-- ── 2. Le rattachement livreur ↔ boutique ───────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.couriers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES camille.users(id)  ON DELETE CASCADE,

  display_name TEXT,                     -- le nom tel que le commerçant l'écrit
  phone        TEXT,
  status       TEXT NOT NULL DEFAULT 'active',   -- active | suspended

  -- Dernière position connue, poussée par son téléphone pendant une course.
  -- C'est ce qui permet au commerçant de répondre « il arrive » sans appeler.
  last_lat     DOUBLE PRECISION,
  last_lng     DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT couriers_agent_user_unique UNIQUE (agent_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_couriers_user  ON camille.couriers (user_id, status);
CREATE INDEX IF NOT EXISTS idx_couriers_agent ON camille.couriers (agent_id, status);

COMMENT ON TABLE camille.couriers IS
  'Livreurs rattachés à une boutique. Leur compte ne voit que les livraisons en cours.';

-- ── 3. La commande sait qui la porte ────────────────────────────────────────
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS courier_id   UUID;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS courier_name TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_courier
  ON camille.orders (courier_id, created_at DESC) WHERE courier_id IS NOT NULL;

COMMENT ON COLUMN camille.orders.courier_id IS
  'Livreur qui a pris la course. NULL = pas encore prise en charge.';
COMMENT ON COLUMN camille.orders.picked_up_at IS
  'Moment où le livreur a pris la course, distinct du départ de la boutique.';

COMMIT;
