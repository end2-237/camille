-- ─────────────────────────────────────────────────────────────────────────────
-- Carte du menu, frais de livraison, version minimale de l'app.
-- A lancer sur le Postgres de Camille. Entierement rejouable.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Restauration : carte du menu envoyee sur demande ─────────────────────────
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS menu_image_url TEXT;

-- ── Livraison : montant par defaut + bareme par quartier ─────────────────────
-- Le bareme est un tableau [{zone, fee}] : le quartier du client est cherche
-- dedans, sinon on applique le montant par defaut.
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 1000;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS delivery_zones   JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Les frais appliques sont figes sur la commande : changer le bareme plus tard
-- ne doit pas reecrire l'historique.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS thanked_at   TIMESTAMPTZ;

-- ── Version minimale exigee de l'app mobile ──────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.app_release (
  platform     TEXT PRIMARY KEY,              -- android | ios
  min_version  TEXT NOT NULL DEFAULT '1.0.0', -- en-deca : app bloquee
  latest_version TEXT NOT NULL DEFAULT '1.0.0',
  download_url TEXT,
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO camille.app_release (platform, min_version, latest_version)
VALUES ('android', '1.0.0', '1.0.0')
ON CONFLICT (platform) DO NOTHING;
