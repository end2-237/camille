// POST /api/waha/disconnect — arrête et supprime la session Waha d'un agent
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaStopSession, wahaDeleteSession } from "@/lib/waha";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });

  const sessionRes = await query(
    "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1 AND user_id = $2",
    [agentId, user.id]
  );

  if (sessionRes.rows.length === 0) {
    return NextResponse.json({ success: true }); // déjà déconnecté
  }

  const { session_name } = sessionRes.rows[0];

  try {
    await wahaStopSession(session_name);
    await wahaDeleteSession(session_name);
  } catch {
    // On continue même si Waha échoue (session peut déjà être supprimée)
  }

  await query(
    "DELETE FROM camille.whatsapp_sessions WHERE session_name = $1",
    [session_name]
  );

  return NextResponse.json({ success: true });
}
