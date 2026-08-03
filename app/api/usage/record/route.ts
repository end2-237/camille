// POST /api/usage/record
// Appelée par n8n après chaque réponse Groq pour enregistrer les tokens consommés.
// Route publique — appelée depuis le serveur n8n.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPeriod } from "@/lib/plans";
import { getPlanLimitDB } from "@/lib/plans-db";
import { subscriptionState } from "@/lib/subscription";
import { alerterQuota, alerterEcheance } from "@/lib/usage-alerts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, agentId: agentIdInput, prompt_tokens, completion_tokens, total_tokens } = body as {
      session?:          string;
      agentId?:          string;
      prompt_tokens:     number;
      completion_tokens: number;
      total_tokens:      number;
    };

    if ((!session && !agentIdInput) || total_tokens == null) {
      return NextResponse.json(
        { error: "Champs requis : (session ou agentId) et total_tokens" },
        { status: 400 }
      );
    }

    // agent_id : direct (robuste) OU résolu depuis la session
    let agentId = agentIdInput || "";
    if (!agentId && session) {
      const agentRes = await query(
        `SELECT a.id FROM camille.whatsapp_sessions ws
         JOIN camille.agents a ON a.id = ws.agent_id
         WHERE ws.session_name = $1`,
        [session]
      );
      if (agentRes.rows.length === 0) {
        return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
      }
      agentId = agentRes.rows[0].id;
    }

    // Propriétaire et forfait : nécessaires aux alertes de fin de forfait, qui
    // valent surtout AVANT la coupure. On les lit une fois, sans bloquer
    // l'enregistrement si la lecture échoue.
    let owner: { user_id: string; plan: string; name: string; plan_expires_at: string | null } | null = null;
    try {
      const r = await query(
        `SELECT user_id, plan, plan_expires_at,
                COALESCE(NULLIF(name, ''), 'Ton agent') AS name
           FROM camille.agents WHERE id = $1`,
        [agentId]
      );
      owner = r.rows[0] ?? null;
    } catch { /* les compteurs priment sur les alertes */ }

    const period  = currentPeriod();
    const pt = Number(prompt_tokens)     || 0;
    const ct = Number(completion_tokens) || 0;
    const tt = Number(total_tokens)      || 0;

    // Les deux écritures sont indépendantes. Elles étaient enchaînées : quand
    // l'upsert des tokens échouait (contrainte d'unicité absente sur
    // (agent_id, period)), l'analytics du jour n'était jamais atteinte et
    // l'accueil affichait 0 message en plus de 0 token. Une panne d'un côté ne
    // doit plus effacer la mesure de l'autre.
    const warnings: string[] = [];

    // Upsert : crée l'entrée si inexistante, sinon additionne les tokens
    try {
      await query(
        `INSERT INTO camille.token_usage
           (agent_id, period, prompt_tokens, completion_tokens, total_tokens)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (agent_id, period)
         DO UPDATE SET
           prompt_tokens     = camille.token_usage.prompt_tokens     + EXCLUDED.prompt_tokens,
           completion_tokens = camille.token_usage.completion_tokens + EXCLUDED.completion_tokens,
           total_tokens      = camille.token_usage.total_tokens      + EXCLUDED.total_tokens`,
        [agentId, period, pt, ct, tt]
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[usage/record token_usage]", m);
      warnings.push(`token_usage: ${m}`);
    }

    // Analytics du jour : +1 message, + tokens (alimente les Statistiques et l'accueil)
    try {
      await query(
        `INSERT INTO camille.agent_analytics (agent_id, date, messages_handled, tokens_consumed)
         VALUES ($1, CURRENT_DATE, 1, $2)
         ON CONFLICT (agent_id, date)
         DO UPDATE SET
           messages_handled = camille.agent_analytics.messages_handled + 1,
           tokens_consumed  = camille.agent_analytics.tokens_consumed + EXCLUDED.tokens_consumed`,
        [agentId, tt]
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[usage/record analytics]", m);
      warnings.push(`agent_analytics: ${m}`);
    }

    // ── Alertes ───────────────────────────────────────────────────────────────
    // Après l'enregistrement, jamais avant : une alerte ratée ne doit pas coûter
    // une consommation non comptée.
    if (owner) {
      try {
        const limit = await getPlanLimitDB(owner.plan ?? "free");
        const usedRes = await query(
          `SELECT COALESCE(total_tokens, 0) AS total
             FROM camille.token_usage WHERE agent_id = $1 AND period = $2`,
          [agentId, period]
        );
        await alerterQuota({
          agentId,
          userId: owner.user_id,
          agentName: owner.name,
          period,
          used: Number(usedRes.rows[0]?.total ?? 0),
          limit,
        });

        const sub = subscriptionState(owner.plan, owner.plan_expires_at);
        await alerterEcheance({
          agentId,
          userId: owner.user_id,
          agentName: owner.name,
          daysLeft: sub.daysLeft,
        });
      } catch (e) {
        console.error("[usage/record alertes]", e);
      }
    }

    return NextResponse.json({
      recorded: warnings.length === 0,
      period,
      total_tokens: tt,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    console.error("[POST /api/usage/record]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
