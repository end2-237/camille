// ─────────────────────────────────────────────────────────────────────────────
// Ce que l'IA a consommé pour un agent, quand c'est Camille elle-même qui
// l'appelle (transport Meta). Avec camille-core, c'est n8n qui le déclare par
// POST /api/usage/record ; sans cette écriture, le transport Meta n'apparaissait
// ni dans « Utilisation de l'IA », ni dans les statistiques.
// Best-effort : un compteur qui échoue ne retarde jamais la réponse au client.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { currentPeriod, TOKENS_PAR_CONVERSATION } from "@/lib/plans";
import { getPlanLimitDB } from "@/lib/plans-db";
import { consommation } from "@/lib/quota";
import { alerterQuota } from "@/lib/usage-alerts";

export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

export async function compterTokens(agentId: string, u: Usage | null | undefined): Promise<void> {
  const pt = Number(u?.prompt_tokens) || 0;
  const ct = Number(u?.completion_tokens) || 0;
  const tt = Number(u?.total_tokens) || pt + ct;
  if (!agentId || tt <= 0) return;
  // Le détail prompt / réponse reste visible ; le TOTAL, lui, est décompté
  // par conversation (compterConversation) : c'est ce que le forfait promet.
  await ajouter(agentId, pt, ct, 0);
  try {
    await query(
      `INSERT INTO camille.agent_analytics (agent_id, date, messages_handled, tokens_consumed)
       VALUES ($1, CURRENT_DATE, 1, $2)
       ON CONFLICT (agent_id, date) DO UPDATE SET
         messages_handled = camille.agent_analytics.messages_handled + 1,
         tokens_consumed  = camille.agent_analytics.tokens_consumed + EXCLUDED.tokens_consumed`,
      [agentId, tt]
    );
  } catch (e) {
    console.warn("[usage] agent_analytics non écrit :", (e as Error).message);
  }
}

async function ajouter(agentId: string, pt: number, ct: number, tt: number): Promise<void> {
  try {
    await query(
      `INSERT INTO camille.token_usage (agent_id, period, prompt_tokens, completion_tokens, total_tokens)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (agent_id, period) DO UPDATE SET
         prompt_tokens     = camille.token_usage.prompt_tokens     + EXCLUDED.prompt_tokens,
         completion_tokens = camille.token_usage.completion_tokens + EXCLUDED.completion_tokens,
         total_tokens      = camille.token_usage.total_tokens      + EXCLUDED.total_tokens`,
      [agentId, currentPeriod(), pt, ct, tt]
    );
  } catch (e) {
    console.warn("[usage] token_usage non écrit :", (e as Error).message);
  }
}

/** Une conversation = un client qui écrit après plus de 24 h de silence. */
export const FENETRE_CONVERSATION_MS = 24 * 3600_000;

/**
 * Décompte une conversation sur le forfait, si ce message en ouvre une.
 *
 * Le parcours Meta est surtout déterministe (catalogue, panier, adresse) :
 * compter les seuls tokens de l'IA laissait un compte gratuit servir des
 * clients sans fin. On compte donc ce que le forfait vend — des
 * conversations — au tarif fixe de TOKENS_PAR_CONVERSATION.
 *
 * À appeler AVANT de tracer le message du client.
 */
export async function compterConversation(agentId: string, session: string, phone: string): Promise<boolean> {
  try {
    const r = await query(
      `SELECT 1 FROM camille.agent_conversations
        WHERE session_name = $1 AND contact_phone = $2 AND role = 'user'
          AND created_at > NOW() - make_interval(secs => $3)
        LIMIT 1`,
      [session, phone, FENETRE_CONVERSATION_MS / 1000]
    );
    if (r.rows.length) return false;
  } catch (e) {
    // Dans le doute, on ne facture pas : mieux vaut un oubli qu'un double compte.
    console.warn("[usage] conversation non vérifiée :", (e as Error).message);
    return false;
  }
  await ajouter(agentId, 0, 0, TOKENS_PAR_CONVERSATION);

  // Les alertes 80 % / 100 % au commerçant, comme sur le chemin n8n.
  try {
    const o = await query(
      `SELECT user_id, plan, COALESCE(NULLIF(name, ''), 'Ton agent') AS name
         FROM camille.agents WHERE id = $1`,
      [agentId]
    );
    const owner = o.rows[0];
    if (owner?.user_id) {
      const plan = owner.plan || "free";
      await alerterQuota({
        agentId,
        userId: owner.user_id,
        agentName: owner.name,
        period: currentPeriod(),
        used: await consommation(agentId, owner.user_id, plan),
        limit: await getPlanLimitDB(plan),
      });
    }
  } catch (e) {
    console.warn("[usage] alerte de quota non envoyée :", (e as Error).message);
  }
  return true;
}
