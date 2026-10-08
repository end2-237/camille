-- ═══════════════════════════════════════════════════════════════════════════
-- migration_meta_signup.sql
--
-- L'Embedded Signup : chaque commerçant connecte SON WhatsApp Business.
-- Les colonnes meta_phone_number_id, meta_waba_id et meta_catalog_id existent
-- déjà (migration_meta_transport.sql). On ajoute ce qu'il faut pour parler en
-- son nom : son jeton (CHIFFRÉ, jamais en clair — clé META_TOKEN_KEY hors de la
-- base), le code PIN de son numéro (chiffré aussi), et de quoi l'afficher.
--
-- ENTIÈREMENT ADDITIVE. Rejouable sans risque.
--   psql "$DATABASE_URL" -f migration_meta_signup.sql
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS meta_token_enc      text;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS meta_pin_enc        text;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS meta_display_phone  text;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS meta_verified_name  text;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS meta_connected_at   timestamptz;

COMMENT ON COLUMN camille.agents.meta_token_enc IS
  'Jeton Meta du commerçant (Embedded Signup), chiffré AES-256-GCM. Clé : META_TOKEN_KEY (environnement).';
COMMENT ON COLUMN camille.agents.meta_pin_enc IS
  'Code PIN (vérification en deux étapes) choisi à l''enregistrement du numéro, chiffré.';
