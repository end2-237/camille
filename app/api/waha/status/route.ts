// GET /api/waha/status?agentId=ID — statut de la session Camille Core d'un agent
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaGetSession } from "@/lib/waha";
import { activerAgentSiBrouillon } from "@/lib/agent-activation";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });

    const sessionRes = await query(
      "SELECT session_name, status, phone_number FROM camille.whatsapp_sessions WHERE agent_id = $1 AND user_id = $2",
      [agentId, user.id]
    );

    if (sessionRes.rows.length === 0) {
      return NextResponse.json({ connected: false, status: "STOPPED" });
    }

    const { session_name, phone_number } = sessionRes.rows[0];

    const coreSession = await wahaGetSession(session_name);
    if (!coreSession) {
      return NextResponse.json({ connected: false, status: "STOPPED", session_name });
    }

    // wahaGetSession mappe déjà CONNECTED → WORKING
    const status    = coreSession.status;
    const connected = status === "WORKING";
    const phoneFromCore = coreSession.me?.id?.replace("@c.us", "") ?? phone_number;

    // Le téléphone est couplé : l'agent a fini sa mise en route. S'il était
    // resté en brouillon, n8n le refusait (« Aucun agent actif pour cette
    // session ») et aucun message n'était traité.
    if (connected) await activerAgentSiBrouillon(agentId);

    if (connected && phoneFromCore) {
      await query(
        "UPDATE camille.whatsapp_sessions SET status = $1, phone_number = $2, updated_at = NOW() WHERE session_name = $3",
        [status, phoneFromCore, session_name]
      );
    } else {
      await query(
        "UPDATE camille.whatsapp_sessions SET status = $1, updated_at = NOW() WHERE session_name = $2",
        [status, session_name]
      );
    }

    return NextResponse.json({ connected, status, session_name, phone_number: connected ? phoneFromCore : null });
  } catch (err) {
    console.error("[GET /api/waha/status]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
