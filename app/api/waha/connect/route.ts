// POST /api/waha/connect — démarre une session Camille Core pour un agent
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaStartSession, makeSessionName } from "@/lib/waha";

// Limite de sessions WhatsApp simultanées par utilisateur.
// Configurable via l'env MAX_WHATSAPP_SESSIONS (ex: "20" pour la phase d'essais).
const MAX_SESSIONS = Math.max(1, parseInt(process.env.MAX_WHATSAPP_SESSIONS ?? "5", 10) || 5);

// Statuts considérés comme "session morte" : ils ne consomment pas de quota.
const DEAD_STATUSES = ["STOPPED", "FAILED"];

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });

    const agentRes = await query(
      "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
      [agentId, user.id]
    );
    if (agentRes.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }

    // Quota : on ne compte QUE les sessions vivantes des AUTRES agents.
    // - exclure l'agent courant : reconnecter un agent déjà lié ne doit jamais être bloqué
    // - exclure les sessions mortes (STOPPED/FAILED) : elles ne consomment rien côté Camille Core
    const countRes = await query(
      `SELECT COUNT(*) FROM camille.whatsapp_sessions
       WHERE user_id = $1
         AND agent_id IS DISTINCT FROM $2
         AND COALESCE(status, '') <> ALL($3::text[])`,
      [user.id, agentId, DEAD_STATUSES]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    if (count >= MAX_SESSIONS) {
      return NextResponse.json(
        {
          error: `Limite de ${MAX_SESSIONS} session(s) WhatsApp atteinte. Déconnectez un agent pour en ajouter un.`,
        },
        { status: 403 }
      );
    }

    const existing = await query(
      "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1",
      [agentId]
    );
    const sessionName = existing.rows[0]?.session_name ?? makeSessionName(agentId);

    // Camille Core : un seul appel suffit pour créer + démarrer la session
    await wahaStartSession(sessionName);

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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
