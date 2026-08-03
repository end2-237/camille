-- migration_plan_expiry.sql
-- Donne une date de fin aux abonnements payants.
--
-- Pourquoi : un paiement reussi mettait a jour agents.plan sans jamais
-- enregistrer jusqu'a quand. La notion d'abonnement qui se termine n'existait
-- nulle part — ni en base, ni dans le code. Un agent restait donc actif
-- indefiniment apres la fin du mois paye, et le vendeur ne voyait rien.
--
-- Idempotent. A appliquer sur le Postgres de camille.

BEGIN;

ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN camille.agents.plan_expires_at IS
  'Fin de l''abonnement paye. NULL = pas de terme (free, enterprise, ou agent jamais paye).';

-- ── Report des abonnements deja en cours ──────────────────────────────────────
-- Sans ce report, appliquer cette migration couperait le jour meme tous les
-- clients payants existants : leur plan est paye, mais aucune date n'a jamais
-- ete enregistree pour le prouver. On leur accorde un mois a partir de leur
-- dernier paiement reussi, ou a partir de maintenant si on n'en trouve pas.
UPDATE camille.agents a
   SET plan_expires_at = COALESCE(
         (SELECT MAX(p.created_at) + INTERVAL '1 month'
            FROM camille.payments p
           WHERE p.agent_id = a.id AND p.status = 'success'),
         NOW() + INTERVAL '1 month'
       )
 WHERE a.plan_expires_at IS NULL
   AND a.plan NOT IN ('free', 'enterprise');

-- Les forfaits sans terme n'en prennent pas : free n'a rien a renouveler, et
-- enterprise ne doit jamais pouvoir etre desactive.
UPDATE camille.agents
   SET plan_expires_at = NULL
 WHERE plan IN ('free', 'enterprise');

CREATE INDEX IF NOT EXISTS agents_plan_expires_idx
    ON camille.agents (plan_expires_at)
 WHERE plan_expires_at IS NOT NULL;

COMMIT;

-- ── Verification ──────────────────────────────────────────────────────────────
--   SELECT plan, COUNT(*), MIN(plan_expires_at), MAX(plan_expires_at)
--     FROM camille.agents GROUP BY plan ORDER BY plan;
