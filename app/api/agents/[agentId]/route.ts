import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ agentId: string }> };

// ── GET /api/agents/:id ───────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { agentId } = await params;

  try {
    const result = await query(
      "SELECT * FROM camille.agents WHERE id = $1 AND user_id = $2",
      [agentId, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }

    return NextResponse.json({ agent: result.rows[0] });
  } catch (err) {
    console.error("[GET /api/agents/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── PATCH /api/agents/:id ─────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { agentId } = await params;

  try {
    const updates = await req.json();

    const allowed = [
      "name","tagline","brand_voice","primary_language","secondary_languages",
      "avatar_emoji","avatar_url","business_name","sector","description",
      "website_url","location","target_audience","owner_name","owner_email",
      "whatsapp_number","business_description","products_services","pricing_info",
      "business_hours","policies","faq","forbidden_topics","support_whatsapp",
      "content_generation","image_creation","community_management",
      "strategy_advisor","lead_capture","proactive_messaging","compiled_prompt",
      "prompt_generated_at","target_model","estimated_tokens","prompt_version",
      "status",
    ];

    const fields = Object.keys(updates).filter((k) => allowed.includes(k));
    if (fields.length === 0) {
      return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 });
    }

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const values = fields.map((f) => updates[f]);
    values.push(new Date().toISOString(), agentId, user.id);

    const result = await query(
      `UPDATE camille.agents
       SET ${setClauses}, updated_at = $${fields.length + 1}
       WHERE id = $${fields.length + 2} AND user_id = $${fields.length + 3}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }

    return NextResponse.json({ agent: result.rows[0] });
  } catch (err) {
    console.error("[PATCH /api/agents/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── DELETE /api/agents/:id (soft delete) ──────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { agentId } = await params;

  try {
    await query(
      `UPDATE camille.agents
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
