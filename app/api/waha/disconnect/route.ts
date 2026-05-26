// POST /api/waha/disconnect — arrête la session Camille Core et met à jour la DB.
// La session Camille Core garde les fichiers d'auth sur le volume → pas besoin de re-scanner le QR.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaStopSession } from "@/lib/waha";

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

    // Arrêter la session sur Camille Core (les fichiers LocalAuth restent sur le volume)
    try { await wahaStopSession(session_name); } catch {}

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
