// ─────────────────────────────────────────────────────────────────────────────
// Création d'une commande — chemin UNIQUE.
//
// Deux entrées y mènent : la conversation WhatsApp (via n8n) et le site du
// marchand (via l'API publique). Elles doivent produire exactement la même
// chose : même référence, mêmes messages, même notification, même suivi.
// D'où cette fonction partagée plutôt qu'un second chemin qui divergerait.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type NewOrderItem = {
  name?: string;
  variant?: string;
  qty?: number;
  price?: number;
  currency?: string;
  image?: string;
};

export type NewOrder = {
  agentId: string;
  items: NewOrderItem[];
  /** Session WhatsApp d'origine (null pour une commande venue d'un site). */
  session?: string | null;
  /** Numéro du client, sans suffixe @c.us. */
  phone?: string | null;
  customerName?: string;
  address?: string;
  lat?: unknown;
  lng?: unknown;
  note?: string;
  deliveryFee?: number;
  /** "whatsapp" | "site" — d'où vient la commande. */
  source?: string;
};

export type CreatedOrder = {
  ok: true;
  id: string | null;
  ref: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  clientText: string;
  ownerText: string;
  ownerChatId: string | null;
};

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

// Number(null) === 0 et 0 est "finite". Sans ce filtre, une position absente
// serait enregistrée comme 0,0 (au large du golfe de Guinée).
function coord(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > max) return null;
  return n;
}

export async function createOrder(input: NewOrder): Promise<CreatedOrder | { ok: false; error: string }> {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) return { ok: false, error: "panier vide" };

  const currency = items.find((i) => i.currency)?.currency || "XAF";
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
  // Les frais sont figés sur la commande : changer le barème plus tard ne
  // doit pas réécrire l'historique.
  const deliveryFee = Math.max(0, Number(input.deliveryFee) || 0);
  const total = subtotal + deliveryFee;

  // Référence unique (quelques tentatives en cas de collision improbable)
  let ref = makeRef();
  for (let k = 0; k < 5; k++) {
    const exists = await query("SELECT 1 FROM camille.orders WHERE ref = $1", [ref]);
    if (!exists.rows.length) break;
    ref = makeRef();
  }

  const note = String(input.note ?? "").slice(0, 120);
  const customerName = String(input.customerName ?? "").slice(0, 60);
  const address = String(input.address ?? "").slice(0, 200);
  const lat = coord(input.lat, 90);
  const lng = coord(input.lng, 180);
  const placeLabel = lat != null && lng != null ? await reverseGeocode(lat, lng) : "";
  const source = input.source === "site" ? "site" : "whatsapp";

  let orderId: string | null = null;
  try {
    const ins = await query(
      `INSERT INTO camille.orders
         (ref, agent_id, session_name, contact_phone, items, total, currency, note,
          customer_name, address, lat, lng, place_label, delivery_fee, source)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [ref, input.agentId, input.session ?? null, input.phone ?? null, JSON.stringify(items),
       total, currency, note || null, customerName || null, address || null, lat, lng,
       placeLabel || null, deliveryFee, source]
    );
    orderId = ins.rows[0]?.id ?? null;
  } catch (e) {
    // `source` peut manquer si migration_api_keys.sql n'est pas passée :
    // on réessaie sans, plutôt que de perdre la commande.
    if ((e as { code?: string }).code === "42703") {
      const ins = await query(
        `INSERT INTO camille.orders
           (ref, agent_id, session_name, contact_phone, items, total, currency, note,
            customer_name, address, lat, lng, place_label, delivery_fee)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [ref, input.agentId, input.session ?? null, input.phone ?? null, JSON.stringify(items),
         total, currency, note || null, customerName || null, address || null, lat, lng,
         placeLabel || null, deliveryFee]
      );
      orderId = ins.rows[0]?.id ?? null;
    } else {
      return { ok: false, error: (e as Error).message };
    }
  }

  const ag = await query(
    "SELECT name, business_name, whatsapp_number, location, user_id FROM camille.agents WHERE id = $1",
    [input.agentId]
  );
  const shop = ag.rows[0] ?? {};

  const lignes = items
    .map((i, k) => `${k + 1}. ${i.name}${i.variant ? ` — ${i.variant}` : ""}  ×${i.qty || 1}`)
    .join("\n");

  const fees = deliveryFee > 0
    ? `Sous-total : ${money(subtotal, currency)}\nLivraison : ${money(deliveryFee, currency)}\n`
    : "";

  const clientText =
    `✅ Commande enregistrée — n° ${ref}\n\n${lignes}\n\n` +
    fees +
    `Total : ${money(total, currency)}\n` +
    `Statut : En traitement 🔄\n` +
    (note ? `Mode : ${note}\n` : "") +
    (placeLabel || address ? `Livraison : ${placeLabel || address}\n` : "") +
    `\nOn te contacte tout de suite pour confirmer 📞`;

  const lieu =
    lat != null && lng != null
      ? `📍 ${placeLabel || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}\n` +
        `🗺️ https://www.google.com/maps?q=${lat},${lng}\n`
      : address
      ? `📍 ${address}\n`
      : "";

  const ownerText =
    `🛎️ NOUVELLE COMMANDE — n° ${ref}` +
    (source === "site" ? " (site web)" : "") +
    `\n\n${lignes}\n\n` +
    fees +
    `Total : ${money(total, currency)}\n` +
    (note ? `Service : ${note}\n` : "") +
    (customerName ? `Client : ${customerName}\n` : "") +
    `Tél : ${String(input.phone || "").replace(/@c\.us$/, "")}\n` +
    lieu +
    `\nRéponds à ce client pour confirmer.`;

  const raw = String(shop.whatsapp_number || "").replace(/[^0-9]/g, "");
  const ownerChatId = raw ? `${raw}@c.us` : null;

  // Notification au commerçant. Après la création : une panne de push ne doit
  // jamais faire échouer l'enregistrement d'une commande.
  if (shop.user_id) {
    const quoi = items.map((i) => `${i.qty || 1}× ${i.name}`).join(", ");
    notifyUser(shop.user_id, "commande", {
      title: `Nouvelle commande — ${money(total, currency)}`,
      body: `${customerName ? `${customerName} · ` : ""}${quoi}`.slice(0, 160),
      data: { type: "order", ref, orderId: String(orderId || ""), agentId: String(input.agentId), source },
      channel: "commandes",
    }).catch(() => {});
  }

  return { ok: true, id: orderId, ref, subtotal, deliveryFee, total, currency, clientText, ownerText, ownerChatId };
}
