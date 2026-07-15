-- ═══════════════════════════════════════════════════════════════════════════
-- migration_products.sql — Camille · catalogue produits (Niveau 2)
-- Idempotent. À appliquer :  psql "$DATABASE_URL" -f migration_products.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS camille.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       NUMERIC(12,2) DEFAULT NULL,   -- prix (ou borne basse)
  price_max   NUMERIC(12,2) DEFAULT NULL,   -- borne haute optionnelle (ex: 180–220)
  currency    TEXT NOT NULL DEFAULT 'XAF',
  category    TEXT DEFAULT NULL,
  tags        JSONB NOT NULL DEFAULT '[]',
  stock       INTEGER DEFAULT NULL,          -- NULL = stock non suivi
  min_order   INTEGER NOT NULL DEFAULT 1,
  rating      NUMERIC(2,1) DEFAULT NULL,     -- note optionnelle (0.0–5.0)
  image_url   TEXT DEFAULT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_agent_idx  ON camille.products (agent_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON camille.products (agent_id, active);

-- Recherche plein-texte simple (nom + description + catégorie)
CREATE INDEX IF NOT EXISTS products_search_idx ON camille.products
  USING GIN (to_tsvector('simple',
    coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));

COMMENT ON TABLE camille.products IS 'Catalogue produits d''un agent (Niveau 2)';

COMMIT;
