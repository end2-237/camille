// ─────────────────────────────────────────────────────────────────────────────
// Les identifiants Meta d'un agent : les siens s'il a connecté son WhatsApp par
// l'Embedded Signup, sinon ceux de l'application (l'environnement).
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { dechiffrer } from "./coffre";
import { avecIdentifiants, identifiantsEnv, type IdentifiantsMeta } from "./contexte-meta";

const CACHE = new Map<string, { ids: IdentifiantsMeta; expire: number }>();
const TTL = 5 * 60_000;

/** À appeler après une connexion ou une déconnexion : le cache ne doit pas mentir. */
export function oublierIdentifiants(agentId: string) {
  CACHE.delete(agentId);
}

export async function identifiantsAgent(agentId: string): Promise<IdentifiantsMeta> {
  const garde = CACHE.get(agentId);
  if (garde && garde.expire > Date.now()) return garde.ids;

  let ids = identifiantsEnv();
  try {
    const r = await query(
      `SELECT to_jsonb(a)->>'meta_token_enc'       AS token_enc,
              to_jsonb(a)->>'meta_phone_number_id' AS phone_id,
              to_jsonb(a)->>'meta_catalog_id'      AS catalog_id,
              to_jsonb(a)->>'meta_waba_id'         AS waba_id
         FROM camille.agents a WHERE a.id = $1`,
      [agentId]
    );
    const row = r.rows[0];
    const token = row?.token_enc ? dechiffrer(row.token_enc) : null;
    if (token && row?.phone_id) {
      // Ses propres identifiants. Un catalogue absent reste absent : on ne
      // montre JAMAIS le catalogue de l'application au client d'un commerçant.
      ids = { token, phoneId: row.phone_id, catalogId: row.catalog_id || "", wabaId: row.waba_id || "", source: "agent" };
    } else if (row?.token_enc) {
      console.error(`[meta] jeton de l'agent ${agentId} illisible (META_TOKEN_KEY changée ?) — repli sur l'application`);
    }
  } catch { /* base injoignable ou colonnes absentes : l'environnement, comme avant */ }

  CACHE.set(agentId, { ids, expire: Date.now() + TTL });
  return ids;
}

/** Exécute `fn` au nom de cet agent : chaque appel à Meta portera ses identifiants. */
export async function avecAgent<T>(agentId: string, fn: () => Promise<T>): Promise<T> {
  return avecIdentifiants(await identifiantsAgent(agentId), fn);
}
