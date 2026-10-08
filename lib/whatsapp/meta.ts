// ─────────────────────────────────────────────────────────────────────────────
// Pilote WhatsApp Cloud API (Meta).
//
// C'est le troisième transport de Camille, après WAHA puis camille-core. Les
// deux premiers ont été échangés sans que le reste de l'application s'en
// aperçoive, parce que `lib/waha.ts` gardait ses noms d'exports. On tient la
// même discipline ici : ce fichier est NEUF, il ne modifie rien, et rien ne
// l'appelle tant qu'un agent n'est pas explicitement marqué `transport='meta'`.
//
// Aucun client existant ne passe par ce code.
//
// Les identifiants viennent de l'environnement — jamais du dépôt :
//   WHATSAPP_TOKEN · PHONE_NUMBER_ID · CATALOG_ID · GRAPH_VERSION
//   WHATSAPP_VERIFY_TOKEN · WHATSAPP_APP_SECRET
// ─────────────────────────────────────────────────────────────────────────────

import { articlesPour, imagesSupplementaires, type AxeVariante } from "./variantes";

const GRAPH = (process.env.GRAPH_VERSION || "v26.0").replace(/^\/?/, "");
const TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_ID = process.env.PHONE_NUMBER_ID || "";
const CATALOG_ID = process.env.CATALOG_ID || "";

export type MetaResult = { ok: boolean; id?: string; error?: string; status?: number };

/** Le numéro tel que Meta le veut : chiffres seuls, sans +, sans suffixe. */
export function normalizePhone(raw: string): string {
  return String(raw || "").replace(/[^0-9]/g, "");
}

/**
 * Un appel à l'API Graph.
 *
 * Ne lève jamais : un envoi qui échoue ne doit pas emporter le traitement du
 * message. L'erreur remonte telle que Meta l'a écrite — c'est elle qui permet
 * de corriger, pas un « échec » générique. La leçon vient de FCM, où l'on
 * désactivait des jetons valides faute de lire le corps de la réponse.
 */
async function post(path: string, body: unknown): Promise<MetaResult> {
  if (!TOKEN || !PHONE_ID) {
    return { ok: false, error: "WHATSAPP_TOKEN ou PHONE_NUMBER_ID absent de l'environnement" };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let json: Record<string, unknown> = {};
    try { json = txt ? JSON.parse(txt) : {}; } catch { /* Meta a renvoyé autre chose que du JSON */ }

    if (!res.ok) {
      const err = (json.error || {}) as {
        message?: string; code?: number; error_subcode?: number;
        error_user_msg?: string; error_data?: { details?: string };
      };
      // `error_data.details` est INDISPENSABLE : c'est le seul endroit où Meta
      // nomme ce qui cloche — « product not found for product_retailer_id,
      // m4castvg8j ». Le `message` seul se contente de « Parameter value is not
      // valid », sur quoi aucun repli ne peut raisonner. On l'avait omis, et
      // sendCarouselRobuste ne pouvait donc jamais identifier la fiche fautive.
      const bouts = [
        err.message,
        err.code != null ? `(code ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ""})` : "",
        err.error_data?.details,
        err.error_user_msg,
      ].filter(Boolean);
      return {
        ok: false,
        status: res.status,
        error: bouts.length ? bouts.join(" — ") : txt.slice(0, 300),
      };
    }
    const msgs = json.messages as { id?: string }[] | undefined;
    return { ok: true, id: msgs?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const send = (to: string, payload: Record<string, unknown>) =>
  post(`${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(to),
    ...payload,
  });

// ── Messages simples ────────────────────────────────────────────────────────

export function sendText(to: string, text: string, previewUrl = true): Promise<MetaResult> {
  // Meta coupe à 4096 caractères ; on tronque proprement plutôt que de laisser
  // l'API refuser tout le message.
  const body = String(text || "").slice(0, 4096);
  return send(to, { type: "text", text: { body, preview_url: previewUrl } });
}

export function sendImage(to: string, url: string, caption?: string): Promise<MetaResult> {
  return send(to, {
    type: "image",
    image: { link: url, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
}

/**
 * Un document (bon de commande, facture…), par URL publique.
 *
 * Même règle que la vidéo : Meta télécharge lui-même le fichier, il doit donc
 * être joignable sans authentification. Le nom de fichier est celui que le
 * client verra dans la conversation.
 */
export function sendDocument(to: string, url: string, filename: string, caption?: string): Promise<MetaResult> {
  return send(to, {
    type: "document",
    document: {
      link: url,
      filename: String(filename || "document.pdf").slice(0, 240),
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
    },
  });
}

/**
 * Une vidéo, par URL publique.
 *
 * Meta la télécharge lui-même : l'URL doit être joignable sans
 * authentification, en `video/mp4` ou `video/3gp`, et sous 16 Mo. Un lien de
 * partage Drive ou Dropbox ne marche pas — il renvoie une page HTML, pas la
 * vidéo. C'est l'erreur la plus courante ici, alors on la nomme.
 */
export function sendVideo(to: string, url: string, caption?: string): Promise<MetaResult> {
  return send(to, {
    type: "video",
    video: { link: url, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
}

// ── Téléverser une fois, envoyer mille fois ─────────────────────────────────
//
// Envoyer une vidéo par `link` oblige Meta à la TÉLÉCHARGER à chaque envoi.
// Pour un fichier de 12 Mo, ça prend plusieurs secondes — et pendant ce
// temps-là les messages suivants partent et ARRIVENT AVANT ELLE. Observé sur
// le numéro Buyticle : le client a reçu le carrousel, puis la vidéo du mode
// d'emploi, dans cet ordre. L'explication arrivait après la démonstration.
//
// Téléversée une fois, la vidéo a un identifiant, et l'envoi devient
// instantané. Les identifiants Meta vivent 30 jours : on les garde 20, de quoi
// servir des milliers de clients avec un seul téléchargement.

const MEDIAS = new Map<string, { id: string; expire: number }>();
const MEDIA_TTL = 20 * 24 * 3600 * 1000;

/** L'identifiant Meta de ce média, téléversé au besoin. `null` si impossible. */
export async function mediaId(url: string, type = "video/mp4"): Promise<string | null> {
  const garde = MEDIAS.get(url);
  if (garde && garde.expire > Date.now()) return garde.id;
  if (!TOKEN || !PHONE_ID) return null;

  try {
    const src = await fetch(url);
    if (!src.ok) {
      console.error(`[meta] média injoignable (${src.status}) : ${url}`);
      return null;
    }
    const octets = await src.arrayBuffer();
    // Meta refuse au-delà de 16 Mo : autant le dire ici plutôt que de laisser
    // l'API répondre une erreur générique.
    if (octets.byteLength > 16 * 1024 * 1024) {
      console.error(`[meta] média trop lourd (${Math.round(octets.byteLength / 1048576)} Mo, max 16) : ${url}`);
      return null;
    }

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", type);
    form.append("file", new Blob([octets], { type }), url.split("/").pop() || "media.mp4");

    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${PHONE_ID}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: form,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.id) {
      console.error("[meta] téléversement refusé :", JSON.stringify(j).slice(0, 300));
      return null;
    }
    MEDIAS.set(url, { id: String(j.id), expire: Date.now() + MEDIA_TTL });
    console.log(`[meta] vidéo téléversée une fois (${Math.round(octets.byteLength / 1048576)} Mo) → id ${j.id}`);
    return String(j.id);
  } catch (e) {
    console.error("[meta] téléversement impossible :", (e as Error).message);
    return null;
  }
}

/**
 * Récupère un média REÇU (vocal, image…) à partir de son identifiant.
 *
 * Deux temps chez Meta : l'identifiant donne une adresse temporaire (valable
 * cinq minutes), puis cette adresse donne les octets — avec le jeton, sans quoi
 * Meta renvoie une page HTML et non le fichier. `null` si quoi que ce soit
 * échoue : l'appelant dit alors poliment qu'il n'a pas pu écouter.
 */
export async function telechargerMedia(
  id: string,
  maxOctets = 16 * 1024 * 1024
): Promise<{ octets: ArrayBuffer; mime: string } | null> {
  if (!TOKEN || !id) return null;
  try {
    const info = await fetch(`https://graph.facebook.com/${GRAPH}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const j = (await info.json().catch(() => ({}))) as { url?: string; mime_type?: string; file_size?: number };
    if (!info.ok || !j.url) {
      console.error("[meta] média reçu introuvable :", info.status, JSON.stringify(j).slice(0, 200));
      return null;
    }
    if (j.file_size && j.file_size > maxOctets) {
      console.warn(`[meta] média reçu trop lourd (${Math.round(j.file_size / 1048576)} Mo) — ignoré`);
      return null;
    }
    const fichier = await fetch(j.url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!fichier.ok) {
      console.error("[meta] téléchargement du média refusé :", fichier.status);
      return null;
    }
    const octets = await fichier.arrayBuffer();
    if (octets.byteLength > maxOctets) return null;
    return { octets, mime: j.mime_type || fichier.headers.get("content-type") || "audio/ogg" };
  } catch (e) {
    console.error("[meta] téléchargement du média impossible :", (e as Error).message);
    return null;
  }
}

/**
 * Une vidéo, par identifiant si possible — donc instantanée et dans l'ordre.
 *
 * Le repli par `link` reste : mieux vaut une vidéo qui arrive en retard que
 * pas de vidéo du tout.
 */
export async function sendVideoRapide(
  to: string, url: string, caption?: string
): Promise<MetaResult> {
  const id = await mediaId(url);
  if (!id) return sendVideo(to, url, caption);
  return send(to, {
    type: "video",
    video: { id, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
}

/**
 * LE composant natif de demande de position.
 *
 * Le client voit un bouton « Envoyer la position actuelle » : un appui, et
 * WhatsApp joint ses coordonnées GPS. Sa réponse revient comme un message de
 * type `location` ordinaire — donc rien de nouveau à décoder côté webhook.
 *
 * Ce que ça remplace : « Envoie-moi ta position (le trombone 📎 puis
 * Position) ». Expliquer à un client où cliquer dans son application est un
 * aveu que l'outil ne sait pas faire son travail — et la moitié des clients
 * abandonnent ou répondent un nom de quartier approximatif, qui ne vaut rien
 * pour un livreur.
 */
export function sendLocationRequest(to: string, body: string): Promise<MetaResult> {
  return send(to, {
    type: "interactive",
    interactive: {
      type: "location_request_message",
      body: { text: body.slice(0, 1024) },
      action: { name: "send_location" },
    },
  });
}

export function sendLocation(
  to: string, lat: number, lng: number, name?: string, address?: string
): Promise<MetaResult> {
  return send(to, {
    type: "location",
    location: { latitude: lat, longitude: lng, name: name || "", address: address || "" },
  });
}

/**
 * Marque le message comme lu et affiche l'indicateur de frappe.
 *
 * Chez Meta la frappe n'est pas une action libre : elle s'attache à un message
 * reçu et retombe seule au bout de ~25 s ou à l'envoi de la réponse. Il n'y a
 * donc pas de `stopTyping` — et plus besoin du nœud `Wait` qui simulait le
 * délai côté camille-core.
 */
export function markReadTyping(messageId: string): Promise<MetaResult> {
  return post(`${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  });
}

// ── Boutons et listes — natifs, donc fiables ────────────────────────────────

/**
 * Jusqu'à trois boutons de réponse rapide.
 *
 * Chaque choix fait par un bouton est un tour où l'analyse de texte libre ne
 * peut pas se tromper — et, pour la moitié d'entre eux, un tour qui ne coûte
 * aucun token. Les boutons ne sont pas un confort d'affichage : ce sont des
 * questions retirées au modèle.
 */
export function sendButtons(
  to: string, body: string, buttons: { id: string; title: string }[], footer?: string
): Promise<MetaResult> {
  return send(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        // Meta refuse un titre de plus de 20 caractères, et le refus porte sur
        // tout le message : on tronque ici plutôt que de perdre l'envoi.
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

export function sendList(
  to: string, body: string, buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  footer?: string
): Promise<MetaResult> {
  return send(to, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        button: buttonLabel.slice(0, 20),
        sections: sections.slice(0, 10).map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.slice(0, 10).map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    },
  });
}

// ── Catalogue : ce qui remplace nos albums ──────────────────────────────────

/**
 * Une fiche produit native, tirée du catalogue Meta.
 *
 * C'est le remplacement de `sendImage` + légende bricolée : le client voit le
 * prix, la photo et la description tenus par le catalogue, et peut ajouter au
 * PANIER WhatsApp natif sans qu'on ait à interpréter « oui je veux ça ».
 */
export function sendProduct(
  to: string, retailerId: string, body?: string, catalogId = CATALOG_ID
): Promise<MetaResult> {
  return send(to, {
    type: "interactive",
    interactive: {
      type: "product",
      ...(body ? { body: { text: body.slice(0, 1024) } } : {}),
      action: { catalog_id: catalogId, product_retailer_id: retailerId },
    },
  });
}

/**
 * Plusieurs produits en une vitrine — l'équivalent natif de notre album, en
 * mieux : le client parcourt, choisit les quantités et renvoie un panier.
 *
 * Meta impose un en-tête texte et au moins une section.
 */
export function sendProductList(
  to: string, header: string, body: string,
  sections: { title: string; retailerIds: string[] }[],
  footer?: string, catalogId = CATALOG_ID
): Promise<MetaResult> {
  return send(to, {
    type: "interactive",
    interactive: {
      type: "product_list",
      header: { type: "text", text: header.slice(0, 60) },
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        catalog_id: catalogId,
        sections: sections.slice(0, 10).map((s) => ({
          title: s.title.slice(0, 24),
          product_items: s.retailerIds.slice(0, 30).map((id) => ({ product_retailer_id: id })),
        })),
      },
    },
  });
}

/**
 * Le carrousel : des fiches produit qui défilent horizontalement.
 *
 * C'est le format le plus vendeur, et celui qui remplace vraiment nos albums :
 * chaque carte porte la photo, le nom et le prix tenus par le catalogue, et le
 * client ajoute au panier sans écrire une phrase.
 *
 * Trois contraintes imposées par Meta, apprises en les heurtant :
 *   - de 2 à 10 cartes (une seule carte est refusée → on envoie une fiche) ;
 *   - ni en-tête, ni pied de page, ni boutons ;
 *   - toutes les cartes dans le MÊME catalogue, et chaque `retailer_id` est
 *     vérifié côté serveur. Un identifiant qui figure dans le catalogue en
 *     lecture mais n'y est pas réellement rattaché fait rejeter TOUT le
 *     message — pas seulement sa carte.
 */
export function sendCarousel(
  to: string, body: string, retailerIds: string[], catalogId = CATALOG_ID
): Promise<MetaResult> {
  const ids = retailerIds.slice(0, 10);
  if (ids.length < 2) {
    return ids.length === 1
      ? sendProduct(to, ids[0], body, catalogId)
      : Promise.resolve({ ok: false, error: "carrousel : aucune fiche à montrer" });
  }
  return send(to, {
    type: "interactive",
    interactive: {
      type: "carousel",
      body: { text: body.slice(0, 1024) },
      action: {
        cards: ids.map((rid, i) => ({
          card_index: i,
          type: "product",
          action: { product_retailer_id: rid, catalog_id: catalogId },
        })),
      },
    },
  });
}

/**
 * Le carrousel, qui se répare lui-même.
 *
 * Le catalogue de production contenait trois produits « importés » que l'API de
 * lecture donnait pour `in stock` et `published`, et que WhatsApp refusait à
 * l'envoi : « product not found for product_retailer_id … in catalog_id … ».
 *
 * Aucun contrôle préalable ne les distingue — c'est justement l'API de lecture
 * qui les renvoie. La seule chose qui les révèle est l'échec, et Meta a la
 * courtoisie de NOMMER le coupable dans `error_data.details`. On s'en sert :
 * on retire la fiche incriminée et on réessaie, au lieu de laisser le client
 * sans rien parce qu'un produit sur cinq est fantôme.
 */
export async function sendCarouselRobuste(
  to: string, body: string, retailerIds: string[], catalogId = CATALOG_ID
): Promise<MetaResult & { rejetes?: string[] }> {
  let ids = retailerIds.slice(0, 10);
  const rejetes: string[] = [];

  // Au pire un tour par fiche ; en pratique un ou deux.
  for (let essai = 0; essai < ids.length + 1; essai++) {
    const r = await sendCarousel(to, body, ids, catalogId);
    if (r.ok) return rejetes.length ? { ...r, rejetes } : r;

    // On ne retente que sur « produit introuvable », et seulement si Meta
    // nomme lequel. Toute autre erreur est rendue telle quelle.
    const coupable = ids.find((id) => r.error?.includes(id));
    if (!coupable) return rejetes.length ? { ...r, rejetes } : r;

    console.warn(`[meta] fiche produit injoignable, retirée de la vitrine : ${coupable}`);
    rejetes.push(coupable);
    ids = ids.filter((id) => id !== coupable);
    if (!ids.length) return { ok: false, error: "aucune fiche envoyable", rejetes };
  }
  return { ok: false, error: "aucune fiche envoyable", rejetes };
}

/** La vitrine entière, telle que le catalogue la tient. */
export function sendCatalog(to: string, body: string, footer?: string): Promise<MetaResult> {
  return send(to, {
    type: "interactive",
    interactive: {
      type: "catalog_message",
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: { name: "catalog_message" },
    },
  });
}

// ── Templates — le seul envoi permis hors de la fenêtre de 24 h ─────────────

/**
 * Hors des 24 h qui suivent le dernier message du client, seul un template
 * approuvé passe. C'est ce qui concerne le remerciement à la livraison, la
 * prise en charge d'une réclamation, sa clôture, et un bon de commande envoyé
 * plus tard — quatre envois que Camille fait aujourd'hui en texte libre.
 */
export function sendTemplate(
  to: string, name: string, lang = "fr", params: string[] = []
): Promise<MetaResult> {
  return send(to, {
    type: "template",
    template: {
      name,
      language: { code: lang },
      ...(params.length
        ? { components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t })) }] }
        : {}),
    },
  });
}

// ── Modèles de message (templates) ──────────────────────────────────────────
//
// Hors de la fenêtre de 24 h, seul un modèle approuvé passe. Chaque marchand a
// donc besoin des SIENS, approuvés sous SA propre WABA : accusé de commande,
// suivi de livraison, prise en charge d'une réclamation. Sans cet écran, c'est
// le commerçant qui doit aller les créer dans les outils de Meta — ou nous qui
// les créons à la main pour chacun.

const WABA = process.env.WABA_ID || "";

export type Template = {
  id?: string;
  name: string;
  status?: string;
  category?: string;
  language?: string;
  components?: unknown[];
};

/** Les modèles du compte, avec leur statut d'approbation. */
export async function listTemplates(wabaId = WABA): Promise<{
  ok: boolean; templates: Template[]; error?: string;
}> {
  if (!TOKEN || !wabaId) return { ok: false, templates: [], error: "WHATSAPP_TOKEN ou WABA_ID absent" };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH}/${wabaId}/message_templates` +
        `?fields=id,name,status,category,language,components&limit=100`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (j.error || {}) as { message?: string };
      return { ok: false, templates: [], error: err.message || `HTTP ${res.status}` };
    }
    return { ok: true, templates: (j.data || []) as Template[] };
  } catch (e) {
    return { ok: false, templates: [], error: (e as Error).message };
  }
}

/**
 * Soumet un modèle à l'approbation de Meta.
 *
 * `example` est obligatoire dès qu'il y a des variables `{{1}}` : Meta refuse
 * un modèle dont il ne peut pas juger le rendu réel. On le construit donc à
 * partir des exemples saisis, plutôt que de laisser le commerçant découvrir le
 * refus trois jours plus tard.
 */
export async function createTemplate(
  input: {
    name: string;
    category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
    language?: string;
    body: string;
    examples?: string[];
    footer?: string;
  },
  wabaId = WABA
): Promise<{ ok: boolean; id?: string; status?: string; error?: string }> {
  if (!TOKEN || !wabaId) return { ok: false, error: "WHATSAPP_TOKEN ou WABA_ID absent" };

  // Meta impose : minuscules, chiffres et tirets bas uniquement.
  const name = input.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 512);
  const variables = (input.body.match(/\{\{\s*\d+\s*\}\}/g) || []).length;

  const components: Record<string, unknown>[] = [
    {
      type: "BODY",
      text: input.body,
      ...(variables
        ? {
            example: {
              body_text: [
                Array.from({ length: variables }, (_, i) => input.examples?.[i] || `exemple${i + 1}`),
              ],
            },
          }
        : {}),
    },
  ];
  if (input.footer?.trim()) components.push({ type: "FOOTER", text: input.footer.trim().slice(0, 60) });

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${wabaId}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, language: input.language || "fr", category: input.category, components }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (j.error || {}) as {
        message?: string; error_user_msg?: string; error_data?: { details?: string };
      };
      // `error_user_msg` porte souvent la vraie raison, lisible : « un modèle
      // de ce nom existe déjà », « la catégorie ne correspond pas au contenu ».
      return {
        ok: false,
        error: [err.error_user_msg, err.error_data?.details, err.message].filter(Boolean).join(" — "),
      };
    }
    return { ok: true, id: j.id, status: j.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Supprime un modèle.
 *
 * ⚠️ Meta garde le NOM bloqué longtemps après la suppression — bien au-delà de
 * la « minute » que son message d'erreur annonce. Toute tentative de recréer le
 * même nom échoue alors sur « le nouveau contenu ne peut pas être ajouté
 * lorsque le contenu existant est en cours de suppression », un message qui
 * parle de langue alors qu'il s'agit du nom. Vérifié : un nom neuf dans la même
 * langue passe sans problème au même instant.
 *
 * C'est pour ça que l'interface prévient avant de supprimer : on ne récupère
 * pas un nom, on en choisit un autre.
 */
export async function deleteTemplate(
  name: string, wabaId = WABA
): Promise<{ ok: boolean; error?: string }> {
  if (!TOKEN || !wabaId) return { ok: false, error: "WHATSAPP_TOKEN ou WABA_ID absent" };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH}/${wabaId}/message_templates?name=${encodeURIComponent(name)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (j.error || {}) as {
        message?: string; error_user_msg?: string; error_data?: { details?: string };
      };
      return {
        ok: false,
        error: [err.error_user_msg, err.error_data?.details, err.message].filter(Boolean).join(" — "),
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Lecture du catalogue Meta ───────────────────────────────────────────────

export type MetaCatalogItem = {
  retailer_id: string;
  name: string;
  price?: string;
  availability?: string;
  image_url?: string;
  description?: string;
  /**
   * Les champs de VARIATION. Meta décline un produit en plusieurs articles
   * reliés par `item_group_id` — quatre couleurs, quatre articles. Sans les
   * lire, un import créerait quatre produits Camille distincts, et le
   * catalogue du marchand doublerait à chaque synchronisation.
   */
  item_group_id?: string | null;
  color?: string | null;
  size?: string | null;
  pattern?: string | null;
  material?: string | null;
  custom_label_0?: string | null;
  /**
   * Ce produit peut-il être envoyé dans un message WhatsApp ?
   *
   * Découverte coûteuse : un produit peut figurer au catalogue en `in stock` et
   * `published`, et rester refusé à l'envoi — « product not found for
   * product_retailer_id … ». Trois produits du catalogue de production étaient
   * dans ce cas, et un seul d'entre eux dans une vitrine faisait rejeter TOUT
   * le message.
   *
   * Le discriminant est `capability_to_review_status`, clé `WHATSAPP` :
   * `APPROVED` = envoyable ; `NO_REVIEW` = pas encore passé par l'examen
   * commerce de WhatsApp. Un produit fraîchement synchronisé est dans ce
   * second état — ce n'est donc pas une anomalie, c'est le cycle normal.
   */
  sendable?: boolean;
  wa_status?: string;
};

/**
 * Les produits du catalogue Meta.
 *
 * Utile pour vérifier ce que Meta tient réellement — un `retailer_id` absent
 * ou un produit en `out of stock` fait échouer l'envoi d'une fiche, et le
 * message d'erreur de Meta ne dit pas lequel.
 */
export async function listCatalog(catalogId = CATALOG_ID, limit = 50): Promise<{
  ok: boolean; items: MetaCatalogItem[]; error?: string;
}> {
  if (!TOKEN || !catalogId) return { ok: false, items: [], error: "WHATSAPP_TOKEN ou CATALOG_ID absent" };
  try {
    const fields =
      "retailer_id,name,price,availability,image_url,description,capability_to_review_status," +
      "product_group{id},color,size,pattern,material,custom_label_0";
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH}/${catalogId}/products?fields=${fields}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (json.error || {}) as { message?: string };
      return { ok: false, items: [], error: err.message || `HTTP ${res.status}` };
    }
    const items = ((json.data || []) as (MetaCatalogItem & {
      capability_to_review_status?: { key: string; value: string }[];
      product_group?: { id?: string } | null;
    })[]).map((it) => {
      const wa = (it.capability_to_review_status || []).find((c) => c.key === "WHATSAPP");
      return {
        ...it,
        // Meta renvoie le groupe sous `product_group{id}` en lecture, alors
        // qu'il s'écrit `item_group_id` en écriture. On normalise ici : le
        // reste du code ne doit pas connaître cette asymétrie.
        item_group_id: it.product_group?.id || it.item_group_id || null,
        wa_status: wa?.value,
        sendable: wa?.value === "APPROVED",
      };
    });
    return { ok: true, items };
  } catch (e) {
    return { ok: false, items: [], error: (e as Error).message };
  }
}

// ── Synchronisation : camille.products → catalogue Meta ─────────────────────

export type ProduitASyncer = {
  /** L'identifiant Camille. Il devient le `retailer_id` chez Meta. */
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  image_url?: string | null;
  stock?: number | null;
  category?: string | null;
  active?: boolean;
  /** Les axes de variation de Camille, tels quels. */
  variants?: AxeVariante[] | null;
  /** Les photos en plus de l'image principale (colonne `images`). */
  images?: string[] | null;
};

/**
 * Pousse les produits de Camille vers le catalogue Meta.
 *
 * `camille.products.id` devient le `retailer_id`. C'est la décision prise une
 * fois pour toutes : un seul identifiant de produit partout — catalogue Meta,
 * Pixel, CAPI, commandes. Elle ne coûte rien aujourd'hui, et réconcilier trois
 * systèmes aux identifiants différents coûterait des semaines plus tard.
 *
 * `items_batch` + méthode `UPDATE` fait un upsert : le même appel crée ou met à
 * jour, ce qui rend la synchronisation rejouable sans précaution.
 *
 * Un produit inactif ou épuisé n'est pas supprimé mais passé `out of stock` :
 * supprimer bloquerait son identifiant chez Meta, comme pour les modèles de
 * message.
 */
/**
 * Les champs communs à toutes les variations d'un produit.
 *
 * Isolés pour qu'une variation et un produit simple ne puissent PAS diverger :
 * si le prix ou la description était recopié à deux endroits, une correction
 * sur l'un oublierait l'autre, et le marchand aurait deux prix pour le même
 * article selon la couleur choisie.
 */
function resteDuProduit(
  p: ProduitASyncer, options: { lien?: string; marque?: string }
): Record<string, unknown> {
  return {
    description: String(p.description || p.name).slice(0, 9999),
    // Meta attend le prix et la devise dans la même chaîne.
    price: `${Math.round(Number(p.price))} ${p.currency || "XAF"}`,
    availability: p.active === false || (p.stock != null && p.stock <= 0) ? "out of stock" : "in stock",
    condition: "new",
    link: options.lien || "https://camille.vps.buyticle.com",
    ...(options.marque ? { brand: options.marque } : {}),
    ...(p.category ? { product_type: p.category } : {}),
    ...(p.stock != null ? { inventory: Math.max(0, Number(p.stock)) } : {}),
  };
}

export async function syncCatalogue(
  produits: ProduitASyncer[],
  options: { catalogId?: string; lien?: string; marque?: string } = {}
): Promise<{ ok: boolean; envoyes: number; avertissements: string[]; error?: string }> {
  const catalogId = options.catalogId || CATALOG_ID;
  if (!TOKEN || !catalogId) {
    return { ok: false, envoyes: 0, avertissements: [], error: "WHATSAPP_TOKEN ou CATALOG_ID absent" };
  }
  if (!produits.length) return { ok: true, envoyes: 0, avertissements: [] };

  // Meta refuse un produit sans image ni prix : autant le dire plutôt que de
  // laisser la synchronisation échouer en bloc.
  const avertissements: string[] = [];
  const valides = produits.filter((p) => {
    if (!p.image_url) { avertissements.push(`${p.name} : pas d'image, non synchronisé`); return false; }
    if (p.price == null) { avertissements.push(`${p.name} : pas de prix, non synchronisé`); return false; }
    return true;
  });
  if (!valides.length) return { ok: true, envoyes: 0, avertissements };

  // Les axes multiples ne sont PAS multipliés entre eux : le marchand doit
  // savoir pourquoi, et quoi faire. Voir lib/whatsapp/variantes.ts.
  for (const p of valides) {
    const { avertissements: a } = articlesPour(
      { id: p.id, name: p.name, image_url: p.image_url || null }, p.variants
    );
    avertissements.push(...a);
  }

  const requests = valides.flatMap((p) => {
    // Un produit à variations devient PLUSIEURS articles, reliés par
    // item_group_id : c'est ce qui donne au client un sélecteur de couleur au
    // lieu de quatre fiches séparées.
    const { articles } = articlesPour(
      { id: p.id, name: p.name, image_url: p.image_url || null },
      p.variants
    );
    return articles.map((a) => ({
      method: "UPDATE",
      data: {
        id: a.retailerId,
        title: a.titre,
        ...(a.itemGroupId ? { item_group_id: a.itemGroupId } : {}),
        ...(a.champ && a.valeur ? { [a.champ]: a.valeur } : {}),
        image_link: a.image || p.image_url,
        // Les autres photos du produit : le client les fait défiler dans la
        // fiche WhatsApp. Sans ce champ, seule la première partait.
        ...(() => {
          const extra = imagesSupplementaires(a.image || p.image_url, [p.image_url, ...(p.images || [])]);
          return extra.length ? { additional_image_link: extra } : {};
        })(),
        ...resteDuProduit(p, options),
      },
    }));
  });


  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${catalogId}/items_batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ item_type: "PRODUCT_ITEM", requests }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (j.error || {}) as {
        message?: string; error_user_msg?: string; error_data?: { details?: string };
      };
      return {
        ok: false, envoyes: 0, avertissements,
        error: [err.error_user_msg, err.error_data?.details, err.message].filter(Boolean).join(" — "),
      };
    }
    // Meta renvoie ses propres remarques par produit : on les fait remonter.
    for (const v of (j.validation_status || []) as {
      retailer_id?: string; errors?: { message?: string }[]; warnings?: { message?: string }[];
    }[]) {
      for (const e of v.errors || []) avertissements.push(`${v.retailer_id} : ${e.message}`);
    }
    // `requests.length`, pas `valides.length` : un produit à variations compte
    // pour autant d'articles qu'il a de déclinaisons.
    return { ok: true, envoyes: requests.length, avertissements };
  } catch (e) {
    return { ok: false, envoyes: 0, avertissements, error: (e as Error).message };
  }
}

/**
 * Retirer des articles du catalogue Meta.
 *
 * Indispensable au catalogue unique : un produit supprimé dans Camille et
 * laissé chez Meta reste proposable dans WhatsApp. Le client le met au panier,
 * la commande tombe, et le commerçant n'a rien à vendre.
 */
export async function supprimerDuCatalogue(
  retailerIds: string[], catalogId = CATALOG_ID
): Promise<{ ok: boolean; supprimes: number; error?: string }> {
  if (!TOKEN || !catalogId) return { ok: false, supprimes: 0, error: "WHATSAPP_TOKEN ou CATALOG_ID absent" };
  const ids = retailerIds.filter(Boolean);
  if (!ids.length) return { ok: true, supprimes: 0 };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${catalogId}/items_batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        item_type: "PRODUCT_ITEM",
        requests: ids.map((id) => ({ method: "DELETE", data: { id } })),
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (j.error || {}) as { message?: string; error_data?: { details?: string } };
      return {
        ok: false, supprimes: 0,
        error: [err.error_data?.details, err.message].filter(Boolean).join(" — "),
      };
    }
    return { ok: true, supprimes: ids.length };
  } catch (e) {
    return { ok: false, supprimes: 0, error: (e as Error).message };
  }
}

/** Ce que l'environnement porte réellement — sans jamais divulguer le jeton. */
export function metaConfigured(): {
  ok: boolean; phone_number_id: string; catalog_id: string; graph: string; token: string;
} {
  return {
    ok: Boolean(TOKEN && PHONE_ID),
    phone_number_id: PHONE_ID || "(absent)",
    catalog_id: CATALOG_ID || "(absent)",
    graph: GRAPH,
    // Les quatre derniers caractères suffisent à vérifier qu'on parle du bon
    // jeton sans l'exposer dans un journal ou une réponse d'API.
    token: TOKEN ? `…${TOKEN.slice(-4)} (${TOKEN.length} car.)` : "(absent)",
  };
}
