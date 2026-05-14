// GET /api/waha/qr?session=NAME — proxy du QR code Waha
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaGetQR } from "@/lib/waha";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const sessionName = req.nextUrl.searchParams.get("session");
  if (!sessionName) return NextResponse.json({ error: "session requis" }, { status: 400 });

  // Vérifier que cette session appartient bien à l'user
  const check = await query(
    "SELECT session_name FROM camille.whatsapp_sessions WHERE session_name = $1 AND user_id = $2",
    [sessionName, user.id]
  );
  if (check.rows.length === 0) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const qrBuffer = await wahaGetQR(sessionName);
  if (!qrBuffer) {
    return NextResponse.json({ error: "QR non disponible" }, { status: 503 });
  }

  return new NextResponse(new Uint8Array(qrBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
