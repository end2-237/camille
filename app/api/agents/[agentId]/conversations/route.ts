// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents/[agentId]/conversations → la boîte de réception WhatsApp
//
// Un numéro connecté par l'API officielle de Meta ne fonctionne plus dans
// l'application WhatsApp Business du téléphone : sans cet écran, le commerçant
// n'avait AUCUN moyen de répondre depuis le numéro de sa boutique quand
// Camille lui passait la main. Une ligne par client, la plus récente d'abord.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(user.id, agentId, "ventes"))) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  try {
    const r = await query(
      `WITH m AS (
         SELECT contact_phone, role, content, created_at,
                ROW_NUMBER() OVER (PARTITION BY contact_phone ORDER BY created_at DESC) AS rn,
                MAX(created_at) FILTER (WHERE role = 'user') OVER (PARTITION BY contact_phone) AS dernier_client
           FROM camille.agent_conversations
          WHERE session_name = 'meta:' || $1::text
            AND created_at > NOW() - INTERVAL '30 days'
       )
       SELECT m.contact_phone AS phone, m.role, m.content, m.created_at, m.dernier_client,
              to_jsonb(c)->>'display_name' AS nom,
              COALESCE(c.human_takeover, false) AS takeover
         FROM m
         LEFT JOIN camille.contacts c ON c.agent_id = $1 AND c.phone = m.contact_phone
        WHERE m.rn = 1
        ORDER BY m.created_at DESC
        LIMIT 150`,
      [agentId]
    );
    return NextResponse.json({
      conversations: r.rows.map((x: Record<string, unknown>) => ({
        phone: String(x.phone || ""),
        nom: (x.nom as string) || null,
        dernier: String(x.content || "").replace(/\s+/g, " ").slice(0, 120),
        role: x.role,
        le: x.created_at,
        dernierClient: x.dernier_client,
        takeover: Boolean(x.takeover),
      })),
    });
  } catch (e) {
    return NextResponse.json({ conversations: [], error: (e as Error).message });
  }
}
