// GET /api/agents/by-session?session=NOM_SESSION
// Route publique utilisée par n8n pour récupérer toute la config d'un agent
// à partir du nom de session Waha.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveWelcome, sectorProfile } from "@/lib/sectorProfiles";

const AGENT_COLS = `
  COALESCE(to_jsonb(a)->>'conversion_mode', 'whatsapp') AS conversion_mode,
  a.id,
  a.name,
  a.compiled_prompt,
  a.target_model,
  a.primary_language,
  a.secondary_languages,
  a.brand_voice,
  a.business_name,
  a.sector,
  a.description,
  a.owner_name,
  a.owner_email,
  a.whatsapp_number,
  a.capabilities,
  a.status,
  a.website_url,
  a.location,
  a.latitude,
  a.longitude,
  a.level,
  a.out_of_scope_behavior,
  a.welcome_enabled,
  a.welcome_message,
  COALESCE(to_jsonb(a)->'media', '[]'::jsonb) AS media,
  (a.owner_password_hash IS NOT NULL) AS has_owner_password
`;

export async function GET(req: NextRequest) {
  const sessionName = req.nextUrl.searchParams.get("session");
  const fallbackId  = req.nextUrl.searchParams.get("fallback");

  if (!sessionName) {
    return NextResponse.json({ error: "Paramètre session manquant" }, { status: 400 });
  }

  try {
    let result = await query(
      `SELECT ${AGENT_COLS}
       FROM camille.whatsapp_sessions ws
       JOIN camille.agents a ON a.id = ws.agent_id
       WHERE ws.session_name = $1 AND a.status = 'active'`,
      [sessionName]
    );

    // Fallback : si la session n'est pas encore liée en DB, charge l'agent par ID
    if (result.rows.length === 0 && fallbackId) {
      result = await query(
        `SELECT ${AGENT_COLS} FROM camille.agents a WHERE a.id = $1 AND a.status = 'active'`,
        [fallbackId]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Aucun agent actif pour cette session" },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Désérialiser les champs JSON stockés en TEXT
    const parseJ = (v: unknown) => {
      if (!v) return null;
      if (typeof v === "object") return v;
      try { return JSON.parse(v as string); } catch { return null; }
    };

    return NextResponse.json({
      agent: {
        id:                 row.id,
        name:               row.name,
        compiled_prompt:    row.compiled_prompt,
        target_model:       row.target_model,
        primary_language:   row.primary_language,
        secondary_languages: parseJ(row.secondary_languages) ?? [],
        brand_voice:        row.brand_voice,
        business_name:      row.business_name,
        sector:             row.sector,
        description:        row.description,
        owner_name:         row.owner_name,
        owner_email:        row.owner_email,
        whatsapp_number:    row.whatsapp_number,
        capabilities:        parseJ(row.capabilities) ?? {},
        status:              row.status,
        website_url:         row.website_url ?? null,
        location:            row.location ?? null,
        latitude:            row.latitude != null ? Number(row.latitude) : null,
        longitude:           row.longitude != null ? Number(row.longitude) : null,
        // ── Config Niveau 1 ──
        level:                 row.level ?? 1,
        out_of_scope_behavior: row.out_of_scope_behavior ?? "site",
        welcome_enabled:       row.welcome_enabled !== false,
        welcome_message:       row.welcome_message ?? null,
        // welcome effectif (perso sinon défaut du secteur) + profil secteur pour le N2
        welcome_resolved:      resolveWelcome(row.sector, row.business_name, row.welcome_message),
        sector_mode:           sectorProfile(row.sector).mode,   // catalogue | services | media
        sector_auto:           sectorProfile(row.sector).auto,
        media:                 Array.isArray(row.media) ? row.media : (row.media ? JSON.parse(row.media) : []),
        has_owner_password:  row.has_owner_password === true,
      },
    });
  } catch (err) {
    console.error("[GET /api/agents/by-session]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
