import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await query("DELETE FROM camille.sessions WHERE token = $1", [token]);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/auth/logout]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
