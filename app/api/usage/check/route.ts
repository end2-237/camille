// GET /api/usage/check?session=NAME
// Appelée par n8n avant chaque réponse pour vérifier si l'agent peut encore répondre.
// Route interne (en-tête X-Camille-Key) — n8n appelle depuis le serveur.

import { NextRequest, NextResponse } from "next/server";
import { appelInterne, refusInterne } from "@/lib/interne";
import { query }           from "@/lib/db";
import { etatQuota }       from "@/lib/quota";

export async function GET(req: NextRequest) {
  if (!appelInterne(req)) return refusInterne();
  const sessionName = req.nextUrl.searchParams.get("session");

  if (!sessionName) {
    return NextResponse.json({ error: "Paramètre session manquant" }, { status: 400 });
  }

  try {
    // Récupère l'agent actif de la session Waha
    const agentRes = await query(
      `SELECT a.id
       FROM camille.whatsapp_sessions ws
       JOIN camille.agents a ON a.id = ws.agent_id
       WHERE ws.session_name = $1 AND a.status = 'active'`,
      [sessionName]
    );

    if (agentRes.rows.length === 0) {
      return NextResponse.json({ allowed: true, reason: "no_agent" });
    }

    // La règle (abonnement, puis quota) vit dans lib/quota.ts, partagée avec
    // le transport Meta.
    return NextResponse.json(await etatQuota(agentRes.rows[0].id));
  } catch (err) {
    console.error("[GET /api/usage/check]", err);
    // En cas d'erreur DB, on laisse passer plutôt que de bloquer le bot
    return NextResponse.json({ allowed: true, reason: "db_error" });
  }
}
