-- ─────────────────────────────────────────────────────────────────────────────
-- migration_parcours.sql
--
-- Les parcours WhatsApp (forfait Entreprise) : un brouillon, une version
-- publiée, l'historique des versions publiées, et où en est chaque client.
--
-- Additive et idempotente. Sans elle, Camille fonctionne comme avant : le
-- moteur ne trouve aucun parcours et laisse répondre le flux simple.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.parcours (
  agent_id    UUID        PRIMARY KEY REFERENCES camille.agents(id) ON DELETE CASCADE,
  brouillon   JSONB,
  publie      JSONB,
  version     INTEGER     NOT NULL DEFAULT 0,
  actif       BOOLEAN     NOT NULL DEFAULT FALSE,
  publie_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS camille.parcours_versions (
  agent_id    UUID        NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  version     INTEGER     NOT NULL,
  definition  JSONB       NOT NULL,
  publie_par  UUID,
  publie_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, version)
);

-- Où en est chaque client : le bloc dont on attend la réponse (boutons,
-- liste), le mode (« agent » : l'IA répond ; « silence »), et de quoi ne pas
-- répéter le message d'attente pendant qu'un humain a la main.
CREATE TABLE IF NOT EXISTS camille.parcours_etats (
  agent_id    UUID        NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  version     INTEGER     NOT NULL DEFAULT 0,
  attente     TEXT,
  mode        TEXT,
  vars        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, phone)
);

-- Droits du compte de l'application : une table créée par un administrateur
-- reste illisible pour l'application (« permission denied ») sans ces GRANT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_camille') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON camille.parcours, camille.parcours_versions, camille.parcours_etats TO app_camille;
  END IF;
END $$;
