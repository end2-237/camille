-- ═══════════════════════════════════════════════════════════════════════════
-- migration_contacts_animations.sql
--
-- Le client peut refuser les animations (stickers de réussite) : « trop de
-- gifs, je n'en veux plus ». Sa préférence est gardée ici, par commerce.
--
-- ENTIÈREMENT ADDITIVE. Rejouable sans risque.
--   psql "$DATABASE_URL" -f migration_contacts_animations.sql
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE camille.contacts ADD COLUMN IF NOT EXISTS sans_animation BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN camille.contacts.sans_animation IS
  'true : le client a demandé à ne plus recevoir les stickers animés (commande, livraison).';
