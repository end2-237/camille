// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders  — crée une commande depuis la conversation (appelé par n8n).
//                     Enregistre + renvoie la référence et les textes à envoyer.
//                     Aucun paiement, aucun décrément de stock.
// GET  /api/orders  — liste les commandes du compte (app mobile / dashboard).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeRef() {
  // Référence courte, lisible au téléphone (sans I/O/0/1 pour éviter les confusions)
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function money(n: number, cur: string) {
  return `${Number(n || 0).toLocaleString("fr-FR")} ${cur || "XAF"}`;
}

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

    const items: any[] = Array.isArray(b.items) ? b.items : [];
    if (!items.length) return NextResponse.json({ ok: false, error: "panier vide" });

    const currency = items.find((i) => i.currency)?.currency || "XAF";
    const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);

    // Référence unique (quelques tentatives en cas de collision improbable)
    let ref = makeRef();
    for (let k = 0; k < 5; k++) {
      const exists = await query("SELECT 1 FROM camille.orders WHERE ref = $1", [ref]);
      if (!exists.rows.length) break;
      ref = makeRef();
    }

    // Note libre : en restauration, le mode de service (sur place / à emporter / livraison)
    const note = String(b.note ?? "").slice(0, 120);

    await query(
      `INSERT INTO camille.orders (ref, agent_id, session_name, contact_phone, items, total, currency, note)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
      [ref, agentId, b.session ?? null, b.phone ?? null, JSON.stringify(items), total, currency, note || null]
    );

    // Coordonnées de la boutique (pour le message au commerçant)
    const ag = await query(
      "SELECT name, business_name, whatsapp_number, location FROM camille.agents WHERE id = $1",
      [agentId]
    );
    const shop = ag.rows[0] ?? {};

    const lignes = items
      .map((i, k) => `${k + 1}. ${i.name}${i.variant ? ` — ${i.variant}` : ""}  ×${i.qty || 1}`)
      .join("\n");

    // Message destiné au CLIENT (accusé de réception)
    const clientText =
      `✅ Commande enregistrée — n° ${ref}\n\n${lignes}\n\n` +
      `Total : ${money(total, currency)}\n` +
      (note ? `Service : ${note}\n` : "") +
      `\n` +
      `On te contacte tout de suite pour confirmer la livraison${shop.location ? ` (${shop.location})` : ""} 📞`;

    // Message destiné au COMMERÇANT
    const ownerText =
      `🛎️ NOUVELLE COMMANDE — n° ${ref}\n\n${lignes}\n\n` +
      `Total : ${money(total, currency)}\n` +
      (note ? `Service : ${note}\n` : "") +
      `Client : ${String(b.phone || "").replace(/@c\.us$/, "")}\n\n` +
      `Réponds à ce client pour confirmer.`;

    // Numéro du commerçant au format WhatsApp (si renseigné)
    const raw = String(shop.whatsapp_number || "").replace(/[^0-9]/g, "");
    const ownerChatId = raw ? `${raw}@c.us` : null;

    return NextResponse.json({ ok: true, ref, total, currency, clientText, ownerText, ownerChatId });
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

  try {
    const params: any[] = [user.id];
    let sql = `SELECT o.* FROM camille.orders o
               JOIN camille.agents a ON a.id = o.agent_id
               WHERE a.user_id = $1`;
    if (agentId) { params.push(agentId); sql += ` AND o.agent_id = $${params.length}`; }
    if (status)  { params.push(status);  sql += ` AND o.status = $${params.length}`; }
    sql += " ORDER BY o.created_at DESC LIMIT 200";

    const r = await query(sql, params);
    return NextResponse.json({ orders: r.rows });
  } catch (e) {
    return NextResponse.json({
      orders: [],
      error: "Table des commandes absente — applique migration_orders.sql",
      detail: (e as Error).message,
    });
  }
}
