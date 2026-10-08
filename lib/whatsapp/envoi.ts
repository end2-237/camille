// ─────────────────────────────────────────────────────────────────────────────
// Le point d'envoi unique vers un client WhatsApp.
//
// Camille parle par deux transports en même temps : camille-core (Baileys) pour
// les marchands déjà installés, et l'API Cloud de Meta pour ceux qui passent
// par Embedded Signup. Les envois qui ne naissent PAS dans une conversation —
// réclamation traitée, commande passée par l'API publique, bon de commande,
// remerciement — appelaient camille-core en dur. Pour un agent Meta, la session
// « meta:<id> » n'existe pas dans camille-core : le client n'était jamais
// prévenu, et personne ne le voyait.
//
// Ici, on choisit le transport d'après l'agent, et on renvoie toujours un
// résultat lisible. Ne lève jamais : un message qui ne part pas ne doit pas
// empêcher d'enregistrer une commande ou de traiter un dossier.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import * as meta from "./meta";
import { avecAgent } from "./identifiants";

const CORE_URL = (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");
const CORE_KEY = process.env.CAMILLE_CORE_API_KEY ?? "";

export type Transport = "core" | "meta";
export type EnvoiResult = { ok: boolean; transport: Transport; error?: string; skipped?: boolean };

/** Préfixe des sessions Meta dans camille.whatsapp_sessions (cf. handle.ts). */
const PREFIXE_META = "meta:";

/**
 * Par où parle cet agent, et sous quel nom de session côté camille-core ?
 *
 * `transport` est lu par to_jsonb : sur une base où migration_meta_transport.sql
 * n'est pas passée, on obtient NULL — donc « core », le comportement d'avant —
 * au lieu de faire échouer l'envoi.
 */
export async function transportDe(
  agentId: string,
  sessionConnue?: string | null
): Promise<{ transport: Transport; session: string | null }> {
  if (sessionConnue?.startsWith(PREFIXE_META)) return { transport: "meta", session: sessionConnue };
  let transport: Transport = "core";
  let session: string | null = sessionConnue || null;
  try {
    const r = await query(
      `SELECT COALESCE(to_jsonb(a)->>'transport', 'core') AS transport,
              (SELECT s.session_name FROM camille.whatsapp_sessions s
                WHERE s.agent_id = a.id AND s.session_name NOT LIKE 'meta:%'
                ORDER BY s.session_name LIMIT 1) AS session_core
         FROM camille.agents a WHERE a.id = $1`,
      [agentId]
    );
    const row = r.rows[0];
    if (row?.transport === "meta") transport = "meta";
    if (!session) session = row?.session_core || null;
  } catch { /* base injoignable : on garde core, l'appel dira s'il échoue */ }
  return { transport, session };
}

async function viaCore(
  chemin: "sendText" | "sendFile",
  session: string | null,
  corps: Record<string, unknown>
): Promise<EnvoiResult> {
  if (!session) return { ok: false, transport: "core", error: "aucune session camille-core pour cet agent" };
  if (!CORE_KEY) return { ok: false, transport: "core", error: "CAMILLE_CORE_API_KEY absente de l'environnement" };
  try {
    const res = await fetch(`${CORE_URL}/api/${chemin}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": CORE_KEY },
      body: JSON.stringify({ ...corps, session }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok || j?.success === false) {
      return { ok: false, transport: "core", error: String(j?.error || `envoi refusé (${res.status})`) };
    }
    if (j?.skipped) return { ok: false, transport: "core", skipped: true, error: "envoi ignoré par camille-core" };
    return { ok: true, transport: "core" };
  } catch (e) {
    return { ok: false, transport: "core", error: `camille-core injoignable : ${(e as Error).message}` };
  }
}

/** Un texte au client, par le transport de l'agent. */
export async function envoyerTexte(
  agentId: string,
  chatId: string,
  text: string,
  opts: { session?: string | null } = {}
): Promise<EnvoiResult> {
  if (!chatId) return { ok: false, transport: "core", error: "aucun destinataire" };
  const { transport, session } = await transportDe(agentId, opts.session);
  if (transport === "meta") {
    const r = await avecAgent(agentId, () => meta.sendText(chatId, text));
    return { ok: r.ok, transport, error: r.error };
  }
  return viaCore("sendText", session, { chatId, text });
}

/** Un document (PDF…) au client, par le transport de l'agent. */
export async function envoyerDocument(
  agentId: string,
  chatId: string,
  doc: { url: string; name: string; mimeType?: string; caption?: string },
  opts: { session?: string | null } = {}
): Promise<EnvoiResult> {
  if (!chatId) return { ok: false, transport: "core", error: "aucun destinataire" };
  const { transport, session } = await transportDe(agentId, opts.session);
  if (transport === "meta") {
    const r = await avecAgent(agentId, () => meta.sendDocument(chatId, doc.url, doc.name, doc.caption));
    return { ok: r.ok, transport, error: r.error };
  }
  return viaCore("sendFile", session, {
    chatId,
    file: { url: doc.url, name: doc.name, mimeType: doc.mimeType || "application/pdf" },
    caption: doc.caption,
  });
}
