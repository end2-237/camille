// GET  /api/agents/[agentId]/contacts/[phone]  → { exists, welcomed, language_pref, human_takeover }
// POST /api/agents/[agentId]/contacts/[phone]  → upsert contact
// Route publique — appelée par n8n (pas de JWT requis, phone déjà authentifié côté WAHA).

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string; phone: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { agentId, phone } = await params;
  const p = decodeURIComponent(phone);

  try {
    const result = await query(
      `SELECT phone, language_pref, welcomed_at, human_takeover, takeover_requested_at, takeover_message
       FROM camille.contacts
       WHERE agent_id = $1 AND phone = $2`,
      [agentId, p]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ exists: false, welcomed: false, language_pref: null, human_takeover: false });
    }

    const row = result.rows[0];
    return NextResponse.json({
      exists:                true,
      welcomed:              row.welcomed_at !== null,
      language_pref:         row.language_pref ?? null,
      human_takeover:        row.human_takeover ?? false,
      takeover_requested_at: row.takeover_requested_at ?? null,
      takeover_message:      row.takeover_message ?? null,
    });
  } catch (err) {
    console.error("[GET /api/agents/:id/contacts/:phone]", err);
    return NextResponse.json({ exists: true, welcomed: true, language_pref: null, human_takeover: false });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId, phone } = await params;
  const p = decodeURIComponent(phone);

  try {
    const body = await req.json() as {
      welcomed?:             boolean;
      language_pref?:        string | null;
      human_takeover?:       boolean;
      takeover_requested_at?: string | null;
      takeover_message?:     string | null;
    };

    const { welcomed, language_pref, human_takeover, takeover_requested_at, takeover_message } = body;

    await query(
      `INSERT INTO camille.contacts
         (agent_id, phone, welcomed_at, language_pref, human_takeover, takeover_requested_at, takeover_message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (agent_id, phone) DO UPDATE SET
         welcomed_at            = CASE WHEN $3 IS NOT NULL THEN COALESCE(camille.contacts.welcomed_at, $3) ELSE camille.contacts.welcomed_at END,
         language_pref          = CASE WHEN $4 IS NOT NULL THEN $4 ELSE camille.contacts.language_pref END,
         human_takeover         = CASE WHEN $5 IS NOT NULL THEN $5 ELSE camille.contacts.human_takeover END,
         takeover_requested_at  = CASE WHEN $6 IS NOT NULL THEN $6::TIMESTAMPTZ ELSE camille.contacts.takeover_requested_at END,
         takeover_message       = CASE WHEN $7 IS NOT NULL THEN $7 ELSE camille.contacts.takeover_message END,
         updated_at             = NOW()`,
      [
        agentId,
        p,
        welcomed === true ? new Date().toISOString() : null,
        language_pref ?? null,
        human_takeover ?? null,
        takeover_requested_at ?? null,
        takeover_message ?? null,
      ]
    );

    const result = await query(
      `SELECT phone, language_pref, welcomed_at, human_takeover, takeover_requested_at
       FROM camille.contacts WHERE agent_id = $1 AND phone = $2`,
      [agentId, p]
    );

    const row = result.rows[0];
    return NextResponse.json({
      success:        true,
      exists:         true,
      welcomed:       row?.welcomed_at !== null,
      language_pref:  row?.language_pref ?? null,
      human_takeover: row?.human_takeover ?? false,
    });
  } catch (err) {
    console.error("[POST /api/agents/:id/contacts/:phone]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
