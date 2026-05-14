// POST /api/waha/connect — crée et démarre une session Waha pour un agent
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaCreateSession, wahaStartSession, wahaGetSession, makeSessionName } from "@/lib/waha";

const MAX_SESSIONS = 3;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });

  // Vérifier que l'agent appartient à l'user
  const agentRes = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  if (agentRes.rows.length === 0) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  // Vérifier la limite de 3 sessions
  const countRes = await query(
    "SELECT COUNT(*) FROM camille.whatsapp_sessions WHERE user_id = $1",
    [user.id]
  );
  const count = parseInt(countRes.rows[0].count, 10);
  if (count >= MAX_SESSIONS) {
    return NextResponse.json(
      { error: "Limite de 3 sessions atteinte. Déconnectez un agent pour en ajouter un." },
      { status: 403 }
    );
  }

  // Vérifier si une session existe déjà pour cet agent
  const existing = await query(
    "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1",
    [agentId]
  );

  const sessionName = existing.rows[0]?.session_name ?? makeSessionName(agentId);

  try {
    // Créer la session Waha si elle n'existe pas encore
    const wahaSession = await wahaGetSession(sessionName);
    if (!wahaSession) {
      await wahaCreateSession(sessionName);
    }

    // Démarrer la session (idempotent)
    await wahaStartSession(sessionName);

    // Upsert en DB
    await query(
      `INSERT INTO camille.whatsapp_sessions (session_name, agent_id, user_id, status)
       VALUES ($1, $2, $3, 'STARTING')
       ON CONFLICT (session_name) DO UPDATE
         SET agent_id = $2, user_id = $3, status = 'STARTING', updated_at = NOW()`,
      [sessionName, agentId, user.id]
    );

    return NextResponse.json({ session_name: sessionName });
  } catch (err) {
    console.error("[POST /api/waha/connect]", err);
    return NextResponse.json({ error: "Erreur Waha" }, { status: 500 });
  }
}
