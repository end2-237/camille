// GET /api/owner-tasks/due?before=ISO_DATE
//     Retourne toutes les tâches owner dont scheduled_at <= before ET status = 'active'.
//     Appelé par le cron n8n toutes les 15 minutes pour envoyer les rappels planifiés.
//     Inclut le session_name WAHA pour que n8n puisse envoyer le message directement.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const before = req.nextUrl.searchParams.get("before") ?? new Date().toISOString();

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
       JOIN camille.agents a           ON a.id = ot.agent_id
       JOIN camille.whatsapp_sessions ws ON ws.agent_id = ot.agent_id
       WHERE ot.status = 'active'
         AND ot.scheduled_at IS NOT NULL
         AND ot.scheduled_at <= $1
       ORDER BY ot.scheduled_at ASC
       LIMIT 50`,
      [before]
    );

    return NextResponse.json({ tasks: result.rows });
  } catch (err) {
    console.error("[GET /api/owner-tasks/due]", err);
    return NextResponse.json({ tasks: [] });
  }
}
