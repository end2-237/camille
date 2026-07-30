// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders  — crée une commande depuis la conversation (appelé par n8n).
//                     Enregistre + renvoie la référence et les textes à envoyer.
//                     Aucun paiement, aucun décrément de stock.
// GET  /api/orders  — liste les commandes du compte (app mobile / dashboard).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { createOrder } from "@/lib/orders";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
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

  const agentId = req.nextUrl.searchParams.get("agentId");
  const status = req.nextUrl.searchParams.get("status");

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
                WHERE a.user_id = $1`;
    if (agentId) { params.push(agentId); sql += ` AND o.agent_id = $${params.length}`; }
    if (status)  { params.push(status);  sql += ` AND o.status = $${params.length}`; }
    sql += " ORDER BY o.created_at DESC LIMIT 200";

    const r = await query(sql, params);
    return NextResponse.json({ orders: r.rows });
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
