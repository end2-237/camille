// ─────────────────────────────────────────────────────────────────────────────
// L'essai gratuit.
//
// Le premier agent d'un compte démarre sur ESSAI_PLAN (Starter par défaut)
// pendant ESSAI_JOURS (14 par défaut ; 0 pour désactiver). À l'échéance, il
// retombe sur le forfait gratuit — il ne se tait pas. Payer pendant l'essai le
// termine : le mois payé commence à la fin de l'essai.
//
// Sans migration_essai_recus.sql, rien ne change : pas d'essai.
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "@/lib/db";

export const ESSAI_JOURS = Math.max(0, Number(process.env.ESSAI_JOURS ?? 14));
export const ESSAI_PLAN = process.env.ESSAI_PLAN || "starter";

/**
 * Place l'agent tout juste créé en essai si le compte n'en a jamais eu.
 * Renvoie la date de fin, ou null (pas d'essai). Ne lève jamais.
 */
export async function demarrerEssai(userId: string, agentId: string): Promise<string | null> {
  if (!ESSAI_JOURS) return null;
  try {
    // Le verrou : un seul essai par compte, même avec deux créations simultanées.
    const pris = await query(
      `UPDATE camille.users SET trial_used_at = NOW()
        WHERE id = $1 AND trial_used_at IS NULL RETURNING id`,
      [userId]
    );
    if (!pris.rows.length) return null;
    const r = await query(
      `UPDATE camille.agents
          SET plan = $2, trial = TRUE, plan_expires_at = NOW() + ($3 || ' days')::interval
        WHERE id = $1 RETURNING plan_expires_at`,
      [agentId, ESSAI_PLAN, String(ESSAI_JOURS)]
    );
    return r.rows[0]?.plan_expires_at ?? null;
  } catch {
    return null; // colonnes absentes : pas d'essai
  }
}

/**
 * Les essais échus retombent sur le gratuit (pour un agent, ou tous ceux d'un
 * compte). Renvoie le nombre d'agents basculés. Ne lève jamais.
 */
export async function terminerEssaisEchus(par: { agentId?: string; userId?: string }): Promise<number> {
  try {
    const r = await query(
      `UPDATE camille.agents
          SET plan = 'free', plan_expires_at = NULL, trial = FALSE, updated_at = NOW()
        WHERE trial AND plan_expires_at <= NOW()
          AND ($1::uuid IS NULL OR id = $1::uuid)
          AND ($2::uuid IS NULL OR user_id = $2::uuid)`,
      [par.agentId ?? null, par.userId ?? null]
    );
    return r.rowCount ?? 0;
  } catch {
    return 0; // colonne absente
  }
}

/** Un paiement met fin à l'essai. Ne lève jamais. */
export async function sortirDeLEssai(agentId: string): Promise<void> {
  try {
    await query(`UPDATE camille.agents SET trial = FALSE WHERE id = $1`, [agentId]);
  } catch { /* colonne absente */ }
}
