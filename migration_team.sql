-- ─────────────────────────────────────────────────────────────────────────────
-- migration_team.sql — inviter des collaborateurs sur son compte.
--
-- Un propriétaire invite une adresse e-mail avec un rôle :
--   gerant  : ventes, catalogue et réglages des agents (pas la facturation,
--             ni l'équipe, ni la suppression)
--   vendeur : commandes, réclamations, clients, livraisons
-- et, au choix, tous ses agents (agent_ids NULL) ou une liste précise.
-- L'invitation se fait par un lien envoyé par e-mail ; on n'en garde que
-- l'empreinte. member_id est posé à l'acceptation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES camille.users(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES camille.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('gerant', 'vendeur')),
  agent_ids    UUID[],
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  token_hash   TEXT UNIQUE,
  expires_at   TIMESTAMPTZ,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ
);

-- Une seule invitation vivante par adresse et par propriétaire.
CREATE UNIQUE INDEX IF NOT EXISTS team_members_owner_email_uniq
  ON camille.team_members (owner_id, LOWER(email)) WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS team_members_member_idx
  ON camille.team_members (member_id) WHERE status = 'active';

-- Droits du compte de l'application : les migrations se passent souvent avec
-- un compte administrateur, et une table qu'il crée reste illisible pour
-- l'application (« permission denied ») sans ces GRANT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_camille') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON camille.team_members TO app_camille;
  END IF;
END $$;
