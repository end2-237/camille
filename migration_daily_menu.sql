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

-- Les jours de la semaine où le plat est servi (1 = lundi … 6 = samedi).
--
-- Un plat qui n'est pas au menu aujourd'hui n'est pas pour autant en rupture :
-- il revient jeudi. Sans cette colonne, le site ne pouvait que dire « sur
-- demande » ; avec elle, il annonce une date, parce que la cuisine l'a dite.
ALTER TABLE camille.products
  ADD COLUMN IF NOT EXISTS available_days JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN camille.products.available_days IS
  'Jours de service du plat, 1 = lundi … 6 = samedi (activités de restauration)';

-- On ne lit jamais que les produits marqués d'un agent : un index partiel
-- suffit, et ne coûte rien aux catalogues qui n'utilisent pas le menu du jour.
CREATE INDEX IF NOT EXISTS products_daily_menu_idx
  ON camille.products (agent_id)
  WHERE daily_menu;

COMMIT;
