// GET /api/agents/by-session?session=NOM_SESSION
// Route publique utilisée par n8n pour récupérer le system prompt
// d'un agent à partir du nom de session Waha.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sessionName = req.nextUrl.searchParams.get("session");

  if (!sessionName) {
    return NextResponse.json({ error: "Paramètre session manquant" }, { status: 400 });
  }

  try {
    const result = await query(
      `SELECT a.id, a.name, a.compiled_prompt, a.target_model,
              a.primary_language, a.brand_voice, a.status
       FROM camille.whatsapp_sessions ws
       JOIN camille.agents a ON a.id = ws.agent_id
       WHERE ws.session_name = $1 AND a.status = 'active'`,
      [sessionName]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Aucun agent actif pour cette session" },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent: result.rows[0] });
  } catch (err) {
    console.error("[GET /api/agents/by-session]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
