// POST /api/integrations/google-calendar/disconnect
// Auth required. Revokes the Google token and clears DB fields.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let agentId: string;
  try {
    ({ agentId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  if (!agentId) return NextResponse.json({ error: "agentId manquant" }, { status: 400 });

  // Verify ownership and fetch token for revocation
  const result = await query(
    "SELECT google_refresh_token FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  const refreshToken = result.rows[0].google_refresh_token as string | null;

  // Revoke with Google (best-effort, don't fail if this errors)
  if (refreshToken) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
    } catch { /* non-fatal */ }
  }

  // Clear DB fields
  await query(
    `UPDATE camille.agents
     SET google_refresh_token        = NULL,
         google_calendar_email       = NULL,
         google_calendar_connected_at = NULL,
         updated_at                  = NOW()
     WHERE id = $1`,
    [agentId]
  );

  return NextResponse.json({ success: true });
}
