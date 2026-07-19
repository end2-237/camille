// POST /api/usage/record
// Appelée par n8n après chaque réponse Groq pour enregistrer les tokens consommés.
// Route publique — appelée depuis le serveur n8n.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPeriod } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, agentId: agentIdInput, prompt_tokens, completion_tokens, total_tokens } = body as {
      session?:          string;
      agentId?:          string;
      prompt_tokens:     number;
      completion_tokens: number;
      total_tokens:      number;
    };

    if ((!session && !agentIdInput) || total_tokens == null) {
      return NextResponse.json(
        { error: "Champs requis : (session ou agentId) et total_tokens" },
        { status: 400 }
      );
    }

    // agent_id : direct (robuste) OU résolu depuis la session
    let agentId = agentIdInput || "";
    if (!agentId && session) {
      const agentRes = await query(
        `SELECT a.id FROM camille.whatsapp_sessions ws
         JOIN camille.agents a ON a.id = ws.agent_id
         WHERE ws.session_name = $1`,
        [session]
      );
      if (agentRes.rows.length === 0) {
        return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
      }
      agentId = agentRes.rows[0].id;
    }

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

    // Analytics du jour : +1 message, + tokens (alimente les Statistiques et l'accueil)
    try {
      await query(
        `INSERT INTO camille.agent_analytics (agent_id, date, messages_handled, tokens_consumed)
         VALUES ($1, CURRENT_DATE, 1, $2)
         ON CONFLICT (agent_id, date)
         DO UPDATE SET
           messages_handled = camille.agent_analytics.messages_handled + 1,
           tokens_consumed  = camille.agent_analytics.tokens_consumed + EXCLUDED.tokens_consumed`,
        [agentId, tt]
      );
    } catch (e) {
      console.error("[usage/record analytics]", e); // n'empêche jamais l'enregistrement des tokens
    }

    return NextResponse.json({ recorded: true, period, total_tokens: tt });
  } catch (err) {
    console.error("[POST /api/usage/record]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
