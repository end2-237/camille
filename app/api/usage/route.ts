// GET /api/usage?agentId=UUID  — usage du mois courant pour le dashboard
// Route authentifiée — appelée par le dashboard Camille.

import { NextRequest, NextResponse }         from "next/server";
import { getUserFromRequest }                 from "@/lib/auth-server";
import { query }                             from "@/lib/db";
import { currentPeriod }                     from "@/lib/plans";
import { getPlanLimitDB, getPlanLabelDB, isUnlimitedTokens, getPlansFromDB } from "@/lib/plans-db";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });

    // Vérifie que l'agent appartient à l'utilisateur et récupère son plan
    const agentRes = await query(
      "SELECT id, plan FROM camille.agents WHERE id = $1 AND user_id = $2",
      [agentId, user.id]
    );
    if (agentRes.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }

    const planId    = agentRes.rows[0].plan ?? "free";
    const period    = currentPeriod();

    // Données du plan depuis la DB
    const limit     = await getPlanLimitDB(planId);
    const label     = await getPlanLabelDB(planId);
    const unlimited = isUnlimitedTokens(limit);

    // Usage mois courant
    const usageRes = await query(
      `SELECT
         COALESCE(prompt_tokens, 0)     AS prompt_tokens,
         COALESCE(completion_tokens, 0) AS completion_tokens,
         COALESCE(total_tokens, 0)      AS total_tokens
       FROM camille.token_usage
       WHERE agent_id = $1 AND period = $2`,
      [agentId, period]
    );

    const row = usageRes.rows[0] ?? {
      prompt_tokens: 0, completion_tokens: 0, total_tokens: 0,
    };

    const used      = Number(row.total_tokens);
    const remaining = unlimited ? -1 : Math.max(0, limit - used);
    const percent   = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

    // Historique des 6 derniers mois
    const histRes = await query(
      `SELECT period, total_tokens
       FROM camille.token_usage
       WHERE agent_id = $1
       ORDER BY period DESC
       LIMIT 6`,
      [agentId]
    );

    // Tous les plans actifs depuis la DB (pour afficher le tableau de comparaison)
    const { plans: allPlans } = await getPlansFromDB();

    return NextResponse.json({
      plan: { id: planId, label, limit, unlimited },
      current: {
        period,
        prompt_tokens:     Number(row.prompt_tokens),
        completion_tokens: Number(row.completion_tokens),
        total_tokens:      used,
        remaining,
        percent,
      },
      history: histRes.rows.map((r) => ({
        period:       r.period,
        total_tokens: Number(r.total_tokens),
      })),
      plans: allPlans.map((p) => ({
        id:             p.id,
        label:          p.label,
        monthly_tokens: p.monthly_tokens,
        price_xaf:      p.price_xaf,
        price_eur:      p.price_eur,
        current:        p.id === planId,
      })),
    });
  } catch (err) {
    console.error("[GET /api/usage]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
