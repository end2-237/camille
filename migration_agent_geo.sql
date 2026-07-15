-- ═══════════════════════════════════════════════════════════════════════════
-- migration_agent_geo.sql — coordonnées de la boutique (pour sendLocation)
-- Idempotent. psql "$DATABASE_URL" -f migration_agent_geo.sql
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6) DEFAULT NULL;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) DEFAULT NULL;
COMMENT ON COLUMN camille.agents.latitude  IS 'Latitude de la boutique (sendLocation)';
COMMENT ON COLUMN camille.agents.longitude IS 'Longitude de la boutique (sendLocation)';
COMMIT;
-- Exemple pour définir la position (Douala) :
--   UPDATE camille.agents SET latitude=4.0511, longitude=9.7679 WHERE id='...';
