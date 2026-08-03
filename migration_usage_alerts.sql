-- migration_usage_alerts.sql
-- Mémoire des alertes déjà envoyées (quota de tokens, fin d'abonnement).
--
-- Sans cette trace, chaque message traité après le seuil renverrait une
-- notification : le vendeur en recevrait des dizaines par jour et apprendrait
-- à toutes les ignorer, y compris celle qui compte.
--
-- La clé primaire composite fait le verrou : l'insertion ON CONFLICT DO NOTHING
-- ne réussit qu'une seule fois par (agent, période, seuil), même si plusieurs
-- réponses arrivent en même temps.
--
-- Idempotent. À appliquer sur le Postgres de camille.

BEGIN;

CREATE TABLE IF NOT EXISTS camille.usage_alerts (
  agent_id    uuid        NOT NULL,
  period      text        NOT NULL,           -- 'YYYY-MM', ou 'plan' pour l'abonnement
  threshold   smallint    NOT NULL,           -- 80, 100 (tokens) · 7, 1, 0 (jours restants)
  kind        text        NOT NULL DEFAULT 'tokens',
  notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, period, kind, threshold)
);

COMMENT ON TABLE camille.usage_alerts IS
  'Seuils déjà notifiés, pour n''alerter qu''une fois par agent et par période.';

COMMIT;

-- ── Vérification ──────────────────────────────────────────────────────────────
--   SELECT * FROM camille.usage_alerts ORDER BY notified_at DESC LIMIT 20;
--
-- Purge éventuelle des périodes anciennes (facultatif) :
--   DELETE FROM camille.usage_alerts WHERE notified_at < NOW() - INTERVAL '6 months';
