// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents/[agentId]/activite → les derniers échanges WhatsApp de l'agent
//
// Pour le panneau « Conversations en direct » de l'accueil : quelques messages
// récents, client et agent, numéros masqués. Réservé au propriétaire.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const own = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  if (!own.rows.length) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  try {
    const r = await query(
      `SELECT c.role, c.content, c.created_at, c.contact_phone
         FROM camille.agent_conversations c
        WHERE (c.session_name IN (SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1)
               OR c.session_name = 'meta:' || $1::text)
          AND c.role IN ('user', 'assistant')
          AND c.content NOT LIKE '[%'
        ORDER BY c.created_at DESC
        LIMIT 6`,
      [agentId]
    );
    const messages = r.rows.reverse().map((m: Record<string, unknown>) => {
      const tel = String(m.contact_phone || "").replace(/@.*$/, "").replace(/[^0-9]/g, "");
      return {
        role: m.role === "assistant" ? "agent" : "client",
        texte: String(m.content || "").replace(/\s+/g, " ").slice(0, 140),
        le: m.created_at,
        // Le numéro n'apparaît jamais en entier sur un écran qu'on peut montrer.
        contact: tel ? `…${tel.slice(-3)}` : "",
      };
    });
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
