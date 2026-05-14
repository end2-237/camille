import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";
import type {
  Agent, AgentStatus, AgentModel, BrandTone, SupportedLanguage,
  BusinessSector, AgentIdentity, BusinessContext, KnowledgeBase, AgentCapabilities,
} from "@/types/agent";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJ(val: any) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAgent(row: Record<string, any>): Agent {
  return {
    id: row.id,
    user_id: row.user_id,
    identity: {
      name: row.name,
      tagline: row.agent_tagline ?? undefined,
      brand_voice: row.brand_voice as BrandTone,
      primary_language: row.primary_language as SupportedLanguage,
      secondary_languages: parseJ(row.secondary_languages) ?? undefined,
      avatar_emoji: row.avatar_emoji ?? undefined,
    } satisfies AgentIdentity,
    business_context: {
      business_name: row.business_name,
      sector: row.sector as BusinessSector,
      description: row.description,
      website_url: row.website_url ?? undefined,
      location: row.location ?? undefined,
      target_audience: row.target_audience ?? undefined,
      owner_name: row.owner_name,
      owner_email: row.owner_email,
      whatsapp_number: row.whatsapp_number ?? undefined,
    } satisfies BusinessContext,
    knowledge_base: {
      business_description: row.description ?? "",
      products_services: row.products_services ?? undefined,
      pricing_info: row.pricing_info ?? undefined,
      business_hours: row.business_hours ?? undefined,
      policies: row.policies ?? undefined,
      faq: parseJ(row.faq) ?? [],
      forbidden_topics: parseJ(row.forbidden_topics) ?? [],
    } satisfies KnowledgeBase,
    capabilities: (parseJ(row.capabilities) ?? {}) as AgentCapabilities,
    system_prompt: {
      compiled_prompt: row.compiled_prompt ?? "",
      generated_at: row.updated_at,
      target_model: row.target_model as AgentModel,
      estimated_tokens: 0,
      version: 1,
    },
    status: row.status as AgentStatus,
    target_model: row.target_model as AgentModel,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const ALLOWED_PATCH_FIELDS = new Set([
  "name", "agent_tagline", "brand_voice", "primary_language", "secondary_languages",
  "avatar_emoji", "business_name", "sector", "description", "website_url",
  "location", "target_audience", "owner_name", "owner_email", "whatsapp_number",
  "products_services", "pricing_info", "business_hours", "policies",
  "faq", "forbidden_topics", "capabilities", "target_model", "compiled_prompt", "status",
]);

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  try {
    const result = await query(
      "SELECT * FROM camille.agents WHERE id = $1 AND user_id = $2",
      [agentId, user.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }
    return NextResponse.json({ agent: rowToAgent(result.rows[0]) });
  } catch (err) {
    console.error("[GET /api/agents/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  try {
    const updates = await req.json();

    // Accept nested Agent fields and flatten them
    const flat: Record<string, unknown> = {};
    if (updates.status) flat.status = updates.status;
    if (updates.identity) {
      if (updates.identity.name)             flat.name = updates.identity.name;
      if (updates.identity.tagline)          flat.agent_tagline = updates.identity.tagline;
      if (updates.identity.brand_voice)      flat.brand_voice = updates.identity.brand_voice;
      if (updates.identity.primary_language) flat.primary_language = updates.identity.primary_language;
      if (updates.identity.avatar_emoji)     flat.avatar_emoji = updates.identity.avatar_emoji;
    }
    // Also accept raw flat fields directly
    for (const [k, v] of Object.entries(updates)) {
      if (ALLOWED_PATCH_FIELDS.has(k)) flat[k] = v;
    }

    const filtered = Object.entries(flat).filter(([key]) => ALLOWED_PATCH_FIELDS.has(key));
    if (filtered.length === 0) {
      return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 });
    }

    const setClauses = filtered.map(([key], i) => `${key} = $${i + 3}`).join(", ");
    const values = filtered.map(([, val]) =>
      typeof val === "object" && val !== null ? JSON.stringify(val) : val
    );

    const result = await query(
      `UPDATE camille.agents
       SET ${setClauses}, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [agentId, user.id, ...values]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }
    return NextResponse.json({ agent: rowToAgent(result.rows[0]) });
  } catch (err) {
    console.error("[PATCH /api/agents/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  try {
    const result = await query(
      `UPDATE camille.agents SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [agentId, user.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
