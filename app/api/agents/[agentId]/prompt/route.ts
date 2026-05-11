// ─────────────────────────────────────────────────────────────────────────────
// app/api/agents/[agentId]/prompt/route.ts — Camille by Buyticle
// POST /api/agents/:id/prompt → regenerate system prompt from latest form data
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { regenerateSystemPrompt } from "@/lib/generateSystemPrompt";
import type { AgentFormData } from "@/types/agent";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createServerClient(): ReturnType<typeof createClient<any>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  try {
    const body: { formData: AgentFormData } = await req.json();
    const supabase = createServerClient();

    // Fetch current agent to bump version
    const { data: current, error: fetchErr } = await supabase
      .from("agents")
      .select("system_prompt")
      .eq("id", agentId)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const newPrompt = regenerateSystemPrompt(
      body.formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current.system_prompt as any
    );

    const { data: updated, error: updateErr } = await supabase
      .from("agents")
      .update({
        system_prompt: newPrompt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ agent: updated, systemPrompt: newPrompt });
  } catch (err) {
    console.error("[POST /api/agents/:id/prompt]", err);
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 });
  }
}
