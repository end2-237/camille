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

// Géocodage inverse via Nominatim (OpenStreetMap) : public, sans clé d'API.
// Best-effort — une commande ne doit jamais échouer parce que le service est lent.
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&zoom=18&accept-language=fr`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: { "User-Agent": "Camille/1.0 (contact: support@camille.local)" },
    });
    clearTimeout(t);
    if (!r.ok) return "";
    const j = await r.json();
    return String(j?.display_name || "").slice(0, 200);
  } catch {
    return "";
  }
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

    // Coordonnées de livraison
    const customerName = String(b.customerName ?? "").slice(0, 60);
    const address = String(b.customerAddress ?? "").slice(0, 200);
    // Attention : Number(null) === 0 et 0 est "finite". Sans ce filtre, une position
    // absente était enregistrée comme 0,0 (au large du golfe de Guinée).
    const coord = (v: unknown, max: number): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n === 0 || Math.abs(n) > max) return null;
      return n;
    };
    const lat = coord(b.lat, 90);
    const lng = coord(b.lng, 180);
    const placeLabel = lat != null && lng != null ? await reverseGeocode(lat, lng) : "";

    await query(
      `INSERT INTO camille.orders
         (ref, agent_id, session_name, contact_phone, items, total, currency, note,
          customer_name, address, lat, lng, place_label)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [ref, agentId, b.session ?? null, b.phone ?? null, JSON.stringify(items), total, currency,
       note || null, customerName || null, address || null, lat, lng, placeLabel || null]
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
      (placeLabel || address ? `Livraison : ${placeLabel || address}\n` : "") +
      `\nOn te contacte tout de suite pour confirmer 📞`;

    // Où livrer : la position partagée prime, sinon l'adresse tapée
    const lieu =
      lat != null && lng != null
        ? `📍 ${placeLabel || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}\n` +
          `🗺️ https://www.google.com/maps?q=${lat},${lng}\n`
        : address
        ? `📍 ${address}\n`
        : "";

    // Message destiné au COMMERÇANT
    const ownerText =
      `🛎️ NOUVELLE COMMANDE — n° ${ref}\n\n${lignes}\n\n` +
      `Total : ${money(total, currency)}\n` +
      (note ? `Service : ${note}\n` : "") +
      (customerName ? `Client : ${customerName}\n` : "") +
      `Tél : ${String(b.phone || "").replace(/@c\.us$/, "")}\n` +
      lieu +
      `\nRéponds à ce client pour confirmer.`;

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
