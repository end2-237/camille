-- ─────────────────────────────────────────────────────────────────────────────
-- migration_vitrine.sql
--
-- La vitrine en ligne des commerçants (option Site), servie par Camille
-- elle-même : https://camille.vps.buyticle.com/s/<adresse>, ou
-- https://<adresse>.<VITRINE_DOMAINE> une fois le DNS pointé.
--
-- L'adresse est posée quand l'exploitation passe la demande « en ligne ».
-- Additive et idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS site_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS agents_site_slug_idx ON camille.agents (site_slug) WHERE site_slug IS NOT NULL;
