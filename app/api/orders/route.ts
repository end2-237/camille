// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders  — crée une commande depuis la conversation (appelé par n8n).
//                     Enregistre + renvoie la référence et les textes à envoyer.
//                     Aucun paiement, aucun décrément de stock.
// GET  /api/orders  — liste les commandes du compte (app mobile / dashboard).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { sqlAgentAccessible } from "@/lib/equipe";
import { createOrder } from "@/lib/orders";
import { appelInterne, refusInterne } from "@/lib/interne";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  // Commande créée par le workflow : clé interne obligatoire (elle touche au stock).
  if (!appelInterne(req)) return refusInterne();
  try {
    const b = await req.json();

    let agentId: string | null = b.agentId || null;
    if (!agentId && b.session) {
      const r = await query(
        "SELECT agent_id FROM camille.whatsapp_sessions WHERE session_name = $1",
        [b.session]
      );
      agentId = r.rows[0]?.agent_id ?? null;
    }
    if (!agentId) return NextResponse.json({ ok: false, error: "agent introuvable" });

    // Chemin PARTAGE avec l'API publique : une commande venue du site et une
    // commande venue de WhatsApp doivent etre rigoureusement identiques.
    const created = await createOrder({
      agentId,
      items: Array.isArray(b.items) ? b.items : [],
      session: b.session ?? null,
      phone: b.phone ?? null,
      customerName: b.customerName,
      address: b.customerAddress,
      lat: b.lat,
      lng: b.lng,
      note: b.note,
      deliveryFee: b.deliveryFee,
      source: "whatsapp",
    });

    if (!created.ok) return NextResponse.json({ ok: false, error: created.error });

    return NextResponse.json({
      ok: true,
      ref: created.ref,
      total: created.total,
      currency: created.currency,
      clientText: created.clientText,
      ownerText: created.ownerText,
      ownerChatId: created.ownerChatId,
    });
  } catch (err) {
    console.error("[POST /api/orders]", (err as Error).message);
    return NextResponse.json({ ok: false, error: "erreur serveur" });
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const agentId = sp.get("agentId");
  const status = sp.get("status");
  // Plus de 200 commandes : on pagine par date (« avant »), et l'export
  // CSV prend toute une période d'un coup.
  const csv = sp.get("format") === "csv";
  const avant = sp.get("avant");
  const du = sp.get("du");
  const au = sp.get("au");
  const limite = csv ? 10_000 : Math.min(500, Math.max(1, Number(sp.get("limit")) || 200));

  // Déclarés hors du try : le repli du catch en a besoin.
  const params: any[] = [user.id];
  let sql = "";

  try {
    // Les coordonnées de la boutique servent de point de départ à l'itinéraire.
    sql = `SELECT o.*,
                      a.latitude  AS shop_lat,
                      a.longitude AS shop_lng,
                      a.business_name AS shop_name
                 FROM camille.orders o
                 JOIN camille.agents a ON a.id = o.agent_id
                WHERE ${await sqlAgentAccessible("a", "$1")}`;
    if (agentId) { params.push(agentId); sql += ` AND o.agent_id = $${params.length}`; }
    if (status)  { params.push(status);  sql += ` AND o.status = $${params.length}`; }
    if (avant && !Number.isNaN(Date.parse(avant))) { params.push(avant); sql += ` AND o.created_at < $${params.length}`; }
    if (du && !Number.isNaN(Date.parse(du))) { params.push(du); sql += ` AND o.created_at >= $${params.length}`; }
    if (au && !Number.isNaN(Date.parse(au))) { params.push(au); sql += ` AND o.created_at < ($${params.length}::date + 1)`; }
    sql += ` ORDER BY o.created_at DESC LIMIT ${limite + 1}`;

    const r = await query(sql, params);
    const plus = r.rows.length > limite;
    const rows = r.rows.slice(0, limite);
    if (csv) return enCsv(rows);
    return NextResponse.json({ orders: rows, plus });
  } catch (e) {
    // 42703 = colonne absente : ce sont les coordonnées de la boutique qui
    // manquent, pas les commandes. On réessaie sans elles plutôt que de
    // renvoyer une liste vide et un message trompeur.
    if ((e as { code?: string }).code === "42703") {
      try {
        const r2 = await query(sql.replace(/,\s*a\.latitude[\s\S]*?a\.business_name AS shop_name/, ""), params);
        return NextResponse.json({
          orders: r2.rows,
          warning: "Itinéraire indisponible — applique migration_agent_geo.sql.",
        });
      } catch { /* on tombe dans le message générique ci-dessous */ }
    }
    return NextResponse.json({
      orders: [],
      error: "Table des commandes absente — applique migration_orders.sql",
      detail: (e as Error).message,
    });
  }
}

/** L'export comptable : une ligne par commande, lisible par Excel (séparateur « ; », BOM UTF-8). */
function enCsv(rows: any[]): NextResponse {
  const cell = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const articles = (v: unknown) => {
    const its: any[] = Array.isArray(v) ? v : (() => { try { return JSON.parse(String(v || "[]")); } catch { return []; } })();
    return its.map((i) => `${i.qty || 1}x ${i.name}${i.variant ? ` (${i.variant})` : ""}`).join(" | ");
  };
  const tete = ["Référence", "Date", "Statut", "Client", "Téléphone", "Articles", "Livraison", "Total", "Devise", "Mode", "Adresse", "Paiement annoncé", "Livreur", "Livrée le", "Source"];
  const lignes = rows.map((o) => [
    o.ref, new Date(o.created_at).toISOString().replace("T", " ").slice(0, 16), o.status, o.customer_name,
    String(o.contact_phone || "").replace(/@.*$/, ""), articles(o.items), o.delivery_fee ?? 0, o.total, o.currency,
    o.fulfillment || "", o.address || o.place_label || "", o.payment_method || "", o.courier_name || "",
    o.delivered_at ? new Date(o.delivered_at).toISOString().replace("T", " ").slice(0, 16) : "", o.source || "",
  ].map(cell).join(";"));
  const corps = "\uFEFF" + [tete.join(";"), ...lignes].join("\r\n");
  return new NextResponse(corps, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
