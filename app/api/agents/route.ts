import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";
import type { AgentFormData, SystemPromptConfig } from "@/types/agent";

// ── GET /api/agents ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT * FROM camille.agents
       WHERE user_id = $1 AND status != 'archived'
       ORDER BY created_at DESC`,
      [user.id]
    );
    return NextResponse.json({ agents: result.rows });
  } catch (err) {
    console.error("[GET /api/agents]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST /api/agents ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body: { formData: AgentFormData; systemPrompt: SystemPromptConfig } =
      await req.json();
    const { formData, systemPrompt } = body;

    if (!formData || !systemPrompt) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO camille.agents (
        user_id, name, tagline, brand_voice, primary_language,
        secondary_languages, avatar_emoji,
        business_name, sector, description, website_url,
        location, target_audience, owner_name, owner_email, whatsapp_number,
        business_description, products_services, pricing_info,
        business_hours, policies, faq, forbidden_topics,
        support_whatsapp, content_generation, image_creation,
        community_management, strategy_advisor, lead_capture, proactive_messaging,
        compiled_prompt, prompt_generated_at, target_model,
        estimated_tokens, prompt_version, status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,'draft'
      ) RETURNING *`,
      [
        user.id,
        formData.agent_name,
        formData.agent_tagline ?? null,
        formData.brand_voice,
        formData.primary_language,
        formData.secondary_languages ?? [],
        formData.avatar_emoji ?? "🤖",
        formData.business_name,
        formData.sector,
        formData.description,
        formData.website_url ?? null,
        formData.location ?? null,
        formData.target_audience ?? null,
        formData.owner_name ?? null,
        formData.owner_email ?? null,
        formData.whatsapp_number ?? null,
        formData.description,
        formData.products_services ?? null,
        formData.pricing_info ?? null,
        formData.business_hours ?? null,
        formData.policies ?? null,
        JSON.stringify(formData.faq ?? []),
        formData.forbidden_topics ?? [],
        formData.capabilities?.support_whatsapp ?? true,
        formData.capabilities?.content_generation ?? false,
        formData.capabilities?.image_creation ?? false,
        formData.capabilities?.community_management ?? false,
        formData.capabilities?.strategy_advisor ?? false,
        formData.capabilities?.lead_capture ?? false,
        formData.capabilities?.proactive_messaging ?? false,
        systemPrompt.compiled_prompt,
        systemPrompt.generated_at,
        systemPrompt.target_model,
        systemPrompt.estimated_tokens,
        systemPrompt.version,
      ]
    );

    return NextResponse.json({ agent: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/agents]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
