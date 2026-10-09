-- ─────────────────────────────────────────────────────────────────────────────
-- migration_password_reset.sql — les liens « mot de passe oublié ».
--
-- On ne garde que l'empreinte SHA-256 du jeton envoyé par e-mail : une fuite
-- de la base ne donne aucun lien utilisable. Un jeton vit 30 minutes et ne
-- sert qu'une fois (used_at).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES camille.users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_resets_user_idx
  ON camille.password_resets (user_id, created_at DESC);

-- Droits du compte de l'application : les migrations se passent souvent avec
-- un compte administrateur, et une table qu'il crée reste illisible pour
-- l'application (« permission denied ») sans ces GRANT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_camille') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON camille.password_resets TO app_camille;
  END IF;
END $$;
