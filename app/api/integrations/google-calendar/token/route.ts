// GET /api/integrations/google-calendar/token?agentId=xxx
// Called by n8n (no user auth) to get a fresh Google access token for a given agent.
// The refresh_token itself is never exposed — only a short-lived access_token is returned.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId manquant" }, { status: 400 });
  }

  const result = await query(
    `SELECT google_refresh_token
     FROM camille.agents
     WHERE id = $1 AND status = 'active'`,
    [agentId]
  );

  if (result.rows.length === 0 || !result.rows[0].google_refresh_token) {
    return NextResponse.json(
      { error: "Google Calendar non connecté pour cet agent" },
      { status: 404 }
    );
  }

  const refreshToken = result.rows[0].google_refresh_token as string;
  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Serveur mal configuré" }, { status: 500 });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[gcal token] refresh failed:", body);
      return NextResponse.json(
        { error: "Impossible de rafraîchir le token Google" },
        { status: 502 }
      );
    }

    const data = await tokenRes.json() as {
      access_token: string;
      expires_in:   number;
      token_type:   string;
    };

    return NextResponse.json({
      access_token: data.access_token,
      expires_in:   data.expires_in,
      token_type:   data.token_type,
    });
  } catch (err) {
    console.error("[gcal token] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
