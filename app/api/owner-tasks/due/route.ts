// GET /api/owner-tasks/due?before=ISO_DATE
//     Retourne les tâches owner dont scheduled_at <= before ET status = 'active'.
//     Fenêtre max : 24h dans le passé pour éviter de renvoyer d'anciennes tâches bloquées.
//     Appelé par le cron n8n toutes les 15 minutes.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const before = req.nextUrl.searchParams.get("before") ?? new Date().toISOString();

  // Jamais de tâches de plus de 24h dans le passé (évite le flood en cas de bug)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await query(
      `SELECT
         ot.id,
         ot.agent_id,
         ot.phone,
         ot.type,
         ot.title,
         ot.content,
         ot.scheduled_at,
         ws.session_name,
         a.name        AS agent_name,
         a.business_name
       FROM camille.owner_tasks ot
       JOIN camille.agents a            ON a.id = ot.agent_id
       JOIN camille.whatsapp_sessions ws ON ws.agent_id = ot.agent_id
       WHERE ot.status = 'active'
         AND ot.scheduled_at IS NOT NULL
         AND ot.scheduled_at <= $1
         AND ot.scheduled_at >= $2
       ORDER BY ot.scheduled_at ASC
       LIMIT 50`,
      [before, since]
    );

    return NextResponse.json({ tasks: result.rows });
  } catch (err) {
    console.error("[GET /api/owner-tasks/due]", err);
    return NextResponse.json({ tasks: [] });
  }
}
