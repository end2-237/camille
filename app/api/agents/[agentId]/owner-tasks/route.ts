// GET  /api/agents/[agentId]/owner-tasks?phone=xxx&status=active
//      Liste les tâches owner actives d'un agent (injectées dans le contexte proprio)
// POST /api/agents/[agentId]/owner-tasks
//      Crée une ou plusieurs tâches (single: { phone, type, title, content, scheduled_at }
//                                    bulk:   { phone, tasks: [...] })

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const phone  = _req.nextUrl.searchParams.get("phone");
  const status = _req.nextUrl.searchParams.get("status") ?? "active";

  try {
    const result = await query(
      `SELECT id, type, title, content, status, scheduled_at, created_at
       FROM camille.owner_tasks
       WHERE agent_id = $1
         ${phone ? "AND phone = $3" : ""}
         AND status = $2
       ORDER BY scheduled_at ASC NULLS LAST, created_at DESC
       LIMIT 50`,
      phone ? [agentId, status, phone] : [agentId, status]
    );
    return NextResponse.json({ tasks: result.rows });
  } catch (err) {
    console.error("[GET /api/agents/:id/owner-tasks]", err);
    return NextResponse.json({ tasks: [] });   // silent fail — table may not exist yet
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;

  try {
    const body = await req.json() as {
      phone?: string;
      tasks?: Array<{ type?: string; title: string; content?: Record<string, unknown>; scheduled_at?: string }>;
      type?: string;
      title?: string;
      content?: Record<string, unknown>;
      scheduled_at?: string;
    };

    // ── Bulk create ────────────────────────────────────────────────────────
    if (Array.isArray(body.tasks)) {
      if (body.tasks.length === 0) {
        return NextResponse.json({ created: [] });
      }
      const created = [];
      for (const task of body.tasks) {
        if (!task.title) continue;
        const r = await query(
          `INSERT INTO camille.owner_tasks
             (agent_id, phone, type, title, content, scheduled_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, type, title, scheduled_at`,
          [
            agentId,
            body.phone ?? "",
            task.type ?? "reminder",
            task.title,
            JSON.stringify(task.content ?? {}),
            task.scheduled_at ?? null,
          ]
        );
        created.push(r.rows[0]);
      }
      return NextResponse.json({ created });
    }

    // ── Single create ──────────────────────────────────────────────────────
    const { phone, type, title, content, scheduled_at } = body;
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const r = await query(
      `INSERT INTO camille.owner_tasks
         (agent_id, phone, type, title, content, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, title, scheduled_at`,
      [
        agentId,
        phone ?? "",
        type ?? "reminder",
        title,
        JSON.stringify(content ?? {}),
        scheduled_at ?? null,
      ]
    );
    return NextResponse.json({ task: r.rows[0] }, { status: 201 });

  } catch (err) {
    console.error("[POST /api/agents/:id/owner-tasks]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
