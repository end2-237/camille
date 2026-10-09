// PATCH  /api/agents/[agentId]/owner-tasks/[taskId]  { status }
//        Met à jour le statut d'une tâche (active → sent / completed / cancelled)
// DELETE /api/agents/[agentId]/owner-tasks/[taskId]
//        Supprime définitivement une tâche

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { accesAgent } from "@/lib/interne";

type RouteContext = { params: Promise<{ agentId: string; taskId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { agentId, taskId } = await params;
  const { refus } = await accesAgent(req, agentId, "reglages");
  if (refus) return refus;

  try {
    const { status } = await req.json() as { status: string };

    const valid = ["active", "sent", "completed", "cancelled", "snoozed"];
    if (!valid.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${valid.join(", ")}` },
        { status: 400 }
      );
    }

    await query(
      `UPDATE camille.owner_tasks
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND agent_id = $3`,
      [status, taskId, agentId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/agents/:id/owner-tasks/:taskId]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { agentId, taskId } = await params;
  const { refus } = await accesAgent(req, agentId, "reglages");
  if (refus) return refus;

  try {
    await query(
      `DELETE FROM camille.owner_tasks WHERE id = $1 AND agent_id = $2`,
      [taskId, agentId]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id/owner-tasks/:taskId]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
