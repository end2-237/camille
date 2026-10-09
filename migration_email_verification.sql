-- ─────────────────────────────────────────────────────────────────────────────
-- migration_email_verification.sql — vérifier l'adresse e-mail à l'inscription.
--
-- Les comptes déjà créés sont considérés comme vérifiés : ils ont servi, et
-- les bloquer du jour au lendemain n'apporterait rien. Seuls les nouveaux
-- comptes (et une adresse modifiée) passent par le code à 6 chiffres.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE camille.users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

UPDATE camille.users SET email_verified_at = COALESCE(created_at, NOW())
 WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS camille.email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES camille.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verifications_user_idx
  ON camille.email_verifications (user_id, created_at DESC);

-- Droits du compte de l'application : les migrations se passent souvent avec
-- un compte administrateur, et une table qu'il crée reste illisible pour
-- l'application (« permission denied ») sans ces GRANT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_camille') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON camille.email_verifications TO app_camille;
  END IF;
END $$;
