-- ─────────────────────────────────────────────────────────────────────────────
-- migration_droits_app.sql
--
-- Les tables créées dans Supabase Studio (compte postgres) n'étaient pas
-- accessibles au compte de l'application (app_camille) : l'écriture échouait
-- en silence. C'est pourquoi camille.conversation_etats restait vide — l'agent
-- santé / services oubliait la conversation (accueil rejoué, formules
-- répétées) à chaque redémarrage.
--
-- Donne les droits sur TOUTES les tables du schéma camille, et pour celles à
-- venir. Reprend aussi les deux colonnes ajoutées récemment (rappels de
-- rendez-vous, vitrine), pour n'avoir qu'un fichier à passer.
--
-- Additive et idempotente. À exécuter avec le compte postgres.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE camille.rendez_vous ADD COLUMN IF NOT EXISTS rappel_at TIMESTAMPTZ;

ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS site_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS agents_site_slug_idx ON camille.agents (site_slug) WHERE site_slug IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_camille') THEN
    GRANT USAGE ON SCHEMA camille TO app_camille;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA camille TO app_camille;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA camille TO app_camille;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA camille
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_camille;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA camille
      GRANT USAGE, SELECT ON SEQUENCES TO app_camille;
  END IF;
END $$;
