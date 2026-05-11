// ─────────────────────────────────────────────────────────────────────────────
// app/api/agents/route.ts — Camille by Buyticle
// GET  /api/agents  → liste les agents de l'utilisateur connecté
// POST /api/agents  → crée un nouvel agent depuis le formulaire + prompt généré
//
// Mode DEV sans Supabase : retourne des données mock si les variables d'env
// ne sont pas configurées (évite le crash sur ENOTFOUND).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AgentFormData, SystemPromptConfig } from "@/types/agent";

// ── Helpers ───────────────────────────────────────────────────────────────────

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createServerClient(): ReturnType<typeof createClient<any>> {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Agent fictif pour le mode démo (Supabase non configuré)
function mockAgent(formData: AgentFormData, systemPrompt: SystemPromptConfig) {
  return {
    id: `demo-${Date.now()}`,
    user_id: "demo-user",
    identity: {
      name: formData.agent_name,
      tagline: formData.agent_tagline,
      brand_voice: formData.brand_voice,
      primary_language: formData.primary_language,
      avatar_emoji: formData.avatar_emoji ?? "✨",
    },
    business_context: {
      business_name: formData.business_name,
      sector: formData.sector,
      description: formData.description,
      owner_name: formData.owner_name,
      owner_email: formData.owner_email,
    },
    knowledge_base: {
      business_description: formData.description,
      faq: formData.faq ?? [],
    },
    capabilities: formData.capabilities,
    system_prompt: systemPrompt,
    status: "draft",
    target_model: formData.target_model,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Mode démo : retourne une liste vide proprement
  if (!isSupabaseConfigured) {
    return NextResponse.json({
      agents: [],
      _demo: true,
      _message: "Supabase non configuré — connectez votre projet dans .env.local",
    });
  }

  try {
    const supabase = createServerClient();
    const userId = req.headers.get("x-user-id") ?? "demo-user";

    const { data: agents, error } = await supabase
      .from("agents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ agents: agents ?? [] });
  } catch (err) {
    console.error("[GET /api/agents]", err);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: { formData: AgentFormData; systemPrompt: SystemPromptConfig } =
      await req.json();
    const { formData, systemPrompt } = body;

    if (!formData || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing formData or systemPrompt" },
        { status: 400 }
      );
    }

    // Mode démo : simule la création sans base de données
    if (!isSupabaseConfigured) {
      const agent = mockAgent(formData, systemPrompt);
      console.info("[POST /api/agents] Mode démo — agent simulé :", agent.identity.name);
      return NextResponse.json({ agent, _demo: true }, { status: 201 });
    }

    const supabase = createServerClient();
    const userId = req.headers.get("x-user-id") ?? "demo-user";

    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        user_id: userId,
        identity: {
          name: formData.agent_name,
          tagline: formData.agent_tagline,
          brand_voice: formData.brand_voice,
          primary_language: formData.primary_language,
          secondary_languages: formData.secondary_languages,
          avatar_emoji: formData.avatar_emoji,
        },
        business_context: {
          business_name: formData.business_name,
          sector: formData.sector,
          description: formData.description,
          website_url: formData.website_url,
          location: formData.location,
          target_audience: formData.target_audience,
          owner_name: formData.owner_name,
          owner_email: formData.owner_email,
          whatsapp_number: formData.whatsapp_number,
        },
        knowledge_base: {
          business_description: formData.description,
          products_services: formData.products_services,
          pricing_info: formData.pricing_info,
          business_hours: formData.business_hours,
          policies: formData.policies,
          faq: formData.faq ?? [],
          forbidden_topics: formData.forbidden_topics ?? [],
        },
        capabilities: formData.capabilities,
        system_prompt: systemPrompt,
        status: "draft",
        target_model: formData.target_model,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/agents]", err);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
