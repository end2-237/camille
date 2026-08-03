-- migration_token_usage_unique.sql
-- Repare l'ecriture des tokens et des statistiques quotidiennes.
--
-- Pourquoi : POST /api/usage/record fait un
--   INSERT ... ON CONFLICT (agent_id, period)
-- qui exige une contrainte d'unicite sur (agent_id, period). Or la table
-- token_usage existait deja avec « PRIMARY KEY (id) » : le CREATE TABLE
-- IF NOT EXISTS de migration_stats_align.sql n'a donc rien change, et le bloc
-- qui devait ajouter la contrainte avalait sa propre erreur
-- (EXCEPTION WHEN ... OR others THEN NULL).
--
-- Consequence : chaque appel de n8n echouait en 500 sur le premier INSERT, et
-- l'insertion dans agent_analytics — placee juste apres — n'etait jamais
-- atteinte. D'ou 0 token ET 0 message dans les statistiques et sur l'accueil.
--
-- Idempotent. A appliquer sur le Postgres de camille.

BEGIN;

-- ── 0. Colonne heritee ────────────────────────────────────────────────────────
-- tokens_used n'existe que sur les bases anterieures a migration_stats_align ;
-- on la normalise pour que la fusion ci-dessous fonctionne dans les deux cas.
ALTER TABLE camille.token_usage
  ADD COLUMN IF NOT EXISTS tokens_used bigint NOT NULL DEFAULT 0;

-- ── 1. Fusionner les doublons (agent_id, period) accumules ────────────────────
-- Chaque appel ayant echoue, il peut ne rien y avoir a fusionner ; mais si des
-- lignes ont ete inserees avant que le ON CONFLICT n'apparaisse dans le code,
-- il faut les additionner plutot que d'en perdre.
CREATE TEMP TABLE token_usage_merged AS
  SELECT agent_id,
         period,
         SUM(prompt_tokens)     AS prompt_tokens,
         SUM(completion_tokens) AS completion_tokens,
         SUM(total_tokens)      AS total_tokens,
         SUM(tokens_used)       AS tokens_used
    FROM camille.token_usage
   GROUP BY agent_id, period;

DELETE FROM camille.token_usage;

INSERT INTO camille.token_usage
       (agent_id, period, prompt_tokens, completion_tokens, total_tokens, tokens_used)
SELECT  agent_id, period, prompt_tokens, completion_tokens, total_tokens, tokens_used
  FROM  token_usage_merged;

DROP TABLE token_usage_merged;

-- ── 2. Garantir l'unicite exigee par le ON CONFLICT ───────────────────────────
-- Un index unique suffit a ON CONFLICT, et « IF NOT EXISTS » le rend rejouable.
-- Contrairement au bloc precedent, une erreur ici n'est plus silencieuse.
CREATE UNIQUE INDEX IF NOT EXISTS token_usage_agent_period_key
    ON camille.token_usage (agent_id, period);

COMMIT;

-- ── Verification ──────────────────────────────────────────────────────────────
-- Doit renvoyer une ligne :
--   SELECT indexname FROM pg_indexes
--    WHERE schemaname = 'camille' AND indexname = 'token_usage_agent_period_key';
