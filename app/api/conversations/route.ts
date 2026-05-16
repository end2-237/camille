// GET  /api/conversations?session=NAME&limit=20  — récupère l'historique de conversation
// POST /api/conversations                         — sauvegarde un ou plusieurs messages
// Ces routes sont appelées par n8n pour gérer le contexte conversationnel du bot.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/* ─── GET ─────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const session  = req.nextUrl.searchParams.get("session");
  const phone    = req.nextUrl.searchParams.get("phone");   // ex: 33612345678@c.us
  const limitStr = req.nextUrl.searchParams.get("limit") ?? "20";
  const limit    = Math.min(parseInt(limitStr, 10) || 20, 100);

  if (!session) {
    return NextResponse.json({ error: "Paramètre session manquant" }, { status: 400 });
  }

  try {
    const params: unknown[] = [session, limit];
    let wherePhone = "";
    if (phone) {
      wherePhone = " AND c.contact_phone = $3";
      params.push(phone);
    }

    const result = await query(
      `SELECT c.id, c.contact_phone, c.role, c.content, c.created_at
       FROM camille.agent_conversations c
       JOIN camille.whatsapp_sessions ws ON ws.session_name = c.session_name
       WHERE c.session_name = $1${wherePhone}
       ORDER BY c.created_at DESC
       LIMIT $2`,
      params
    );

    // On retourne en ordre chronologique (le SELECT est DESC pour LIMIT efficace)
    const messages = result.rows.reverse().map((r) => ({
      id:            r.id,
      contact_phone: r.contact_phone,
      role:          r.role,          // "user" | "assistant"
      content:       r.content,
      created_at:    r.created_at,
    }));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[GET /api/conversations]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ─── POST ────────────────────────────────────────────────────────────────── */
// Body attendu :
// {
//   session: "cam...",
//   phone: "33612345678@c.us",
//   messages: [
//     { role: "user",      content: "Bonjour !" },
//     { role: "assistant", content: "Bonjour, comment puis-je vous aider ?" }
//   ]
// }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, phone, messages } = body as {
      session:  string;
      phone:    string;
      messages: { role: string; content: string }[];
    };

    if (!session || !phone || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Champs requis : session, phone, messages[]" },
        { status: 400 }
      );
    }

    // Insérer chaque message (ON CONFLICT DO NOTHING pour idempotence)
    for (const msg of messages) {
      if (!["user", "assistant"].includes(msg.role)) continue;
      await query(
        `INSERT INTO camille.agent_conversations (session_name, contact_phone, role, content)
         VALUES ($1, $2, $3, $4)`,
        [session, phone, msg.role, msg.content]
      );
    }

    // Nettoyer les anciens messages (garder les 200 derniers par contact)
    await query(
      `DELETE FROM camille.agent_conversations
       WHERE id IN (
         SELECT id FROM camille.agent_conversations
         WHERE session_name = $1 AND contact_phone = $2
         ORDER BY created_at DESC
         OFFSET 200
       )`,
      [session, phone]
    );

    return NextResponse.json({ saved: messages.length });
  } catch (err) {
    console.error("[POST /api/conversations]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
