// POST /api/agents/[agentId]/regenerate-prompt
// Régénère le compiled_prompt de l'agent depuis ses données DB, en tenant compte
// de son niveau (level) et de sa config N1/N2 (hors-scope, accueil).

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { generateSystemPrompt } from "@/lib/generateSystemPrompt";
import type { AgentFormData } from "@/types/agent";

type RouteContext = { params: Promise<{ agentId: string }> };

function parseJ(v: unknown) {
  if (!v) return undefined;
  if (typeof v === "object") return v;
  try { return JSON.parse(v as string); } catch { return undefined; }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;

  const r = await query(
    `SELECT name, agent_tagline, brand_voice, primary_language, secondary_languages,
            business_name, sector, description, website_url, location, latitude, longitude, target_audience,
            products_services, pricing_info, business_hours, policies, faq, forbidden_topics,
            target_model, level, out_of_scope_behavior, welcome_enabled, welcome_message
     FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'`,
    [agentId, user.id]
  );
  if (!r.rows.length) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  const a = r.rows[0];

  const data = {
    agent_name: a.name,
    agent_tagline: a.agent_tagline ?? "",
    brand_voice: a.brand_voice ?? "friendly",
    primary_language: a.primary_language ?? "fr",
    secondary_languages: parseJ(a.secondary_languages) ?? [],
    business_name: a.business_name ?? a.name,
    sector: a.sector ?? "other",
    description: a.description ?? "",
    website_url: a.website_url ?? "",
    location: a.location ?? "",
    latitude:  a.latitude  != null ? Number(a.latitude)  : null,
    longitude: a.longitude != null ? Number(a.longitude) : null,
    target_audience: a.target_audience ?? "",
    products_services: a.products_services ?? "",
    pricing_info: a.pricing_info ?? "",
    business_hours: a.business_hours ?? "",
    policies: a.policies ?? "",
    faq: parseJ(a.faq) ?? [],
    forbidden_topics: parseJ(a.forbidden_topics) ?? [],
  } as unknown as AgentFormData;

  const cfg = generateSystemPrompt(data, a.target_model ?? "claude-3-5-sonnet-20241022", {
    level: a.level ?? 1,
    outOfScopeBehavior: (a.out_of_scope_behavior as "site" | "human") ?? "site",
    welcomeEnabled: a.welcome_enabled !== false,
    welcomeMessage: a.welcome_message ?? null,
  });

  await query(
    "UPDATE camille.agents SET compiled_prompt = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
    [cfg.compiled_prompt, agentId, user.id]
  );

  return NextResponse.json({ success: true, level: a.level ?? 1, tokens: cfg.estimated_tokens });
}
