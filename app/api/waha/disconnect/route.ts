// POST /api/waha/disconnect — marque la session comme arrêtée en DB uniquement.
// IMPORTANT : on ne touche PAS à la session WAHA (pas de stop, pas de delete).
// La session WhatsApp reste vivante sur le VPS — pas besoin de re-scanner le QR.
// Seul Coolify/WAHA peut stopper la session physiquement.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });

    const sessionRes = await query(
      "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1 AND user_id = $2",
      [agentId, user.id]
    );

    if (sessionRes.rows.length === 0) {
      return NextResponse.json({ success: true });
    }

    const { session_name } = sessionRes.rows[0];

    // On met uniquement le statut en DB à STOPPED.
    // On n'appelle JAMAIS wahaStopSession ni wahaDeleteSession :
    // la session WAHA (et l'auth WhatsApp) restent intactes côté VPS.
    await query(
      "UPDATE camille.whatsapp_sessions SET status = 'STOPPED', updated_at = NOW() WHERE session_name = $1",
      [session_name]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/waha/disconnect]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
