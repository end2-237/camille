// ─────────────────────────────────────────────────────────────────────────────
// app/api/agents/[agentId]/route.ts — Camille by Buyticle
// GET    /api/agents/:id  → fetch a single agent
// PATCH  /api/agents/:id  → update agent fields
// DELETE /api/agents/:id  → archive (soft-delete) an agent
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

type RouteContext = { params: Promise<{ agentId: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const supabase = createServerClient();
    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (err) {
    console.error("[GET /api/agents/:id]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  try {
    const updates = await req.json();
    const supabase = createServerClient();

    const { data: agent, error } = await supabase
      .from("agents")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", agentId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ agent });
  } catch (err) {
    console.error("[PATCH /api/agents/:id]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ── DELETE (soft: archive) ────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from("agents")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", agentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id]", err);
    return NextResponse.json({ error: "Archive failed" }, { status: 500 });
  }
}
