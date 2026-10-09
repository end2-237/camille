// ─────────────────────────────────────────────────────────────────────────────
// Un agent a-t-il encore le droit de répondre ?
//
// Une seule règle pour les deux transports : n8n la lit par /api/usage/check,
// le transport Meta l'applique directement avant chaque réponse. Avant, seul
// n8n la consultait — un agent passé sur le WhatsApp officiel répondait même
// abonnement expiré et quota épuisé.
//
//   1. Abonnement expiré → l'agent se tait (enterprise jamais concerné).
//   2. Quota du mois épuisé → l'agent se tait.
//
// Le forfait gratuit se compte PAR COMPTE, archives comprises : sinon créer un
// nouvel agent gratuit (ou archiver l'ancien) remettait le compteur à zéro.
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "@/lib/db";
import { currentPeriod } from "@/lib/plans";
import { getPlanLimitDB, isUnlimitedTokens } from "@/lib/plans-db";
import { subscriptionState } from "@/lib/subscription";
import { terminerEssaisEchus } from "@/lib/essai";

/** L'agent était-il en essai (et vient-il de retomber sur le gratuit) ? */
async function essaiTermine(agentId: string): Promise<boolean> {
  try {
    const r = await query(`SELECT COALESCE((to_jsonb(a)->>'trial')::boolean, FALSE) AS trial FROM camille.agents a WHERE id = $1`, [agentId]);
    if (!r.rows[0]?.trial) return false;
    // Vrai seulement si la bascule a eu lieu : sinon on ne recompte pas (pas
    // de boucle si l'écriture échoue).
    return (await terminerEssaisEchus({ agentId })) > 0;
  } catch {
    return false;
  }
}

export type EtatQuota = {
  allowed: boolean;
  reason?: "subscription_expired" | "quota_exceeded" | "no_agent" | "db_error";
  plan?: string;
  used?: number | null;
  limit?: number;
  remaining?: number;
  percent?: number;
  expired_at?: string | null;
  /** Le message à envoyer au client final quand l'agent se tait. */
  message?: string;
};

export const MSG_EXPIRE =
  "Ce service est momentanément indisponible. Merci de contacter directement le commerçant.";
export const MSG_QUOTA =
  "Nous recevons beaucoup de messages en ce moment. Merci de réessayer dans un instant.";

/** Tokens consommés ce mois : l'agent seul, ou tout le gratuit du compte. */
export async function consommation(agentId: string, userId: string, plan: string, period = currentPeriod()): Promise<number> {
  const r = plan === "free"
    ? await query(
        `SELECT COALESCE(SUM(t.total_tokens), 0) AS total
           FROM camille.token_usage t
           JOIN camille.agents a ON a.id = t.agent_id
          WHERE a.user_id = $1 AND a.plan = 'free' AND t.period = $2`,
        [userId, period]
      )
    : await query(
        `SELECT COALESCE(total_tokens, 0) AS total
           FROM camille.token_usage WHERE agent_id = $1 AND period = $2`,
        [agentId, period]
      );
  return Number(r.rows[0]?.total ?? 0);
}

export async function etatQuota(agentId: string): Promise<EtatQuota> {
  try {
    const r = await query(
      `SELECT id, user_id, plan, plan_expires_at FROM camille.agents WHERE id = $1`,
      [agentId]
    );
    const a = r.rows[0];
    if (!a) return { allowed: true, reason: "no_agent" };
    const plan = a.plan || "free";

    const sub = subscriptionState(plan, a.plan_expires_at);
    if (sub.expired && (await essaiTermine(agentId))) {
      // Un essai échu retombe sur le gratuit : on recompte comme tel.
      return etatQuota(agentId);
    }
    if (sub.expired) {
      return { allowed: false, reason: "subscription_expired", plan, expired_at: sub.expiresAt, message: MSG_EXPIRE };
    }

    const limit = await getPlanLimitDB(plan);
    if (isUnlimitedTokens(limit)) {
      return { allowed: true, plan, used: null, limit: -1, remaining: -1, percent: 0 };
    }

    const used = await consommation(agentId, a.user_id, plan);
    const allowed = used < limit;
    return {
      allowed,
      plan,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percent: Math.min(100, Math.round((used / limit) * 100)),
      ...(allowed ? {} : { reason: "quota_exceeded" as const, message: MSG_QUOTA }),
    };
  } catch (e) {
    // Une base injoignable ne doit pas faire taire tous les agents.
    console.error("[quota]", e instanceof Error ? e.message : e);
    return { allowed: true, reason: "db_error" };
  }
}
