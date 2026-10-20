-- ─────────────────────────────────────────────────────────────────────────────
-- migration_paiement_buyfacturation.sql
--
--   - un paiement dit ce qu'il paie (forfait ou option Site) et par qui il
--     passe (monetbil ou buyfacturation) ;
--   - l'option Site a sa propre date de fin, comme le forfait.
--
-- Additive et idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE camille.payments ADD COLUMN IF NOT EXISTS kind     TEXT NOT NULL DEFAULT 'forfait';
ALTER TABLE camille.payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'monetbil';
ALTER TABLE camille.agents   ADD COLUMN IF NOT EXISTS site_expires_at TIMESTAMPTZ;
