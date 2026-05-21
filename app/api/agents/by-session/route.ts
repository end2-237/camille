// GET /api/agents/by-session?session=NOM_SESSION
// Route publique utilisée par n8n pour récupérer toute la config d'un agent
// à partir du nom de session Waha.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sessionName = req.nextUrl.searchParams.get("session");

  if (!sessionName) {
    return NextResponse.json({ error: "Paramètre session manquant" }, { status: 400 });
  }

  try {
    const result = await query(
      `SELECT
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
        (a.owner_password_hash IS NOT NULL) AS has_owner_password
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
        has_owner_password:  row.has_owner_password === true,
      },
    });
  } catch (err) {
    console.error("[GET /api/agents/by-session]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
