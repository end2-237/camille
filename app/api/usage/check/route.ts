// GET /api/usage/check?session=NAME
// Appelée par n8n avant chaque réponse pour vérifier si l'agent peut encore répondre.
// Route publique — pas d'auth requise (n8n appelle depuis le serveur).

import { NextRequest, NextResponse } from "next/server";
import { query }           from "@/lib/db";
import { currentPeriod }   from "@/lib/plans";
import { getPlanLimitDB, isUnlimitedTokens } from "@/lib/plans-db";

export async function GET(req: NextRequest) {
  const sessionName = req.nextUrl.searchParams.get("session");

  if (!sessionName) {
    return NextResponse.json({ error: "Paramètre session manquant" }, { status: 400 });
  }

  try {
    // Récupère agent_id + plan via la session Waha
    const agentRes = await query(
      `SELECT a.id, a.plan
       FROM camille.whatsapp_sessions ws
       JOIN camille.agents a ON a.id = ws.agent_id
       WHERE ws.session_name = $1 AND a.status = 'active'`,
      [sessionName]
    );

    if (agentRes.rows.length === 0) {
      return NextResponse.json({ allowed: true, reason: "no_agent" });
    }

    const { id: agentId, plan } = agentRes.rows[0];
    const period = currentPeriod();

    // Récupère la limite depuis la DB (avec cache 5 min)
    const limit = await getPlanLimitDB(plan);

    // Plan illimité → toujours autorisé
    if (isUnlimitedTokens(limit)) {
      return NextResponse.json({
        allowed: true,
        plan,
        used: null,
        limit: -1,
        remaining: -1,
        percent: 0,
      });
    }

    // Usage du mois courant
    const usageRes = await query(
      `SELECT COALESCE(total_tokens, 0) AS total_tokens
       FROM camille.token_usage
       WHERE agent_id = $1 AND period = $2`,
      [agentId, period]
    );

    const used = usageRes.rows.length > 0
      ? Number(usageRes.rows[0].total_tokens)
      : 0;

    const remaining = Math.max(0, limit - used);
    const percent   = Math.min(100, Math.round((used / limit) * 100));
    const allowed   = used < limit;

    return NextResponse.json({ allowed, plan, used, limit, remaining, percent });
  } catch (err) {
    console.error("[GET /api/usage/check]", err);
    // En cas d'erreur DB, on laisse passer plutôt que de bloquer le bot
    return NextResponse.json({ allowed: true, reason: "db_error" });
  }
}
