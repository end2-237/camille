-- ═══════════════════════════════════════════════════════════════════════════
-- migration_catalog_v2.sql — Catalogue avancé (variations, multi-images,
-- recherche sémantique + visuelle). Idempotent.
--   psql "$DATABASE_URL" -f migration_catalog_v2.sql
-- pgvector requis pour la recherche sémantique/visuelle (CREATE EXTENSION).
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── pgvector (recherche sémantique + image). Ignoré si non dispo. ───────────
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector indisponible — la recherche sémantique/image sera désactivée jusqu''à installation.';
END $$;

-- ── Multi-images + variations sur le produit ────────────────────────────────
--   images   : liste d'URLs supplémentaires (la principale reste image_url)
--   variants : [{ "name":"Couleur", "options":["Noir","Blanc"] }, ...]
ALTER TABLE camille.products ADD COLUMN IF NOT EXISTS images   JSONB NOT NULL DEFAULT '[]';
ALTER TABLE camille.products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]';

-- ── Colonnes embeddings (nullable — remplies par un job d'indexation) ───────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') THEN
    -- 1536 = text-embedding-3-small (OpenAI) ; 512/768 pour CLIP selon le modèle.
    EXECUTE 'ALTER TABLE camille.products ADD COLUMN IF NOT EXISTS embedding vector(1536)';
    EXECUTE 'ALTER TABLE camille.products ADD COLUMN IF NOT EXISTS image_embedding vector(512)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS products_embedding_idx ON camille.products USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS products_imgembedding_idx ON camille.products USING ivfflat (image_embedding vector_cosine_ops) WITH (lists=100)';
  END IF;
END $$;

-- ── Marqueur : produit à (ré)indexer (embedding à recalculer) ───────────────
ALTER TABLE camille.products ADD COLUMN IF NOT EXISTS needs_reindex BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN camille.products.images   IS 'URLs d''images supplémentaires (JSONB array)';
COMMENT ON COLUMN camille.products.variants IS 'Variations : [{name, options[]}] (JSONB)';

COMMIT;
