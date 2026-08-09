// ─────────────────────────────────────────────────────────────────────────────
// POST /api/traces — enregistre la trace de décision d'UN tour de conversation.
// Appelé par n8n après chaque réponse. Ne bloque jamais le workflow :
// en cas d'erreur on renvoie 200 avec { ok: false }.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    // agent_id : direct, sinon résolu depuis la session WhatsApp
    let agentId: string | null = b.agentId || null;
    if (!agentId && b.session) {
      const r = await query(
        "SELECT agent_id FROM camille.whatsapp_sessions WHERE session_name = $1",
        [b.session]
      );
      agentId = r.rows[0]?.agent_id ?? null;
    }

    await query(
      `INSERT INTO camille.conversation_traces
        (agent_id, session_name, contact_phone, user_msg,
         search_q, search_off, search_kind,
         llm_intent, final_intent, corrected,
         resolved_product, reply_mode, items, cart_size, tokens, latency_ms,
         raisonnement, certitude, ambigu)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        agentId,
        b.session ?? null,
        b.phone ?? null,
        (b.userMsg ?? "").slice(0, 500),
        (b.searchQ ?? "").slice(0, 200),
        Number(b.searchOff) || 0,
        b.searchKind ?? null,
        b.llmIntent ?? null,
        b.finalIntent ?? null,
        !!b.corrected,
        (b.product ?? "").slice(0, 200),
        b.replyMode ?? null,
        Number(b.items) || 0,
        Number(b.cartSize) || 0,
        Number(b.tokens) || 0,
        Number(b.latencyMs) || 0,
        // Couche de réflexion. Sans ces trois-là, on relit la trace en sachant
        // ce que l'agent a décidé mais jamais sur quoi il s'est fondé.
        //
        // Le champ reçu s'appelle `analyse`, la colonne `raisonnement` : ANALYSE
        // est un mot réservé de PostgreSQL. On garde le nom d'origine côté fil
        // pour ne pas obliger à réimporter le workflow déjà en production —
        // seule la base avait besoin d'un autre nom.
        (b.analyse ?? "").slice(0, 300) || null,
        b.certitude != null && isFinite(Number(b.certitude)) ? Number(b.certitude) : null,
        b.ambigu === true || b.ambigu === "true",
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/traces]", (err as Error).message);
    // Jamais d'erreur renvoyée à n8n : la trace ne doit pas casser une conversation.
    return NextResponse.json({ ok: false });
  }
}
