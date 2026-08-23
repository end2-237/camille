// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/agents/[agentId]/companies → les comptes entreprise du marchand
// POST /api/agents/[agentId]/companies → ouvre un compte et tire son code
//
// Le code est généré ici, une fois : c'est lui que l'entreprise partagera à ses
// employés. On le tire jusqu'à en trouver un libre plutôt que de laisser une
// collision produire deux entreprises avec le même code.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { clip, COMPANIES_MISSING as MISSING, makeCode, normalize, ownsAgent as owned } from "@/lib/companyAccounts";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await owned(agentId, user.id))) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  try {
    const r = await query(
      `SELECT c.*,
              (SELECT COALESCE(SUM(o.total), 0) FROM camille.orders o
                WHERE o.company_id = c.id AND o.status <> 'annulee'
                  AND o.created_at >= date_trunc('month', NOW()))          AS month_to_date,
              (SELECT COUNT(*) FROM camille.orders o
                WHERE o.company_id = c.id AND o.status <> 'annulee'
                  AND o.created_at >= date_trunc('month', NOW()))          AS orders_this_month,
              (SELECT COUNT(DISTINCT o.contact_phone) FROM camille.orders o
                WHERE o.company_id = c.id)                                  AS employees
         FROM camille.company_accounts c
        WHERE c.agent_id = $1
        ORDER BY c.name`,
      [agentId]
    );
    return NextResponse.json({
      ready: true,
      companies: r.rows.map((row: any) => ({
        ...normalize(row),
        month_to_date: Number(row.month_to_date) || 0,
        orders_this_month: Number(row.orders_this_month) || 0,
        employees: Number(row.employees) || 0,
      })),
    });
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return NextResponse.json({ ready: false, error: MISSING });
    return NextResponse.json({ ready: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await owned(agentId, user.id))) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = clip(b.name, 80);
  if (!name) return NextResponse.json({ error: "Le nom de l'entreprise est obligatoire." }, { status: 400 });

  const mode = b.billing_mode === "monthly" ? "monthly" : "prepaid";

  try {
    // Quelques tentatives : une collision est improbable, l'ignorer ne l'est pas.
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = clip(b.code, 12) ?? makeCode(name);
      const exists = await query(
        "SELECT 1 FROM camille.company_accounts WHERE agent_id = $1 AND upper(code) = upper($2)",
        [agentId, code]
      );
      if (exists.rows.length) {
        if (b.code) return NextResponse.json({ error: `Le code ${code} est déjà pris.` }, { status: 409 });
        continue;
      }

      const r = await query(
        `INSERT INTO camille.company_accounts
           (agent_id, code, name, contact_name, contact_phone, email, address, details,
            lat, lng, billing_mode, monthly_cap, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          agentId, code, name,
          clip(b.contact_name, 60), String(b.contact_phone ?? "").replace(/[^0-9]/g, "") || null,
          clip(b.email, 120), clip(b.address, 200), clip(b.details, 120),
          Number.isFinite(Number(b.lat)) && Number(b.lat) !== 0 ? Number(b.lat) : null,
          Number.isFinite(Number(b.lng)) && Number(b.lng) !== 0 ? Number(b.lng) : null,
          mode,
          Number.isFinite(Number(b.monthly_cap)) && Number(b.monthly_cap) > 0 ? Number(b.monthly_cap) : null,
          clip(b.note, 200),
        ]
      );
      return NextResponse.json({ company: normalize(r.rows[0]) }, { status: 201 });
    }
    return NextResponse.json({ error: "Impossible de tirer un code libre. Réessaie." }, { status: 500 });
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return NextResponse.json({ error: MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
