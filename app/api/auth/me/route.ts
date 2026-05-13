import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
