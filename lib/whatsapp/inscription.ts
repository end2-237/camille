// ─────────────────────────────────────────────────────────────────────────────
// L'Embedded Signup, côté serveur : ce qui se passe après que le commerçant a
// fini la fenêtre de Meta.
//
//   1. Le code reçu devient un jeton (échange avec le secret de l'application).
//   2. On retrouve son compte WhatsApp Business (WABA) et son numéro — donnés
//      par la fenêtre, sinon relus dans les droits du jeton.
//   3. On abonne NOTRE application à SON compte : sans ça, ses messages
//      n'arrivent jamais à notre webhook.
//   4. On enregistre son numéro sur l'API Cloud (avec un code PIN qu'on garde).
//   5. On relève son nom vérifié, son numéro affiché, et le catalogue relié à
//      son compte s'il en a un.
//
// Chaque étape dit ce qui a échoué, en clair : c'est ce qui permet au
// commerçant (ou à nous) de corriger, au lieu d'un « échec » muet.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";

const GRAPH = (process.env.GRAPH_VERSION || "v26.0").replace(/^\/?/, "");
const BASE = `https://graph.facebook.com/${GRAPH}`;

export const appId = () => process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "";
const appSecret = () => process.env.WHATSAPP_APP_SECRET || "";

type Reponse = { ok: boolean; status: number; json: Record<string, unknown> };

async function graph(chemin: string, opts: { token?: string; method?: string; body?: unknown } = {}): Promise<Reponse> {
  try {
    const res = await fetch(`${BASE}/${chemin}`, {
      method: opts.method || "GET",
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: { message: (e as Error).message } } };
  }
}

/** Le message d'erreur de Meta, lisible. */
export function erreurMeta(r: Reponse): string {
  const e = (r.json.error || {}) as { message?: string; error_user_msg?: string; code?: number; error_data?: { details?: string } };
  return [e.error_user_msg, e.error_data?.details, e.message, e.code != null ? `(code ${e.code})` : ""]
    .filter(Boolean).join(" — ") || `réponse ${r.status}`;
}

export type Connexion = {
  token: string;
  wabaId: string;
  phoneId: string;
  pin: string;
  displayPhone: string;
  verifiedName: string;
  catalogId: string | null;
  avertissements: string[];
};

/** Tout le parcours. Lève une Error au message lisible si une étape bloquante échoue. */
export async function connecter(code: string, indices: { wabaId?: string; phoneId?: string }): Promise<Connexion> {
  if (!appId() || !appSecret()) {
    throw new Error("META_APP_ID (ou NEXT_PUBLIC_META_APP_ID) et WHATSAPP_APP_SECRET doivent être renseignés.");
  }
  const avertissements: string[] = [];

  // 1. Le code devient un jeton.
  const ech = await graph(
    `oauth/access_token?client_id=${encodeURIComponent(appId())}&client_secret=${encodeURIComponent(appSecret())}&code=${encodeURIComponent(code)}`
  );
  const token = String(ech.json.access_token || "");
  if (!ech.ok || !token) throw new Error(`Meta n'a pas accepté la connexion : ${erreurMeta(ech)}`);

  // 2. Le compte et le numéro.
  let wabaId = String(indices.wabaId || "");
  if (!wabaId) {
    const dbg = await graph(`debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(`${appId()}|${appSecret()}`)}`);
    const scopes = ((dbg.json.data as Record<string, unknown>)?.granular_scopes || []) as { scope?: string; target_ids?: string[] }[];
    wabaId = scopes.find((s) => s.scope === "whatsapp_business_management")?.target_ids?.[0] || "";
  }
  if (!wabaId) throw new Error("Aucun compte WhatsApp Business n'a été partagé pendant la connexion.");

  let phoneId = String(indices.phoneId || "");
  if (!phoneId) {
    const nums = await graph(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, { token });
    phoneId = String(((nums.json.data || []) as { id?: string }[])[0]?.id || "");
  }
  if (!phoneId) throw new Error("Aucun numéro WhatsApp trouvé sur ce compte. Ajoute un numéro et recommence.");

  // 3. Notre application écoute SON compte.
  const abo = await graph(`${wabaId}/subscribed_apps`, { token, method: "POST" });
  if (!abo.ok) throw new Error(`Impossible de relier le compte à Camille (webhook) : ${erreurMeta(abo)}`);

  // 4. Le numéro sur l'API Cloud. Déjà enregistré n'est pas une erreur.
  const pin = String(crypto.randomInt(100000, 1000000));
  const reg = await graph(`${phoneId}/register`, { token, method: "POST", body: { messaging_product: "whatsapp", pin } });
  if (!reg.ok) avertissements.push(`Enregistrement du numéro : ${erreurMeta(reg)}`);

  // 5. Ce qu'on affiche, et le catalogue.
  const info = await graph(`${phoneId}?fields=display_phone_number,verified_name`, { token });
  const cat = await graph(`${wabaId}/product_catalogs`, { token });
  const catalogId = String(((cat.json.data || []) as { id?: string }[])[0]?.id || "") || null;
  if (!catalogId) {
    avertissements.push(
      "Aucun catalogue n'est relié à ce compte WhatsApp. Crée-le dans Commerce Manager, relie-le dans WhatsApp Manager → Catalogue, puis clique « Actualiser »."
    );
  }

  return {
    token, wabaId, phoneId, pin,
    displayPhone: String(info.json.display_phone_number || ""),
    verifiedName: String(info.json.verified_name || ""),
    catalogId,
    avertissements,
  };
}

/** Le catalogue actuellement relié au compte (après coup, une fois créé par le commerçant). */
export async function catalogueRelie(wabaId: string, token: string): Promise<string | null> {
  const cat = await graph(`${wabaId}/product_catalogs`, { token });
  return String(((cat.json.data || []) as { id?: string }[])[0]?.id || "") || null;
}

/** Notre application cesse d'écouter ce compte. Best-effort. */
export async function desabonner(wabaId: string, token: string): Promise<void> {
  await graph(`${wabaId}/subscribed_apps`, { token, method: "DELETE" });
}

// ── Le numéro de l'application ──────────────────────────────────────────────
// Un agent peut parler par Meta avec le numéro de l'APPLICATION (identifiants
// de l'environnement) plutôt qu'avec le sien : c'est le cas de Buyticle. Il est
// alors bel et bien connecté ; on va chercher chez Meta le nom et le numéro à
// afficher. Gardé dix minutes : ces valeurs ne bougent pas.
let profilApp: { valeur: { numero: string | null; nom: string | null }; expire: number } | null = null;

export async function profilNumeroApplication(): Promise<{ numero: string | null; nom: string | null }> {
  if (profilApp && profilApp.expire > Date.now()) return profilApp.valeur;
  const phoneId = process.env.PHONE_NUMBER_ID || "";
  const token = process.env.WHATSAPP_TOKEN || "";
  let valeur = { numero: null as string | null, nom: null as string | null };
  if (phoneId && token) {
    try {
      const r = await graph(`${phoneId}?fields=display_phone_number,verified_name`, { token });
      valeur = { numero: r.json.display_phone_number ? String(r.json.display_phone_number) : null, nom: r.json.verified_name ? String(r.json.verified_name) : null };
    } catch { /* Meta injoignable : on affiche sans le détail */ }
  }
  profilApp = { valeur, expire: Date.now() + 10 * 60_000 };
  return valeur;
}
