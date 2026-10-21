-- ─────────────────────────────────────────────────────────────────────────────
-- migration_agent_sante.sql
--
-- L'état d'une conversation tenu par le code de l'agent santé : urgence
-- verrouillée, relais humain, vocaux mal compris, langue, médias déjà envoyés,
-- formules déjà dites, rendez-vous demandé. Sans cette table, l'état ne vit
-- que dans la mémoire du serveur (perdu au redémarrage).
--
-- Additive et idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.conversation_etats (
  agent_id   UUID        NOT NULL,
  phone      TEXT        NOT NULL,
  etat       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, phone)
);
