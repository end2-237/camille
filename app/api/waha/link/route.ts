// POST /api/waha/link — lie manuellement une session Camille Core à un agent
// Body: { agentId: string, sessionName: string }
// Authentification requise.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaSetWebhook } from "@/lib/waha";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId, sessionName } = await req.json();
  if (!agentId || !sessionName) {
    return NextResponse.json({ error: "agentId et sessionName requis" }, { status: 400 });
  }

  // Vérifier que l'agent appartient bien à l'utilisateur
  const agentCheck = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  if (!agentCheck.rows.length) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  await query(
    `INSERT INTO camille.whatsapp_sessions (session_name, agent_id, user_id, status)
     VALUES ($1, $2, $3, 'CONNECTED')
     ON CONFLICT (session_name) DO UPDATE
       SET agent_id   = $2,
           user_id    = $3,
           status     = 'CONNECTED',
           updated_at = NOW()`,
    [sessionName, agentId, user.id]
  );

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
