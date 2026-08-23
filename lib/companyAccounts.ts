// ─────────────────────────────────────────────────────────────────────────────
// Comptes entreprise — un code, une provision, un grand livre.
//
// Une entreprise cliente reçoit un code qu'elle partage à ses employés. Chacun
// commande avec son propre téléphone ; le code dit à qui la commande est
// rattachée, et donc qui paie.
//
// Deux régimes, portés par le compte :
//   prepaid — l'entreprise verse d'avance, la commande décompte le solde, et
//             une commande sans provision suffisante est refusée.
//   monthly — les commandes s'accumulent et sont réglées en fin de mois.
//
// Tout mouvement passe par le grand livre : c'est ce qui rend le solde
// vérifiable plutôt que déclaratif.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CompanyAccount = {
  id: string;
  agent_id: string;
  code: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  email: string | null;
  address: string | null;
  details: string | null;
  lat: number | null;
  lng: number | null;
  billing_mode: "prepaid" | "monthly";
  balance: number;
  monthly_cap: number | null;
  currency: string;
  status: "active" | "suspended";
  note: string | null;
  created_at: string;
};

/** Sans I ni O ni 0 ni 1 : le code se dicte au téléphone sans être répété. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Deux lettres du nom + quatre caractères tirés : « ENKO-7K2M ». */
export function makeCode(name: string) {
  const prefix = (String(name).toUpperCase().replace(/[^A-Z]/g, "") + "XX").slice(0, 3) || "ENT";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}-${suffix}`;
}

/** Un code saisi à la main arrive avec des espaces, des minuscules, parfois sans tiret. */
export const normalizeCode = (raw: unknown) =>
  String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

/** Le code tel qu'on le compare en base : la normalisation vaut des deux côtés. */
const CODE_MATCH = `upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) = $2`;

export async function findByCode(agentId: string, rawCode: string): Promise<CompanyAccount | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const r = await query(
    `SELECT * FROM camille.company_accounts WHERE agent_id = $1 AND ${CODE_MATCH} LIMIT 1`,
    [agentId, code]
  );
  const row = r.rows[0];
  return row ? normalize(row) : null;
}

export function normalize(row: any): CompanyAccount {
  return {
    ...row,
    balance: Number(row.balance) || 0,
    monthly_cap: row.monthly_cap == null ? null : Number(row.monthly_cap),
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
  };
}

/** Ce que le compte a consommé depuis le premier du mois. */
export async function monthToDate(companyId: string) {
  const r = await query(
    `SELECT COALESCE(SUM(total), 0) AS spent, COUNT(*) AS orders
       FROM camille.orders
      WHERE company_id = $1
        AND status <> 'annulee'
        AND created_at >= date_trunc('month', NOW())`,
    [companyId]
  ).catch(() => ({ rows: [{ spent: 0, orders: 0 }] }));
  return { spent: Number(r.rows[0]?.spent) || 0, orders: Number(r.rows[0]?.orders) || 0 };
}

/**
 * Le compte peut-il porter cette commande ?
 *
 * Prépayé : la provision doit couvrir le montant — c'est tout l'intérêt du
 * paiement d'avance, et refuser ici vaut mieux que livrer puis réclamer.
 * Mensuel : on ne bloque que si un plafond a été posé et qu'il est atteint.
 */
export async function canAfford(account: CompanyAccount, amount: number) {
  if (account.status !== "active") {
    return { ok: false as const, reason: `Le compte ${account.name} est suspendu.` };
  }
  if (account.billing_mode === "prepaid") {
    if (account.balance < amount) {
      return {
        ok: false as const,
        reason: `Provision insuffisante sur le compte ${account.name} : il reste ${fmt(account.balance, account.currency)} pour une commande de ${fmt(amount, account.currency)}.`,
        balance: account.balance,
      };
    }
    return { ok: true as const };
  }
  if (account.monthly_cap != null) {
    const { spent } = await monthToDate(account.id);
    if (spent + amount > account.monthly_cap) {
      return {
        ok: false as const,
        reason: `Plafond mensuel atteint pour ${account.name} : ${fmt(spent, account.currency)} consommés sur ${fmt(account.monthly_cap, account.currency)}.`,
      };
    }
  }
  return { ok: true as const };
}

const fmt = (n: number, cur: string) => `${Number(n || 0).toLocaleString("fr-FR")} ${cur || "XAF"}`;

/**
 * Inscrit un mouvement et met le solde à jour, d'un seul geste.
 *
 * Le solde n'est décompté QUE pour un compte prépayé : sur un compte mensuel
 * il resterait à zéro et deviendrait négatif sans rien vouloir dire. Le grand
 * livre, lui, garde la trace dans les deux cas.
 */
export async function post(
  account: CompanyAccount,
  entry: { kind: "credit" | "debit"; amount: number; orderId?: string | null; orderRef?: string | null; label?: string }
) {
  const amount = Math.max(0, Number(entry.amount) || 0);
  const moves = account.billing_mode === "prepaid" || entry.kind === "credit";
  const delta = moves ? (entry.kind === "credit" ? amount : -amount) : 0;

  const r = await query(
    `UPDATE camille.company_accounts
        SET balance = balance + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING balance`,
    [delta, account.id]
  );
  const balanceAfter = Number(r.rows[0]?.balance ?? account.balance);

  await query(
    `INSERT INTO camille.company_ledger
       (company_id, agent_id, kind, amount, balance_after, order_id, order_ref, label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [account.id, account.agent_id, entry.kind, amount, balanceAfter,
     entry.orderId ?? null, entry.orderRef ?? null, entry.label ?? null]
  );

  return balanceAfter;
}

/** Le message unique quand la migration n'est pas passée : même geste partout. */
export const COMPANIES_MISSING =
  "Comptes entreprise non installés — applique migration_company_accounts.sql";

/** Le marchand est-il bien propriétaire de cet agent ? */
export async function ownsAgent(agentId: string, userId: string) {
  const r = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, userId]
  );
  return r.rows.length > 0;
}

/** Un champ de formulaire : coupé, débarrassé de ses espaces, vide = absent. */
export const clip = (v: unknown, n: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, n) : null;
};

/** La fiche telle qu'un site a le droit de la montrer à un employé. */
export async function publicView(account: CompanyAccount) {
  const { spent, orders } = await monthToDate(account.id);
  return {
    code: account.code,
    name: account.name,
    status: account.status,
    billing_mode: account.billing_mode,
    currency: account.currency,
    balance: account.billing_mode === "prepaid" ? account.balance : null,
    monthly_cap: account.monthly_cap,
    month_to_date: spent,
    orders_this_month: orders,
    contact_name: account.contact_name,
    contact_phone: account.contact_phone,
    address: account.address,
    details: account.details,
    lat: account.lat,
    lng: account.lng,
  };
}
