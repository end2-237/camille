// GET /api/waha/status?agentId=ID — statut de la session Waha d'un agent
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaGetSession } from "@/lib/waha";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });

  // Récupère la session en DB
  const sessionRes = await query(
    "SELECT session_name, status, phone_number FROM camille.whatsapp_sessions WHERE agent_id = $1 AND user_id = $2",
    [agentId, user.id]
  );

  if (sessionRes.rows.length === 0) {
    return NextResponse.json({ connected: false, status: "STOPPED" });
  }

  const { session_name, phone_number } = sessionRes.rows[0];

  // Récupère le statut temps réel depuis Waha
  try {
    const wahaSession = await wahaGetSession(session_name);
    if (!wahaSession) {
      return NextResponse.json({ connected: false, status: "STOPPED", session_name });
    }

    const status = wahaSession.status; // WORKING | SCAN_QR_CODE | STARTING | STOPPED | FAILED
    const connected = status === "WORKING";
    const phoneFromWaha = wahaSession.me?.id?.replace("@c.us", "") ?? phone_number;

    // Mettre à jour le statut en DB si changé
    if (connected && phoneFromWaha) {
      await query(
        "UPDATE camille.whatsapp_sessions SET status = $1, phone_number = $2, updated_at = NOW() WHERE session_name = $3",
        [status, phoneFromWaha, session_name]
      );
    } else {
      await query(
        "UPDATE camille.whatsapp_sessions SET status = $1, updated_at = NOW() WHERE session_name = $2",
        [status, session_name]
      );
    }

    return NextResponse.json({
      connected,
      status,
      session_name,
      phone_number: connected ? phoneFromWaha : null,
    });
  } catch (err) {
    console.error("[GET /api/waha/status]", err);
    return NextResponse.json({ connected: false, status: "ERROR", session_name });
  }
}
