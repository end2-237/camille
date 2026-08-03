-- migration_doc_branding.sql
-- Identité de l'entreprise sur ses bons de commande.
--
-- Le document sortait au nom d'une seule entreprise pour tout le monde :
-- chaque vendeur envoyait donc à SES clients un bon de commande portant le nom,
-- le RCCM et le NIU de quelqu'un d'autre.
--
-- Une seule colonne JSONB plutôt que neuf colonnes plates : ces champs ne sont
-- jamais filtrés ni joints, seulement lus en bloc au moment d'imprimer.
--
-- Clés attendues (toutes facultatives) :
--   name · tagline · address · phone · email · rccm · niu · logo_url · color
--
-- Idempotent. À appliquer sur le Postgres de camille.

BEGIN;

ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS doc_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN camille.agents.doc_settings IS
  'Identité imprimée sur les bons de commande. Vide = repli sur business_name / location / whatsapp_number.';

COMMIT;

-- ── Vérification ──────────────────────────────────────────────────────────────
--   SELECT id, name, doc_settings FROM camille.agents WHERE doc_settings <> '{}'::jsonb;
