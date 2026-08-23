// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/agents/[agentId]/companies/[companyId] → fiche, grand livre, commandes
// PATCH  …                                          → modifie la fiche
// POST   …                                          → inscrit un versement
// DELETE …                                          → ferme le compte
//
// Le versement passe par le grand livre, jamais par une écriture directe du
// solde : un solde qu'on ne peut pas expliquer ne vaut rien face à une
// entreprise qui conteste sa facture.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import {
  clip,
  COMPANIES_MISSING as MISSING,
  monthToDate,
  normalize,
  ownsAgent as owned,
  post as postLedger,
} from "@/lib/companyAccounts";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RouteContext = { params: Promise<{ agentId: string; companyId: string }> };

async function load(agentId: string, companyId: string) {
  const r = await query(
    "SELECT * FROM camille.company_accounts WHERE id = $1 AND agent_id = $2",
    [companyId, agentId]
  );
  return r.rows[0] ? normalize(r.rows[0]) : null;
}

async function guard(req: NextRequest, params: RouteContext["params"]) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const { agentId, companyId } = await params;
  if (!(await owned(agentId, user.id))) {
    return { error: NextResponse.json({ error: "Agent introuvable" }, { status: 404 }) };
  }
  const company = await load(agentId, companyId);
  if (!company) return { error: NextResponse.json({ error: "Compte introuvable" }, { status: 404 }) };
  return { agentId, company };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const g = await guard(req, params);
    if ("error" in g) return g.error;

    const [ledger, orders, spent] = await Promise.all([
      query(
        `SELECT kind, amount, balance_after, order_ref, label, created_at
           FROM camille.company_ledger WHERE company_id = $1
          ORDER BY created_at DESC LIMIT 50`,
        [g.company.id]
      ),
      query(
        `SELECT ref, status, total, currency, customer_name, contact_phone, created_at
           FROM camille.orders WHERE company_id = $1
          ORDER BY created_at DESC LIMIT 30`,
        [g.company.id]
      ),
      monthToDate(g.company.id),
    ]);

    return NextResponse.json({
      company: { ...g.company, month_to_date: spent.spent, orders_this_month: spent.orders },
      ledger: ledger.rows.map((r: any) => ({ ...r, amount: Number(r.amount) || 0, balance_after: r.balance_after == null ? null : Number(r.balance_after) })),
      orders: orders.rows.map((o: any) => ({ ...o, total: Number(o.total) || 0 })),
    });
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return NextResponse.json({ error: MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const g = await guard(req, params);
    if ("error" in g) return g.error;

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // COALESCE : un champ absent du corps ne doit pas effacer ce qui est connu.
    const r = await query(
      `UPDATE camille.company_accounts
          SET name          = COALESCE($1, name),
              contact_name  = COALESCE($2, contact_name),
              contact_phone = COALESCE($3, contact_phone),
              email         = COALESCE($4, email),
              address       = COALESCE($5, address),
              details       = COALESCE($6, details),
              billing_mode  = COALESCE($7, billing_mode),
              monthly_cap   = CASE WHEN $8::text IS NULL THEN monthly_cap
                                   WHEN $8 = '' THEN NULL ELSE $8::numeric END,
              status        = COALESCE($9, status),
              note          = COALESCE($10, note),
              updated_at    = NOW()
        WHERE id = $11
        RETURNING *`,
      [
        clip(b.name, 80), clip(b.contact_name, 60),
        b.contact_phone === undefined ? null : String(b.contact_phone).replace(/[^0-9]/g, "") || null,
        clip(b.email, 120), clip(b.address, 200), clip(b.details, 120),
        b.billing_mode === "monthly" || b.billing_mode === "prepaid" ? b.billing_mode : null,
        b.monthly_cap === undefined ? null : String(b.monthly_cap ?? ""),
        b.status === "active" || b.status === "suspended" ? b.status : null,
        clip(b.note, 200),
        g.company.id,
      ]
    );
    return NextResponse.json({ company: normalize(r.rows[0]) });
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return NextResponse.json({ error: MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const g = await guard(req, params);
    if ("error" in g) return g.error;

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Montant du versement invalide." }, { status: 400 });
    }
    // Un ajustement à la baisse existe aussi : une erreur de saisie doit
    // pouvoir se corriger sans effacer l'historique.
    const kind = b.kind === "debit" ? "debit" : "credit";
    const balance = await postLedger(g.company, {
      kind,
      amount,
      label: clip(b.label, 120) ?? (kind === "credit" ? "Versement" : "Ajustement"),
    });
    return NextResponse.json({ balance, company: { ...g.company, balance } });
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return NextResponse.json({ error: MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const g = await guard(req, params);
    if ("error" in g) return g.error;
    // On suspend plutôt que de supprimer : les commandes passées y renvoient.
    await query("UPDATE camille.company_accounts SET status = 'suspended', updated_at = NOW() WHERE id = $1", [g.company.id]);
    return NextResponse.json({ ok: true, status: "suspended" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
