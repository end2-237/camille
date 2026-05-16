// POST /api/usage/record
// Appelée par n8n après chaque réponse Groq pour enregistrer les tokens consommés.
// Route publique — appelée depuis le serveur n8n.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPeriod } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, prompt_tokens, completion_tokens, total_tokens } = body as {
      session:           string;
      prompt_tokens:     number;
      completion_tokens: number;
      total_tokens:      number;
    };

    if (!session || total_tokens == null) {
      return NextResponse.json(
        { error: "Champs requis : session, total_tokens" },
        { status: 400 }
      );
    }

    // Récupère l'agent_id depuis la session
    const agentRes = await query(
      `SELECT a.id FROM camille.whatsapp_sessions ws
       JOIN camille.agents a ON a.id = ws.agent_id
       WHERE ws.session_name = $1`,
      [session]
    );

    if (agentRes.rows.length === 0) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }

    const agentId = agentRes.rows[0].id;
    const period  = currentPeriod();
    const pt = Number(prompt_tokens)     || 0;
    const ct = Number(completion_tokens) || 0;
    const tt = Number(total_tokens)      || 0;

    // Upsert : crée l'entrée si inexistante, sinon additionne les tokens
    await query(
      `INSERT INTO camille.token_usage
         (agent_id, period, prompt_tokens, completion_tokens, total_tokens, last_updated)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (agent_id, period)
       DO UPDATE SET
         prompt_tokens     = camille.token_usage.prompt_tokens     + EXCLUDED.prompt_tokens,
         completion_tokens = camille.token_usage.completion_tokens + EXCLUDED.completion_tokens,
         total_tokens      = camille.token_usage.total_tokens      + EXCLUDED.total_tokens,
         last_updated      = NOW()`,
      [agentId, period, pt, ct, tt]
    );

    return NextResponse.json({ recorded: true, period, total_tokens: tt });
  } catch (err) {
    console.error("[POST /api/usage/record]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
