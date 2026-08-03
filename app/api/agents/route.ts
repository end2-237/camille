import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";
import { subscriptionState } from "@/lib/subscription";
import type {
  Agent, AgentFormData, SystemPromptConfig,
  AgentIdentity, BusinessContext, KnowledgeBase, AgentCapabilities,
  AgentStatus, AgentModel, BrandTone, SupportedLanguage, BusinessSector,
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
      latitude:  row.latitude  != null ? Number(row.latitude)  : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
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
    plan: (row.plan ?? "free") as Agent["plan"],
    // Meme regle que le garde-fou qui bloque les reponses : l'ecran et le
    // moteur ne doivent jamais dire deux choses differentes.
    plan_expires_at: row.plan_expires_at ?? null,
    plan_expired: subscriptionState(row.plan, row.plan_expires_at).expired,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const result = await query(
      `SELECT * FROM camille.agents
       WHERE user_id = $1 AND status != 'archived'
       ORDER BY created_at DESC`,
      [user.id]
    );
    return NextResponse.json({ agents: result.rows.map(rowToAgent) });
  } catch (err) {
    console.error("[GET /api/agents]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body: { formData: AgentFormData; systemPrompt: SystemPromptConfig } = await req.json();
    const { formData, systemPrompt } = body;

    if (!formData || !systemPrompt) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const compiledPrompt = typeof systemPrompt === "string"
      ? systemPrompt
      : (systemPrompt as SystemPromptConfig).compiled_prompt ?? JSON.stringify(systemPrompt);

    const result = await query(
      `INSERT INTO camille.agents (
        user_id, name, agent_tagline, brand_voice, primary_language,
        secondary_languages, avatar_emoji, business_name, sector, description,
        website_url, location, target_audience, owner_name, owner_email,
        whatsapp_number, products_services, pricing_info, business_hours,
        policies, faq, forbidden_topics, capabilities, target_model, compiled_prompt, status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,'draft'
      ) RETURNING *`,
      [
        user.id,
        formData.agent_name,
        formData.agent_tagline ?? null,
        formData.brand_voice ?? null,
        formData.primary_language ?? null,
        formData.secondary_languages ? JSON.stringify(formData.secondary_languages) : null,
        formData.avatar_emoji ?? null,
        formData.business_name ?? null,
        formData.sector ?? null,
        formData.description ?? null,
        formData.website_url ?? null,
        formData.location ?? null,
        formData.target_audience ?? null,
        formData.owner_name ?? null,
        formData.owner_email ?? null,
        formData.whatsapp_number ?? null,
        formData.products_services ?? null,
        formData.pricing_info ?? null,
        formData.business_hours ?? null,
        formData.policies ?? null,
        formData.faq ? JSON.stringify(formData.faq) : null,
        formData.forbidden_topics ? JSON.stringify(formData.forbidden_topics) : null,
        formData.capabilities ? JSON.stringify(formData.capabilities) : null,
        formData.target_model ?? null,
        compiledPrompt,
      ]
    );

    return NextResponse.json({ agent: rowToAgent(result.rows[0]) }, { status: 201 });
  } catch (err) {
    // « Erreur serveur » seul n'apprend rien à l'appelant : une colonne
    // obligatoire manquante et une base injoignable donnaient le même message,
    // impossible à distinguer sans accès aux logs du serveur.
    console.error("[POST /api/agents]", err);
    return NextResponse.json(
      { error: "Création impossible", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
