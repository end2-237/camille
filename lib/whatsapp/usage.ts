// ─────────────────────────────────────────────────────────────────────────────
// Ce que l'IA a consommé pour un agent, quand c'est Camille elle-même qui
// l'appelle (transport Meta). Avec camille-core, c'est n8n qui le déclare par
// POST /api/usage/record ; sans cette écriture, le transport Meta n'apparaissait
// ni dans « Utilisation de l'IA », ni dans les statistiques.
// Best-effort : un compteur qui échoue ne retarde jamais la réponse au client.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { currentPeriod } from "@/lib/plans";

export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

export async function compterTokens(agentId: string, u: Usage | null | undefined): Promise<void> {
  const pt = Number(u?.prompt_tokens) || 0;
  const ct = Number(u?.completion_tokens) || 0;
  const tt = Number(u?.total_tokens) || pt + ct;
  if (!agentId || tt <= 0) return;
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
