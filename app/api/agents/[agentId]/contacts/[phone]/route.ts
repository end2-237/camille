// GET  /api/agents/[agentId]/contacts/[phone]  → { exists, welcomed, language_pref }
// POST /api/agents/[agentId]/contacts/[phone]  → upsert contact (welcomed, language_pref)
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
      `SELECT phone, language_pref, welcomed_at
       FROM camille.contacts
       WHERE agent_id = $1 AND phone = $2`,
      [agentId, p]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ exists: false, welcomed: false, language_pref: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      exists:        true,
      welcomed:      row.welcomed_at !== null,
      language_pref: row.language_pref ?? null,
    });
  } catch (err) {
    console.error("[GET /api/agents/:id/contacts/:phone]", err);
    // En cas d'erreur DB : on fait comme si le contact existe pour éviter le double accueil.
    return NextResponse.json({ exists: true, welcomed: true, language_pref: null });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId, phone } = await params;
  const p = decodeURIComponent(phone);

  try {
    const body = await req.json() as {
      welcomed?:      boolean;
      language_pref?: string | null;
    };

    const { welcomed, language_pref } = body;

    // Upsert : crée le contact ou met à jour les champs fournis.
    await query(
      `INSERT INTO camille.contacts (agent_id, phone, welcomed_at, language_pref, created_at, updated_at)
       VALUES (
         $1, $2,
         $3,
         $4,
         NOW(), NOW()
       )
       ON CONFLICT (agent_id, phone) DO UPDATE SET
         welcomed_at   = CASE
                           WHEN $3 IS NOT NULL
                           THEN COALESCE(camille.contacts.welcomed_at, $3)
                           ELSE camille.contacts.welcomed_at
                         END,
         language_pref = CASE
                           WHEN $4 IS NOT NULL
                           THEN $4
                           ELSE camille.contacts.language_pref
                         END,
         updated_at    = NOW()`,
      [
        agentId,
        p,
        welcomed === true ? new Date().toISOString() : null,
        language_pref ?? null,
      ]
    );

    // Relire le contact mis à jour
    const result = await query(
      `SELECT phone, language_pref, welcomed_at
       FROM camille.contacts
       WHERE agent_id = $1 AND phone = $2`,
      [agentId, p]
    );

    const row = result.rows[0];
    return NextResponse.json({
      success:       true,
      exists:        true,
      welcomed:      row?.welcomed_at !== null,
      language_pref: row?.language_pref ?? null,
    });
  } catch (err) {
    console.error("[POST /api/agents/:id/contacts/:phone]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
