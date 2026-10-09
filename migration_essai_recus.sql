-- ─────────────────────────────────────────────────────────────────────────────
-- migration_essai_recus.sql — essai gratuit et reçus de paiement.
--
-- Essai : le premier agent d'un compte démarre sur un forfait payant pendant
-- quelques jours (ESSAI_JOURS, ESSAI_PLAN). À la fin, il RETOMBE sur le
-- forfait gratuit au lieu de se taire : un essai qui coupe l'agent d'un
-- commerçant qui n'a rien payé serait une punition.
--
-- Reçus : chaque paiement réussi reçoit un numéro suivi (CAM-2026-000001).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS trial BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE camille.users  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

-- Les comptes existants ont déjà eu leur chance (ou paient) : pas d'essai.
UPDATE camille.users SET trial_used_at = COALESCE(created_at, NOW()) WHERE trial_used_at IS NULL;

CREATE SEQUENCE IF NOT EXISTS camille.receipt_seq;
ALTER TABLE camille.payments ADD COLUMN IF NOT EXISTS receipt_number TEXT UNIQUE;

-- Numérote les paiements déjà réussis, dans l'ordre.
UPDATE camille.payments p SET receipt_number = n.num
  FROM (
    SELECT id, 'CAM-' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD(nextval('camille.receipt_seq')::text, 6, '0') AS num
      FROM (SELECT id, created_at FROM camille.payments
             WHERE status = 'success' AND receipt_number IS NULL ORDER BY created_at) s
  ) n
 WHERE p.id = n.id;
