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
  /** Identifiant catalogue, quand la ligne en vient. Sert à décompter le stock. */
  productId?: string;
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
  /** Créneau de livraison demandé (ISO). Absent = dès que possible. */
  scheduledAt?: string | Date | null;
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
  scheduledAt: string | null;
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


/** En dessous de ce seuil, on prévient le commerçant. */
const LOW_STOCK = Number(process.env.LOW_STOCK_THRESHOLD || 5);

type LowLine = { name: string; stock: number };
/** Un client a commandé plus que ce qui restait — vente manquée, en tout ou partie. */
type RuptureLine = { name: string; demande: number; dispo: number };

/**
 * Retire du stock ce que la commande emporte.
 *
 * Le décompte se fait à la création : c'est le moment où la marchandise est
 * réellement engagée. Une ligne sans identifiant catalogue (article saisi
 * librement) est rapprochée par son nom ; si rien ne correspond, on ne touche
 * à rien plutôt que de décompter le mauvais produit.
 *
 * Ne lève jamais : une commande ne doit pas échouer parce que le stock n'a pas
 * pu être mis à jour.
 *
 * @returns les articles passés au seuil bas, et ceux qui manquaient déjà
 */
async function applyStock(
  agentId: string,
  items: NewOrderItem[]
): Promise<{ low: LowLine[]; ruptures: RuptureLine[] }> {
  const low: LowLine[] = [];
  const ruptures: RuptureLine[] = [];

  for (const it of items) {
    const qty = Math.max(1, Number(it.qty) || 1);
    try {
      // GREATEST(0, …) : un stock ne descend pas sous zéro, même si deux
      // commandes se croisent sur le dernier article.
      //
      // Le `FROM camille.products avant` donne l'état d'AVANT la mise à jour.
      // Sans lui, on reconstituait le stock précédent par `stock + qty`, ce que
      // le GREATEST rend faux dès qu'il y a écrêtage : un article déjà à zéro
      // ressortait comme s'il en restait `qty`, et la vente manquée passait
      // totalement inaperçue.
      const r = it.productId
        ? await query(
            `UPDATE camille.products p
                SET stock = GREATEST(0, p.stock - $1), updated_at = NOW()
               FROM camille.products avant
              WHERE avant.id = p.id
                AND p.id = $2 AND p.agent_id = $3 AND p.stock IS NOT NULL
            RETURNING p.name, p.stock, avant.stock AS stock_avant`,
            [qty, it.productId, agentId]
          )
        : await query(
            `UPDATE camille.products p
                SET stock = GREATEST(0, p.stock - $1), updated_at = NOW()
               FROM camille.products avant
              WHERE avant.id = p.id
                AND p.agent_id = $2 AND lower(p.name) = lower($3) AND p.stock IS NOT NULL
            RETURNING p.name, p.stock, avant.stock AS stock_avant`,
            [qty, agentId, String(it.name || "")]
          );

      const row = r.rows[0];
      if (!row) continue;

      const apres = Number(row.stock);
      const avant = Number(row.stock_avant);

      // Le client en a demandé plus qu'il n'y en avait : la commande est
      // enregistrée quand même — refuser une vente sans laisser au vendeur la
      // chance d'arranger le coup serait pire — mais il faut le lui dire.
      if (avant < qty) ruptures.push({ name: row.name, demande: qty, dispo: avant });

      // On ne prévient qu'au FRANCHISSEMENT du seuil : sans cela, chaque
      // commande d'un article déjà bas rejouerait la même alerte.
      if (apres <= LOW_STOCK && avant > LOW_STOCK) {
        low.push({ name: row.name, stock: apres });
      }
    } catch {
      // colonne stock absente, ou produit supprimé : sans conséquence ici.
    }
  }

  return { low, ruptures };
}

/**
 * Remet en rayon ce qu'une commande annulée avait emporté.
 *
 * Sans cela, le stock sortait à la commande et ne revenait jamais : quelques
 * annulations suffisaient à faire disparaître du catalogue des articles
 * pourtant disponibles.
 *
 * L'appelant doit garantir que la commande n'était PAS déjà annulée, sinon la
 * marchandise serait recréditée deux fois.
 */
export async function restoreStock(agentId: string, items: NewOrderItem[]) {
  for (const it of items) {
    const qty = Math.max(1, Number(it.qty) || 1);
    try {
      if (it.productId) {
        await query(
          `UPDATE camille.products SET stock = stock + $1, updated_at = NOW()
            WHERE id = $2 AND agent_id = $3 AND stock IS NOT NULL`,
          [qty, it.productId, agentId]
        );
      } else {
        await query(
          `UPDATE camille.products SET stock = stock + $1, updated_at = NOW()
            WHERE agent_id = $2 AND lower(name) = lower($3) AND stock IS NOT NULL`,
          [qty, agentId, String(it.name || "")]
        );
      }
    } catch { /* produit supprimé depuis : rien à recréditer */ }
  }
}

/**
 * Ce qu'il faut dire à un client qui commande alors que la boutique est fermée.
 *
 * `business_hours` est un champ libre : on n'en tire une plage que si elle y
 * est écrite noir sur blanc. Sans certitude on ne dit rien — annoncer une
 * heure d'ouverture inventée vaut moins que le silence, et se retourne contre
 * le commerçant quand personne ne répond à l'heure promise.
 *
 * @param hours   texte saisi par le commerçant
 * @param offset  décalage horaire du commerce (Cameroun : +1)
 */
export function closedNotice(hours?: string | null, offset = 1): string {
  const t = String(hours || "").toLowerCase().replace(/\s+/g, " ");
  if (/24\s*\/\s*24|non.?stop/.test(t)) return "";

  const m = t.match(/(\d{1,2})\s*h(?:\s*(\d{2}))?\s*(?:[-—–a à ]+)\s*(\d{1,2})\s*h(?:\s*(\d{2}))?/);
  if (!m) return "";

  const open = Number(m[1]) + Number(m[2] || 0) / 60;
  const close = Number(m[3]) + Number(m[4] || 0) / 60;
  if (!(open >= 0 && open <= 24 && close >= 0 && close <= 24) || open === close) return "";

  const now = new Date();
  const h = ((((now.getUTCHours() + offset) % 24) + 24) % 24) + now.getUTCMinutes() / 60;
  const ouvert = open < close ? h >= open && h < close : h >= open || h < close;
  if (ouvert) return "";

  const lbl = (x: number) => {
    const n = Math.floor(x);
    const mn = Math.round((x - n) * 60);
    return `${n}h${mn ? String(mn).padStart(2, "0") : ""}`;
  };
  return `\n\n😴 On est fermé pour le moment. Ta commande est bien enregistrée et sera prise en charge dès l'ouverture, à ${lbl(open)}.`;
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

  // Créneau demandé. Une date illisible ou déjà passée ne vaut pas mieux que
  // pas de créneau du tout : on préfère « dès que possible » à une promesse
  // fausse imprimée sur le bon de commande.
  let scheduledAt: Date | null = null;
  if (input.scheduledAt) {
    const d = new Date(input.scheduledAt as string);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now() - 60_000) scheduledAt = d;
  }

  let orderId: string | null = null;
  try {
    const ins = await query(
      `INSERT INTO camille.orders
         (ref, agent_id, session_name, contact_phone, items, total, currency, note,
          customer_name, address, lat, lng, place_label, delivery_fee, source, scheduled_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [ref, input.agentId, input.session ?? null, input.phone ?? null, JSON.stringify(items),
       total, currency, note || null, customerName || null, address || null, lat, lng,
       placeLabel || null, deliveryFee, source, scheduledAt]
    );
    orderId = ins.rows[0]?.id ?? null;
  } catch (e) {
    // `source` et `scheduled_at` peuvent manquer si migration_api_keys.sql ou
    // migration_site_integration.sql ne sont pas passées : on réessaie sans,
    // plutôt que de perdre la commande. Le créneau est alors répété dans les
    // messages, il n'est jamais perdu pour le commerçant.
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

  // ── Stock ────────────────────────────────────────────────────────────────
  // Une commande enregistrée sort la marchandise : sans ce décompte, le
  // catalogue annonçait indéfiniment des quantités déjà vendues, et l'agent
  // continuait de proposer des articles épuisés.
  const { low: lowStock, ruptures } = await applyStock(input.agentId, items);

  const ag = await query(
    // business_hours sert à ne pas promettre un rappel immédiat la nuit.
    // to_jsonb : utc_offset n'existe pas partout, et son absence ne doit pas
    // faire échouer la lecture de l'agent.
    `SELECT name, business_name, whatsapp_number, location, user_id, business_hours,
            (to_jsonb(a)->>'utc_offset')::numeric AS utc_offset
       FROM camille.agents a WHERE id = $1`,
    [input.agentId]
  );
  const shop = ag.rows[0] ?? {};

  const lignes = items
    .map((i, k) => `${k + 1}. ${i.name}${i.variant ? ` — ${i.variant}` : ""}  ×${i.qty || 1}`)
    .join("\n");

  const fees = deliveryFee > 0
    ? `Sous-total : ${money(subtotal, currency)}\nLivraison : ${money(deliveryFee, currency)}\n`
    : "";

  // Le créneau, écrit en toutes lettres : c'est la première question du client.
  const creneau = scheduledAt
    ? scheduledAt.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

  const clientText =
    `✅ Commande enregistrée — n° ${ref}\n\n${lignes}\n\n` +
    fees +
    `Total : ${money(total, currency)}\n` +
    `Statut : En traitement 🔄\n` +
    (creneau ? `Livraison prévue : ${creneau}\n` : "") +
    (note ? `Mode : ${note}\n` : "") +
    (placeLabel || address ? `Livraison : ${placeLabel || address}\n` : "") +
    // Promettre un contact « tout de suite » à 2h du matin, c'est promettre ce
    // qu'on ne tiendra pas. Quand la boutique est fermée, on le dit.
    (closedNotice(shop.business_hours as string, Number(shop.utc_offset ?? 1))
      ? `\nOn te recontacte dès l'ouverture 📞` + closedNotice(shop.business_hours as string, Number(shop.utc_offset ?? 1))
      : `\nOn te contacte tout de suite pour confirmer 📞`);

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
    (creneau ? `⏰ À livrer : ${creneau}\n` : "") +
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

    // Alerte de stock, séparée de la commande : elle n'appelle pas la même
    // action et ne doit pas se perdre dans la joie d'une vente. Un seul
    // message pour tous les articles concernés — trois alertes d'affilée pour
    // une même commande se lisent comme du bruit.
    if (lowStock.length) {
      const epuises = lowStock.filter((l) => l.stock === 0);
      const detail = lowStock.map((l) => `${l.name} : ${l.stock}`).join(" · ");
      notifyUser(shop.user_id, "alerte", {
        title: epuises.length
          ? `Rupture de stock — ${epuises.map((l) => l.name).join(", ")}`.slice(0, 90)
          : `Stock faible — ${lowStock.length} article${lowStock.length > 1 ? "s" : ""}`,
        body: detail.slice(0, 160),
        data: { type: "stock", agentId: String(input.agentId) },
        channel: "commandes",
      }).catch(() => {});
    }

    // Vente manquée : distincte de l'alerte de stock ci-dessus, qui prévient
    // qu'un article DEVIENT bas. Ici un client a déjà demandé plus que ce qui
    // restait — il attend une marchandise qui n'existe pas, et le vendeur a
    // quelques heures pour le rappeler avant qu'il n'aille voir ailleurs.
    if (ruptures.length) {
      const total = ruptures.filter((r) => r.dispo === 0);
      const detail = ruptures
        .map((r) => `${r.name} : ${r.demande} demandé${r.demande > 1 ? "s" : ""}, ${r.dispo} en stock`)
        .join(" · ");
      notifyUser(shop.user_id, "alerte", {
        title: total.length
          ? `Commandé mais épuisé — ${total.map((r) => r.name).join(", ")}`.slice(0, 90)
          : `Stock insuffisant — ${ruptures.length} article${ruptures.length > 1 ? "s" : ""}`,
        body: `${customerName ? `${customerName} · ` : ""}${detail}`.slice(0, 160),
        data: {
          type: "rupture",
          ref,
          orderId: String(orderId || ""),
          agentId: String(input.agentId),
        },
        channel: "commandes",
      }).catch(() => {});
    }
  }

  // ── Fiche client ─────────────────────────────────────────────────────────
  // Le nom et l'adresse donnés ici ont coûté un effort au client : les jeter
  // l'oblige à les redonner à la commande suivante. Best-effort : sur une base
  // non migrée, la commande reste enregistrée, c'est ce qui compte.
  if (input.phone) {
    query(
      `INSERT INTO camille.contacts (agent_id, phone, display_name, orders_count, last_order_at)
            VALUES ($1, $2, NULLIF($3, ''), 1, NOW())
       ON CONFLICT (agent_id, phone) DO UPDATE
            SET display_name  = COALESCE(camille.contacts.display_name, EXCLUDED.display_name),
                orders_count  = camille.contacts.orders_count + 1,
                last_order_at = NOW(),
                updated_at    = NOW()`,
      [input.agentId, input.phone, customerName]
    ).catch(() => {});
  }

  return {
    ok: true, id: orderId, ref, subtotal, deliveryFee, total, currency,
    clientText, ownerText, ownerChatId,
    scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
  };
}
