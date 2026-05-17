// GET /api/integrations/google-calendar/callback
// Called by Google after the user grants access.
// Exchanges the code for tokens, stores them, then redirects back to the dashboard.

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error) {
    console.error("[gcal callback] Google OAuth error:", error);
    return NextResponse.redirect(`${appUrl}/dashboard?gcal_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?gcal_error=missing_params`);
  }

  // Verify HMAC in state: format is "agentId.hmacSlice16"
  const dotIdx = state.lastIndexOf(".");
  if (dotIdx === -1) {
    return NextResponse.redirect(`${appUrl}/dashboard?gcal_error=invalid_state`);
  }
  const agentId  = state.slice(0, dotIdx);
  const received = state.slice(dotIdx + 1);
  const expected = createHmac("sha256", process.env.JWT_SECRET ?? "secret")
    .update(agentId)
    .digest("hex")
    .slice(0, 16);

  if (received !== expected) {
    console.error("[gcal callback] HMAC mismatch for agentId:", agentId);
    return NextResponse.redirect(`${appUrl}/dashboard?gcal_error=invalid_state`);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI
    ?? `${appUrl}/api/integrations/google-calendar/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard?gcal_error=server_misconfigured`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[gcal callback] token exchange failed:", body);
      return NextResponse.redirect(
        `${appUrl}/dashboard/${agentId}?tab=capabilities&gcal_error=token_exchange`
      );
    }

    const tokens = await tokenRes.json() as {
      access_token:  string;
      refresh_token?: string;
      scope:         string;
      token_type:    string;
      expires_in:    number;
    };

    if (!tokens.refresh_token) {
      // This can happen if the user already granted access and didn't get prompted again.
      // prompt=consent in the connect route should prevent this, but handle it gracefully.
      return NextResponse.redirect(
        `${appUrl}/dashboard/${agentId}?tab=capabilities&gcal_error=no_refresh_token`
      );
    }

    // Fetch user's Google email
    let email: string | null = null;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json() as { email?: string };
        email = info.email ?? null;
      }
    } catch {
      // Non-fatal — we'll store the token without email
    }

    // Persist tokens in DB
    await query(
      `UPDATE camille.agents
       SET google_refresh_token        = $1,
           google_calendar_email       = $2,
           google_calendar_connected_at = NOW(),
           updated_at                  = NOW()
       WHERE id = $3`,
      [tokens.refresh_token, email, agentId]
    );

    return NextResponse.redirect(
      `${appUrl}/dashboard/${agentId}?tab=capabilities&gcal=connected`
    );
  } catch (err) {
    console.error("[gcal callback] unexpected error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard?gcal_error=server_error`);
  }
}
