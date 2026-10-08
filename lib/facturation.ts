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
import { envoyerDocument, envoyerTexte, transportDe } from "@/lib/whatsapp/envoi";
import { annoncerStatut } from "@/lib/whatsapp/suivi-envoi";

const BUYFACT_URL = (process.env.BUYFACT_URL ?? "https://buyfacturation-jdbf.vercel.app").replace(/\/$/, "");
const BUYFACT_KEY = process.env.BUYFACT_API_KEY ?? "";

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
 * Crée le bon de commande, et l'envoie au client sur WhatsApp si demandé.
 * Ne lève jamais — renvoie toujours un résultat exploitable.
 *
 * @param opts.send  false pour seulement produire le document. Le vendeur qui
 *   veut consulter ou récupérer un bon déjà envoyé ne doit pas le renvoyer au
 *   client à chaque fois : recevoir trois fois le même PDF inquiète plus qu'il
 *   ne rassure.
 */
export async function sendOrderDocument(
  orderId: string,
  opts: { send?: boolean } = {}
): Promise<SendResult> {
  const notifyClient = opts.send !== false;
  let o: Record<string, unknown>;
  try {
    const r = await query(
      `SELECT o.*, a.business_name, a.location, a.whatsapp_number,
              a.owner_email, a.doc_settings
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
  if (!chatId && notifyClient) return { ok: false, reason: "aucun contact pour cette commande" };

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

  // La livraison est facturée au client mais n'apparaissait nulle part sur le
  // document : le total imprimé était donc inférieur à ce qu'on lui demandait
  // de payer, et c'est au moment de payer qu'il le découvrait.
  const fraisLivraison = Number(o.delivery_fee) || 0;
  if (fraisLivraison > 0) {
    docItems.push({ description: "Livraison", quantity: 1, price: fraisLivraison });
  }

  const number = docNumber(String(o.ref));
  const lieu = (o.place_label || o.address || "") as string;

  // Identité imprimée sur le document. Ce que le vendeur a saisi l'emporte ;
  // à défaut on retombe sur ce qu'il a déjà renseigné pour son agent, plutôt
  // que de laisser le document sortir au nom d'une autre entreprise.
  // Mixte : les champs d'identité sont du texte, `zebra` est un booléen.
  const reglages = (() => {
    const d = o.doc_settings;
    if (!d) return {} as Record<string, unknown>;
    if (typeof d === "object") return d as Record<string, unknown>;
    try { return JSON.parse(String(d)) as Record<string, unknown>; } catch { return {}; }
  })();
  const txt = (k: string) => (typeof reglages[k] === "string" ? (reglages[k] as string) : "");

  const vendeur = {
    name:     txt("name")    || (o.business_name as string) || "",
    tagline:  txt("tagline"),
    address:  txt("address") || (o.location as string) || "",
    phone:    txt("phone")   || (o.whatsapp_number as string) || "",
    email:    txt("email")   || (o.owner_email as string) || "",
    // Mentions légales : aucun repli possible. Un RCCM ou un NIU emprunté à
    // quelqu'un d'autre n'est pas un défaut de mise en page, c'est l'identité
    // légale d'une autre entreprise sur un document commercial.
    rccm:     txt("rccm"),
    niu:      txt("niu"),
    logo_url: txt("logo_url"),
    color:    txt("color"),
  };

  // Habillage du document. Les clés absentes retombent sur le modèle
  // « classique » côté buyfacturation ; on n'envoie donc que ce qui est réglé.
  const habillage = {
    template:   txt("template"),
    lines:      txt("lines"),
    zebra:      typeof reglages.zebra === "boolean" ? reglages.zebra : undefined,
    banner_url: txt("banner_url"),
  };

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
        // Emetteur du document. Les clés vides sont écartées, mais la présence
        // de `seller` suffit à écarter toute identité par défaut côté
        // buyfacturation : ce que le vendeur n'a pas rempli reste vide sur le
        // document plutôt que d'emprunter les mentions légales de la plateforme.
        seller: Object.fromEntries(Object.entries(vendeur).filter(([, v]) => v)),
        style: Object.fromEntries(
          Object.entries(habillage).filter(([, v]) => v !== "" && v !== undefined)
        ),
        status: "sent",
      }),
    });
    doc = await res.json().catch(() => ({}));

    // Si buyfacturation ne gère pas encore l'idempotence (branche non déployée),
    // un réessai se heurte à l'index unique sur external_ref. Le document existe
    // pourtant : on le récupère par son numéro plutôt que d'échouer.
    if (!res.ok && /duplicate key|external_ref/i.test(String(doc?.error || ""))) {
      const found = await fetch(
        `${BUYFACT_URL}/api/invoices?search=${encodeURIComponent(number)}&limit=1`,
        { headers: BUYFACT_KEY ? { "X-Api-Key": BUYFACT_KEY } : {} }
      ).then((r) => r.json()).catch(() => null);
      const hit = found?.invoices?.find((x: { number?: string }) => x.number === number);
      if (hit?.id) doc = hit;
    }

    if (!doc?.id) {
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

  // Génération seule : le document existe et son URL est mémorisée, on s'arrête.
  if (!notifyClient) return { ok: true, number: doc.number || number, pdfUrl };

  // Le montant de la livraison manquait aussi dans l'accusé de réception : le
  // client lisait un total, puis on lui en demandait un autre à l'arrivée.
  const montant = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
  const caption =
    `📄 Ton bon de commande n° ${doc.number || number}\n\n` +
    `${vendeur.name || "Nous"} a bien pris ta commande en traitement.\n` +
    (lieu ? `Livraison : ${lieu}\n` : "") +
    (fraisLivraison > 0 ? `Frais de livraison : ${montant(fraisLivraison)}\n` : "") +
    (Number(o.total) > 0 ? `Total à payer : ${montant(Number(o.total))}\n` : "") +
    `\nGarde ce document, il fait référence 🙌`;

  // Le transport (camille-core ou Meta) suit l'agent : cf. lib/whatsapp/envoi.ts.
  const envoi = await envoyerDocument(
    String(o.agent_id),
    chatId,
    { url: pdfUrl, name: `${doc.number || number}.pdf`, mimeType: "application/pdf", caption },
    { session: (o.session_name as string) || null }
  );
  if (!envoi.ok) {
    return { ok: false, reason: envoi.error || "envoi WhatsApp refusé", number, pdfUrl };
  }

  return { ok: true, number: doc.number || number, pdfUrl };
}


/**
 * Remerciement envoyé au client quand la commande est marquée livrée.
 * Idempotent : `thanked_at` empêche un second envoi si le vendeur repasse
 * par ce statut. Ne lève jamais.
 */
export async function sendThankYou(orderId: string): Promise<SendResult> {
  let o: Record<string, unknown>;
  try {
    const r = await query(
      `SELECT o.*, a.business_name
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

  if (o.thanked_at) return { ok: false, reason: "remerciement déjà envoyé" };

  const chatId = String(o.contact_phone || "").trim();
  if (!chatId) return { ok: false, reason: "aucun contact pour cette commande" };

  // Agent Meta : le remerciement porte des boutons (tout va bien / un souci /
  // recommander) et une animation, cf. lib/whatsapp/suivi.ts.
  const { transport } = await transportDe(String(o.agent_id), (o.session_name as string) || null);
  if (transport === "meta") {
    const r = await annoncerStatut(orderId);
    if (!r.ok) return { ok: false, reason: r.error || "envoi refusé" };
    try { await query("UPDATE camille.orders SET thanked_at = NOW() WHERE id = $1", [orderId]); } catch { /* idem */ }
    return { ok: true };
  }

  const prenom = String(o.customer_name || "").trim().split(/\s+/)[0] || "";
  const shop = (o.business_name as string) || "Nous";
  const text =
    `Merci ${prenom} 🙏\n\n` +
    `Ta commande n° ${o.ref} est livrée. ${shop} te remercie pour ta confiance.\n\n` +
    `Si tout s'est bien passé, ça nous ferait vraiment plaisir que tu parles de nous autour de toi 😊\n` +
    `Et au moindre souci, écris-moi ici — on répond toujours.\n\n` +
    `À très vite ! 👋`;

  const envoi = await envoyerTexte(String(o.agent_id), chatId, text, {
    session: (o.session_name as string) || null,
  });
  if (!envoi.ok) return { ok: false, reason: envoi.error || "envoi refusé" };

  // Marque APRES l'envoi : un echec doit pouvoir etre reessaye.
  try {
    await query("UPDATE camille.orders SET thanked_at = NOW() WHERE id = $1", [orderId]);
  } catch { /* colonne absente : le message est parti, c'est l'essentiel */ }

  return { ok: true };
}
