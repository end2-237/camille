// ─────────────────────────────────────────────────────────────────────────────
// Bon de commande PDF via l'API buyfacturation, envoyé au client sur WhatsApp.
//
// Enchaînement : création du document → URL du PDF → envoi via camille-core.
// Tout est best-effort : une commande passe en traitement même si la génération
// du PDF échoue. Le vendeur ne doit jamais être bloqué par un service tiers.
//
// Configuration :
//   BUYFACT_URL       (défaut https://buyfacturation.vercel.app)
//   BUYFACT_API_KEY   optionnelle, doit correspondre à celle de buyfacturation
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";

const BUYFACT_URL = (process.env.BUYFACT_URL ?? "https://buyfacturation.vercel.app").replace(/\/$/, "");
const BUYFACT_KEY = process.env.BUYFACT_API_KEY ?? "";
const CORE_URL = (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");
const CORE_KEY = process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

type OrderItem = { name?: string; variant?: string; qty?: number; price?: number };

export type SendResult = {
  ok: boolean;
  reason?: string;
  number?: string;
  pdfUrl?: string;
};

/** Numéro lisible au téléphone : BC-<ref de commande>. */
function docNumber(ref: string) {
  return `BC-${String(ref || "").toUpperCase()}`;
}

/**
 * Crée le bon de commande et l'envoie au client sur WhatsApp.
 * Ne lève jamais — renvoie toujours un résultat exploitable.
 */
export async function sendOrderDocument(orderId: string): Promise<SendResult> {
  let o: Record<string, unknown>;
  try {
    const r = await query(
      `SELECT o.*, a.business_name, a.location, a.whatsapp_number
         FROM camille.orders o
         JOIN camille.agents a ON a.id = o.agent_id
        WHERE o.id = $1`,
      [orderId]
    );
    if (!r.rows.length) return { ok: false, reason: "commande introuvable" };
    o = r.rows[0];
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }

  // contact_phone est le vrai numero du client (camille-core resout les LID).
  // toJid() cote core y ajoute @s.whatsapp.net s'il n'y a pas de domaine.
  const chatId = String(o.contact_phone || "").trim();
  if (!chatId) return { ok: false, reason: "aucun contact pour cette commande" };

  const items: OrderItem[] = Array.isArray(o.items)
    ? (o.items as OrderItem[])
    : (() => { try { return JSON.parse(String(o.items || "[]")); } catch { return []; } })();

  if (!items.length) return { ok: false, reason: "commande sans article" };

  // buyfacturation attend {description, quantity, price} — Camille stocke
  // {name, variant, qty, price}. La variante rejoint la désignation.
  const docItems = items.map((it) => ({
    description: `${it.name ?? "Produit"}${it.variant ? ` — ${it.variant}` : ""}`,
    quantity: Number(it.qty) || 1,
    price: Number(it.price) || 0,
  }));

  const number = docNumber(String(o.ref));
  const lieu = (o.place_label || o.address || "") as string;

  let doc: { id?: string; number?: string; error?: string };
  try {
    const res = await fetch(`${BUYFACT_URL}/api/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(BUYFACT_KEY ? { "X-Api-Key": BUYFACT_KEY } : {}),
      },
      body: JSON.stringify({
        type: "bon_commande",
        number,
        // Sert d'idempotence côté buyfacturation : un second appel renvoie
        // le document déjà créé au lieu d'un doublon.
        external_ref: `camille:order:${orderId}`,
        date: new Date().toISOString().slice(0, 10),
        client_name: (o.customer_name as string) || "Client",
        client_phone: String(o.contact_phone || "").replace(/@(c\.us|lid|s\.whatsapp\.net)$/, ""),
        client_address: lieu || null,
        items: docItems,
        status: "sent",
      }),
    });
    doc = await res.json().catch(() => ({}));
    if (!res.ok || !doc?.id) {
      return { ok: false, reason: doc?.error || `buyfacturation a répondu ${res.status}` };
    }
  } catch (e) {
    return { ok: false, reason: `buyfacturation injoignable : ${(e as Error).message}` };
  }

  const pdfUrl = `${BUYFACT_URL}/api/invoices/${doc.id}/download`;

  // Mémorise le document sur la commande — évite de le régénérer et permet de
  // le renvoyer plus tard depuis le dashboard.
  try {
    await query(
      "UPDATE camille.orders SET doc_number = $1, doc_url = $2, updated_at = NOW() WHERE id = $3",
      [doc.number || number, pdfUrl, orderId]
    );
  } catch { /* colonnes absentes : la migration n'est pas passée, on continue */ }

  const caption =
    `📄 Ton bon de commande n° ${doc.number || number}\n\n` +
    `${o.business_name || "Nous"} a bien pris ta commande en traitement.\n` +
    (lieu ? `Livraison : ${lieu}\n` : "") +
    `\nGarde ce document, il fait référence 🙌`;

  try {
    const res = await fetch(`${CORE_URL}/api/sendFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": CORE_KEY },
      body: JSON.stringify({
        chatId,
        session: o.session_name || "default",
        file: {
          url: pdfUrl,
          name: `${doc.number || number}.pdf`,
          mimeType: "application/pdf",
        },
        caption,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.success === false) {
      return { ok: false, reason: j?.error || `envoi WhatsApp refusé (${res.status})`, number, pdfUrl };
    }
    if (j?.skipped) return { ok: false, reason: "envoi ignoré par camille-core", number, pdfUrl };
  } catch (e) {
    return { ok: false, reason: `camille-core injoignable : ${(e as Error).message}`, number, pdfUrl };
  }

  return { ok: true, number: doc.number || number, pdfUrl };
}
