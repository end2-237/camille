-- ─────────────────────────────────────────────────────────────────────────────
-- migration_admin.sql — un drapeau administrateur sur les comptes.
--
-- Jusqu'ici la seule « administration » était deux routes de maintenance
-- protégées par un secret partagé — et ouvertes quand le secret n'était pas
-- défini. Aucune notion d'administrateur n'existait sur les comptes, donc
-- aucune vue d'ensemble : l'exploitant ne pouvait pas savoir quel marchand
-- était en panne, à court de quota, ou déconnecté depuis la veille.
--
-- Idempotent.  psql "$DATABASE_URL" -f migration_admin.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE camille.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN camille.users.is_admin IS
  'Accès à la console d''exploitation (/dashboard/admin). Faux par défaut.';

-- Index partiel : les administrateurs se comptent sur une main, inutile
-- d'indexer les dizaines de milliers de comptes ordinaires.
CREATE INDEX IF NOT EXISTS users_admin_idx
  ON camille.users (id) WHERE is_admin;

-- ─────────────────────────────────────────────────────────────────────────────
-- À LANCER ENSUITE, en remplaçant l'adresse par la tienne :
--
--   UPDATE camille.users SET is_admin = TRUE WHERE email = 'ton@email.com';
--
-- Sans cette ligne, personne n'a accès à la console — y compris toi.
-- C'est volontaire : un drapeau qui s'accorde tout seul ne protège rien.
-- ─────────────────────────────────────────────────────────────────────────────
