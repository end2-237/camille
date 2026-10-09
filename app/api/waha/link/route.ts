// POST /api/waha/link — lie manuellement une session Camille Core à un agent
// Body: { agentId: string, sessionName: string }
// Authentification requise.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { wahaSetWebhook } from "@/lib/waha";
import { activerAgentSiBrouillon } from "@/lib/agent-activation";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId, sessionName } = await req.json();
  if (!agentId || !sessionName) {
    return NextResponse.json({ error: "agentId et sessionName requis" }, { status: 400 });
  }

  // Vérifier que l'agent appartient bien à l'utilisateur
  const agentCheck = await query(
    "SELECT id, user_id FROM camille.agents WHERE id = $1 AND status != 'archived'",
    [agentId]
  );
  const proprio = agentCheck.rows[0]?.user_id as string | undefined;
  if (!proprio || !(await peut(user.id, agentId, "reglages"))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  // Une session déjà liée au compte d'un AUTRE utilisateur ne se reprend pas :
  // le nom de session se déduit de l'identifiant d'agent (public), et la
  // réécrire détournait les messages des clients de ce commerçant.
  const lien = await query(
    `INSERT INTO camille.whatsapp_sessions (session_name, agent_id, user_id, status)
     VALUES ($1, $2, $3, 'CONNECTED')
     ON CONFLICT (session_name) DO UPDATE
       SET agent_id   = $2,
           user_id    = $3,
           status     = 'CONNECTED',
           updated_at = NOW()
     WHERE camille.whatsapp_sessions.user_id = $3
     RETURNING session_name`,
    [sessionName, agentId, proprio]
  );
  if (!lien.rows.length) {
    return NextResponse.json({ error: "Cette session appartient à un autre compte" }, { status: 409 });
  }

  // Lier une session à la main, c'est déclarer l'agent en service. Le laisser
  // en brouillon ferait échouer n8n sur « Aucun agent actif pour cette
  // session » alors que tout le reste du branchement est correct.
  await activerAgentSiBrouillon(agentId);

  // Auto-config du webhook n8n selon le NIVEAU de l'agent (ou son webhook propre)
  const wh = await query(
    "SELECT n8n_webhook_url, level FROM camille.agents WHERE id = $1",
    [agentId]
  );
  await wahaSetWebhook(
    sessionName,
    wh.rows[0]?.n8n_webhook_url ?? null,
    wh.rows[0]?.level ?? 1
  );

  return NextResponse.json({ success: true, session_name: sessionName, agent_id: agentId });
}
