-- migration_agent_media.sql — médias de prospection par agent (flyers, galeries, fiches services).
-- Idempotent. À coller dans le Postgres de camille.
-- Format : tableau JSON d'objets { kind, url, caption } ; kind ∈ (logo, flyers, gallery, services, menu).
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
