// ─────────────────────────────────────────────────────────────────────────────
// POST /api/public/v1/orders
//
// Le site du marchand envoie une commande à Camille. Elle suit ensuite le même
// chemin qu'une commande WhatsApp : accusé de réception au client, alerte au
// commerçant, apparition dans l'app, bon de commande PDF au passage en
// traitement. Aucun traitement à part.
//
//   curl -X POST https://camille.vps.buyticle.com/api/public/v1/orders \
//     -H "X-Camille-Key: cam_sk_xxxxx" -H "Content-Type: application/json" \
//     -d '{"items":[{"name":"Burger","qty":2,"price":1000}],
//          "customer":{"name":"Eman","phone":"237699887766","company":"Enko"},
//          "delivery":{"address":"Bonaberi"},
//          "scheduled_at":"2026-09-07T11:20:00Z"}'
//
// scheduled_at : créneau demandé. Omis = dès que possible.
//
// Clé SECRÈTE obligatoire : appel serveur à serveur uniquement.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { authenticate, json, preflight } from "@/lib/publicApi";
import { createOrder, type NewOrderItem } from "@/lib/orders";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CORE_URL = (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");
const CORE_KEY = process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req, "secret");
  if ("error" in auth) return auth.error;

  const b = await req.json().catch(() => ({} as any));

  const rawItems: any[] = Array.isArray(b.items) ? b.items : [];
  if (!rawItems.length) return json({ error: "items requis" }, 400, req);

  // Le site peut envoyer soit des identifiants produit, soit des lignes
  // libres. Avec un id, on relit le PRIX EN BASE : un prix venu du client
  // n'est jamais digne de confiance.
  const items: NewOrderItem[] = [];
  for (const it of rawItems.slice(0, 50)) {
    const qty = Math.max(1, Math.min(999, Number(it.qty ?? it.quantity) || 1));

    if (it.id) {
      const r = await query(
        "SELECT name, price, currency, image_url, stock FROM camille.products WHERE id = $1 AND agent_id = $2",
        [it.id, auth.key.agent_id]
      ).catch(() => ({ rows: [] as any[] }));
      const p = r.rows[0];
      if (!p) return json({ error: `Produit introuvable dans ce catalogue : ${it.id}` }, 400, req);

      // Le stock était décompté mais jamais vérifié : on continuait de vendre
      // des articles épuisés, et le commerçant découvrait la commande sans
      // avoir la marchandise. Un stock à null signifie « non suivi » et reste
      // vendable ; zéro signifie épuisé.
      if (p.stock != null && Number(p.stock) <= 0) {
        return json({ error: `${p.name} est épuisé.`, product: p.name, available: 0 }, 409, req);
      }
      if (p.stock != null && Number(p.stock) < qty) {
        return json(
          { error: `Il ne reste que ${p.stock} × ${p.name}.`, product: p.name, available: Number(p.stock) },
          409, req
        );
      }
      items.push({
        // L'identifiant permet de décompter le bon produit, même si deux
        // articles portent un nom voisin.
        productId: String(it.id),
        name: p.name,
        variant: String(it.variant || ""),
        qty,
        price: Number(p.price) || 0,
        currency: p.currency || "XAF",
        image: p.image_url || "",
      });
    } else {
      if (!it.name) return json({ error: "Chaque ligne exige un id produit ou un name." }, 400, req);
      items.push({
        name: String(it.name).slice(0, 120),
        variant: String(it.variant || ""),
        qty,
        price: Math.max(0, Number(it.price) || 0),
        currency: String(it.currency || "XAF"),
        image: String(it.image || ""),
      });
    }
  }

  const customer = b.customer || {};
  const delivery = b.delivery || {};
  const phone = String(customer.phone || "").replace(/[^0-9]/g, "");
  if (!phone) return json({ error: "customer.phone requis (le client doit être joignable)" }, 400, req);

  // Frais : ceux fournis par le site, sinon le barème de l'agent.
  let deliveryFee = Number(b.delivery_fee ?? delivery.fee);
  if (!Number.isFinite(deliveryFee)) {
    const a = await query(
      "SELECT delivery_enabled, delivery_fee, delivery_zones FROM camille.agents WHERE id = $1",
      [auth.key.agent_id]
    ).catch(() => ({ rows: [] as any[] }));
    const ag = a.rows[0] || {};
    deliveryFee = ag.delivery_enabled === false ? 0 : Number(ag.delivery_fee ?? 0) || 0;

    const addr = String(delivery.address || "").toLowerCase();
    let zones: any[] = [];
    try { zones = Array.isArray(ag.delivery_zones) ? ag.delivery_zones : JSON.parse(ag.delivery_zones || "[]"); } catch { zones = []; }
    const hit = zones.find((z) => {
      const n = String(z?.zone ?? z?.name ?? "").toLowerCase();
      return n && addr.includes(n);
    });
    if (hit) deliveryFee = Number(hit.fee ?? hit.price) || deliveryFee;
  }

  const created = await createOrder({
    agentId: auth.key.agent_id,
    items,
    phone,
    customerName: String(customer.name || ""),
    address: String(delivery.address || ""),
    lat: delivery.lat,
    lng: delivery.lng,
    note: String(b.note || ""),
    deliveryFee,
    source: "site",
    scheduledAt: b.scheduled_at ?? delivery.scheduled_at ?? null,
  });

  if (!created.ok) return json({ error: created.error }, 500, req);

  // Le site connaît souvent l'e-mail, l'entreprise et l'adresse complète —
  // choses que la conversation WhatsApp ne donne jamais. On les garde sur la
  // fiche client pour que la commande suivante parte d'un formulaire déjà
  // rempli. Best-effort : la commande est déjà enregistrée.
  if (customer.email || customer.company || delivery.address) {
    query(
      `INSERT INTO camille.contacts (agent_id, phone, display_name, email, company, addresses)
            VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), $6::jsonb)
       ON CONFLICT (agent_id, phone) DO UPDATE
            SET display_name = COALESCE(camille.contacts.display_name, EXCLUDED.display_name),
                email        = COALESCE(EXCLUDED.email,   camille.contacts.email),
                company      = COALESCE(EXCLUDED.company, camille.contacts.company),
                addresses    = CASE
                                 WHEN jsonb_array_length(EXCLUDED.addresses) = 0 THEN camille.contacts.addresses
                                 WHEN camille.contacts.addresses @> EXCLUDED.addresses THEN camille.contacts.addresses
                                 ELSE camille.contacts.addresses || EXCLUDED.addresses
                               END,
                updated_at   = NOW()`,
      [
        auth.key.agent_id, phone,
        String(customer.name || ""), String(customer.email || ""), String(customer.company || ""),
        JSON.stringify(delivery.address
          ? [{ label: String(delivery.label || "Livraison").slice(0, 40),
               address: String(delivery.address).slice(0, 200),
               details: String(delivery.details || "").slice(0, 120),
               lat: Number.isFinite(Number(delivery.lat)) ? Number(delivery.lat) : null,
               lng: Number.isFinite(Number(delivery.lng)) ? Number(delivery.lng) : null }]
          : []),
      ]
    ).catch(() => {});
  }

  // Accusé de réception au client sur WhatsApp, exactement comme pour une
  // commande née dans la conversation. Best-effort : la commande existe déjà.
  let notified = false;
  try {
    const session = await query(
      "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1 LIMIT 1",
      [auth.key.agent_id]
    );
    const sess = session.rows[0]?.session_name;
    if (sess) {
      const send = (chatId: string, text: string) =>
        fetch(`${CORE_URL}/api/sendText`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": CORE_KEY },
          body: JSON.stringify({ chatId, session: sess, text }),
        });
      const r1 = await send(phone, created.clientText);
      notified = r1.ok;
      if (created.ownerChatId) await send(created.ownerChatId, created.ownerText).catch(() => {});
    }
  } catch { /* la commande est enregistrée, c'est l'essentiel */ }

  return json({
    ok: true,
    order: {
      id: created.id,
      ref: created.ref,
      subtotal: created.subtotal,
      delivery_fee: created.deliveryFee,
      total: created.total,
      currency: created.currency,
      status: "nouvelle",
      scheduled_at: created.scheduledAt,
    },
    whatsapp_notified: notified,
  }, 201, req);
}
