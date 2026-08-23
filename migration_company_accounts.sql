-- ─────────────────────────────────────────────────────────────────────────────
-- migration_company_accounts.sql
--
-- Le compte entreprise : ce qui manquait pour vendre à des sociétés.
--
-- Une entreprise devient cliente, reçoit UN code, et le partage à ses
-- employés. Chaque employé commande avec son propre téléphone, mais le code
-- dit à quelle entreprise rattacher la commande — et donc qui paie.
--
-- Jusqu'ici « l'entreprise » n'était qu'un texte libre sur la fiche contact :
-- deux orthographes suffisaient à casser le rattachement, et rien ne disait ce
-- que l'entreprise avait consommé ni ce qu'elle avait versé.
--
-- Deux façons de payer, portées par le compte lui-même :
--   prepaid  — l'entreprise approvisionne d'avance, chaque commande décompte
--              le solde, et une commande sans provision est refusée.
--   monthly  — les commandes s'accumulent, l'entreprise règle en fin de mois
--              (un plafond mensuel peut être posé).
--
-- Le grand livre garde chaque mouvement : versements et consommations. C'est
-- lui qui rend le solde vérifiable au lieu d'être un simple nombre.
--
-- Additive et idempotente. Le code retombe sans elle sur les chemins existants.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS camille.company_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,

  -- Le code partagé aux employés. Court, lisible au téléphone, sans I/O/0/1.
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,

  -- Qui répond pour l'entreprise, et où l'on livre par défaut.
  contact_name  TEXT,
  contact_phone TEXT,
  email         TEXT,
  address       TEXT,
  details       TEXT,                     -- bloc, étage, bureau
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,

  billing_mode  TEXT NOT NULL DEFAULT 'prepaid',   -- prepaid | monthly
  balance       NUMERIC(12,2) NOT NULL DEFAULT 0,  -- prépayé : provision restante
  monthly_cap   NUMERIC(12,2),                     -- mensuel : plafond, NULL = sans
  currency      TEXT NOT NULL DEFAULT 'XAF',
  status        TEXT NOT NULL DEFAULT 'active',    -- active | suspended
  note          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un code appartient à un marchand : deux marchands peuvent utiliser le même
  -- sans se marcher dessus.
  CONSTRAINT company_accounts_code_unique UNIQUE (agent_id, code)
);

CREATE INDEX IF NOT EXISTS idx_company_accounts_agent
  ON camille.company_accounts (agent_id, name);

COMMENT ON TABLE camille.company_accounts IS
  'Compte entreprise : un code partagé aux employés, une provision ou un relevé mensuel.';
COMMENT ON COLUMN camille.company_accounts.code IS
  'Code partagé aux employés. Sert à rattacher leurs commandes à l''entreprise.';
COMMENT ON COLUMN camille.company_accounts.billing_mode IS
  'prepaid = provision décomptée à la commande ; monthly = relevé réglé en fin de mois.';

-- ── Grand livre : versements et consommations ───────────────────────────────
CREATE TABLE IF NOT EXISTS camille.company_ledger (
  id            BIGSERIAL PRIMARY KEY,
  company_id    UUID NOT NULL REFERENCES camille.company_accounts(id) ON DELETE CASCADE,
  agent_id      UUID NOT NULL,
  kind          TEXT NOT NULL,                 -- credit (versement) | debit (commande)
  amount        NUMERIC(12,2) NOT NULL,        -- toujours positif : c'est kind qui donne le sens
  balance_after NUMERIC(12,2),
  order_id      BIGINT,
  order_ref     TEXT,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_ledger_company
  ON camille.company_ledger (company_id, created_at DESC);

COMMENT ON TABLE camille.company_ledger IS
  'Mouvements d''un compte entreprise : versements et commandes. Rend le solde vérifiable.';

-- ── La commande sait à quelle entreprise elle est rattachée ─────────────────
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS company_id   UUID;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS company_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_company
  ON camille.orders (company_id, created_at DESC)
  WHERE company_id IS NOT NULL;

COMMENT ON COLUMN camille.orders.company_code IS
  'Code saisi par l''employé au moment de commander. Gardé tel quel pour l''historique.';

COMMIT;
