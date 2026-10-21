-- ─────────────────────────────────────────────────────────────────────────────
-- migration_rendezvous.sql
--
-- Les rendez-vous pris par WhatsApp ou saisis par le commerçant.
--
-- Deux rendez-vous actifs (demandé ou confirmé) d'un même agent ne peuvent
-- JAMAIS se chevaucher : c'est la base qui le garantit (contrainte
-- d'exclusion), pas seulement le code. Deux clients qui touchent le même
-- créneau à la même seconde : le second est refusé, et Camille lui propose
-- d'autres heures.
--
-- Une prestation peut avoir sa durée (products.duree_min) ; sinon, la durée
-- par défaut de l'agent (réglage dans la section Rendez-vous).
--
-- Additive et idempotente. À exécuter avec le compte postgres (l'extension).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS camille.rendez_vous (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID        NOT NULL,
  phone        TEXT        NOT NULL,
  nom          TEXT,
  prestation   TEXT,
  product_id   UUID,
  debut        TIMESTAMPTZ NOT NULL,
  fin          TIMESTAMPTZ NOT NULL,
  statut       TEXT        NOT NULL DEFAULT 'demande'
               CHECK (statut IN ('demande', 'confirme', 'annule', 'termine', 'absent')),
  note         TEXT,
  source       TEXT        NOT NULL DEFAULT 'whatsapp',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fin > debut)
);

DO $$ BEGIN
  ALTER TABLE camille.rendez_vous
    ADD CONSTRAINT rendez_vous_sans_chevauchement
    EXCLUDE USING gist (agent_id WITH =, tstzrange(debut, fin, '[)') WITH &&)
    WHERE (statut IN ('demande', 'confirme'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_rendez_vous_agent_debut ON camille.rendez_vous (agent_id, debut);

ALTER TABLE camille.products ADD COLUMN IF NOT EXISTS duree_min INTEGER;

-- Le compte de l'application (s'il n'est pas propriétaire du schéma).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_camille') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON camille.rendez_vous TO app_camille;
  END IF;
END $$;
