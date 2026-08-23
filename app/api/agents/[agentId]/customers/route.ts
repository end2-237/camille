// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents/[agentId]/customers?q=…
//
// La clientèle du marchand, telle qu'elle s'est constituée toute seule : les
// contacts de la conversation WhatsApp et les commandes du site, réunis sur un
// même numéro. Jusqu'ici ces fiches existaient sans qu'aucun écran ne les
// montre — le marchand ne pouvait ni retrouver un client, ni voir ce qu'il
// avait déjà commandé.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { ownsAgent } from "@/lib/companyAccounts";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await ownsAgent(agentId, user.id))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(200, Math.max(10, Number(req.nextUrl.searchParams.get("limit")) || 100));

  // Le client existe des deux côtés : une fiche contact sans commande (il a
  // seulement écrit) et une commande sans fiche (le site n'a pas encore
  // enregistré le contact) comptent toutes deux. D'où l'union sur le numéro.
  const sql = `
    WITH numeros AS (
      SELECT DISTINCT regexp_replace(phone, '@.*$', '') AS phone
        FROM camille.contacts WHERE agent_id = $1
      UNION
      SELECT DISTINCT regexp_replace(contact_phone, '@.*$', '') AS phone
        FROM camille.orders WHERE agent_id = $1 AND contact_phone IS NOT NULL
    )
    SELECT n.phone,
           c.display_name,
           c.email,
           c.company,
           c.language_pref,
           c.addresses,
           c.last_order_at,
           COALESCE(o.orders, 0)                       AS orders,
           COALESCE(o.spent, 0)                        AS spent,
           o.last_order,
           o.last_ref,
           o.company_name
      FROM numeros n
      LEFT JOIN camille.contacts c
             ON c.agent_id = $1 AND regexp_replace(c.phone, '@.*$', '') = n.phone
      LEFT JOIN LATERAL (
        SELECT COUNT(*)                                   AS orders,
               SUM(CASE WHEN status <> 'annulee' THEN total ELSE 0 END) AS spent,
               MAX(created_at)                            AS last_order,
               (ARRAY_AGG(ref ORDER BY created_at DESC))[1]          AS last_ref,
               (ARRAY_AGG(company_name ORDER BY created_at DESC) FILTER (WHERE company_name IS NOT NULL))[1] AS company_name
          FROM camille.orders
         WHERE agent_id = $1 AND regexp_replace(contact_phone, '@.*$', '') = n.phone
      ) o ON TRUE
     ORDER BY o.last_order DESC NULLS LAST
     LIMIT $2`;

  try {
    const r = await query(sql, [agentId, limit]);
    let rows = r.rows.map((x: any) => ({
      phone: x.phone,
      name: x.display_name ?? null,
      email: x.email ?? null,
      company: x.company_name ?? x.company ?? null,
      language: x.language_pref ?? null,
      addresses: Array.isArray(x.addresses) ? x.addresses : [],
      orders: Number(x.orders) || 0,
      spent: Number(x.spent) || 0,
      last_order: x.last_order ?? x.last_order_at ?? null,
      last_ref: x.last_ref ?? null,
    }));

    // Recherche côté serveur mais en mémoire : la clientèle d'un commerce tient
    // dans une page, et une requête SQL de plus n'apporterait rien.
    if (q) {
      rows = rows.filter((c) =>
        [c.phone, c.name, c.company, c.email].some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }

    return NextResponse.json({
      ready: true,
      customers: rows,
      totals: {
        clients: rows.length,
        orders: rows.reduce((s, c) => s + c.orders, 0),
        spent: rows.reduce((s, c) => s + c.spent, 0),
      },
    });
  } catch (e) {
    // Colonnes de la fiche client absentes : la migration d'intégration n'est
    // pas passée. On le dit, plutôt qu'une liste vide inexplicable.
    if ((e as { code?: string }).code === "42703" || (e as { code?: string }).code === "42P01") {
      return NextResponse.json({
        ready: false,
        customers: [],
        error: "Fiches clients incomplètes — applique migration_site_integration.sql.",
      });
    }
    return NextResponse.json({ ready: false, customers: [], error: (e as Error).message }, { status: 500 });
  }
}
