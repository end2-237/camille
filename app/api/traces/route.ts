// ─────────────────────────────────────────────────────────────────────────────
// POST /api/traces — enregistre la trace de décision d'UN tour de conversation.
// Appelé par n8n après chaque réponse. Ne bloque jamais le workflow :
// en cas d'erreur on renvoie 200 avec { ok: false }.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { appelInterne, refusInterne } from "@/lib/interne";

export async function POST(req: NextRequest) {
  // Réservé au workflow (clé interne).
  if (!appelInterne(req)) return refusInterne();
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

    const COLONNES = [
      "agent_id", "session_name", "contact_phone", "user_msg",
      "search_q", "search_off", "search_kind",
      "llm_intent", "final_intent", "corrected",
      "resolved_product", "reply_mode", "items", "cart_size", "tokens", "latency_ms",
      "raisonnement", "certitude", "ambigu",
      // `raccourci` arrive par migration_traces_reflexion.sql. Le workflow
      // l'envoie depuis le nœud « Faut-il le modèle ? » ; il n'était stocké
      // nulle part, et c'est lui qui dit si un tour sans token est un raccourci
      // réussi ou un 429 subi. Sur une base non migrée, l'insertion est rejouée
      // sans lui plutôt que de faire perdre toute la trace.
      "raccourci",
    ];

    const inserer = (cols: string[], vals: unknown[]) =>
      query(
        `INSERT INTO camille.conversation_traces (${cols.join(", ")})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
        vals
      );

    const valeurs: unknown[] = [
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
        (String(b.raccourci ?? "") || null)?.slice(0, 120) || null,
      ];

    try {
      await inserer(COLONNES, valeurs);
    } catch (e) {
      // 42703 = colonne inexistante : la base n'a pas encore la migration.
      // On réinsère sans `raccourci` — une trace amputée vaut mieux qu'aucune.
      if ((e as { code?: string }).code !== "42703") throw e;
      await inserer(COLONNES.slice(0, -1), valeurs.slice(0, -1));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/traces]", (err as Error).message);
    // Jamais d'erreur renvoyée à n8n : la trace ne doit pas casser une conversation.
    return NextResponse.json({ ok: false });
  }
}
