-- ═══════════════════════════════════════════════════════════════════════════
-- migration_daily_menu.sql — Camille · le menu du jour
--
-- Un restaurant ne vend pas sa carte entière tous les jours : il annonce ce
-- qui sort de la cuisine aujourd'hui. Jusqu'ici, le site du commerçant devait
-- le deviner en rapprochant des noms de plats — un rapprochement approximatif,
-- qui manque un plat sur deux et met parfois le mauvais prix.
--
-- Le commerçant le dit lui-même, d'un interrupteur sur la fiche du produit.
-- La colonne est le seul endroit qui fasse autorité.
--
-- Idempotent. À appliquer :  psql "$DATABASE_URL" -f migration_daily_menu.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE camille.products
  ADD COLUMN IF NOT EXISTS daily_menu BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN camille.products.daily_menu IS
  'Le produit fait partie du menu du jour (activités de restauration)';

-- On ne lit jamais que les produits marqués d'un agent : un index partiel
-- suffit, et ne coûte rien aux catalogues qui n'utilisent pas le menu du jour.
CREATE INDEX IF NOT EXISTS products_daily_menu_idx
  ON camille.products (agent_id)
  WHERE daily_menu;

COMMIT;
