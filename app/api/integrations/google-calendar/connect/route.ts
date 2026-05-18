// POST /api/integrations/google-calendar/connect
// Auth required. Returns { url } for the frontend to redirect to Google OAuth.

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events", // Créer/lire événements seulement (pas la config du calendrier)
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

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

  // Verify agent belongs to this user
  const result = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  const clientId   = process.env.GOOGLE_CLIENT_ID;
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
    ?? `${appUrl}/api/integrations/google-calendar/callback`;

  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID non configuré" }, { status: 500 });
  }

  // Sign state with HMAC so the callback can verify it wasn't tampered
  const hmac = createHmac("sha256", process.env.JWT_SECRET ?? "secret")
    .update(agentId)
    .digest("hex")
    .slice(0, 16);
  const state = `${agentId}.${hmac}`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",   // force refresh_token to always be returned
    state,
  });

  return NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });
}
