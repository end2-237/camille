// GET /api/waha/qr?session=NAME — proxy du QR code Camille Core
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaGetQR } from "@/lib/waha";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const sessionName = req.nextUrl.searchParams.get("session");
    if (!sessionName) return NextResponse.json({ error: "session requis" }, { status: 400 });

    const check = await query(
      "SELECT session_name FROM camille.whatsapp_sessions WHERE session_name = $1 AND user_id = $2",
      [sessionName, user.id]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }

    const buffer = await wahaGetQR(sessionName);
    if (!buffer) {
      return NextResponse.json({ error: "QR non disponible — scannez depuis le dashboard Camille Core" }, { status: 503 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/waha/qr]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
