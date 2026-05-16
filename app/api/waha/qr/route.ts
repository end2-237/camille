// GET /api/waha/qr?session=NAME — proxy du QR code Waha
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

const WAHA_URL     = process.env.WAHA_URL     ?? "https://waha.vps.buyticle.com";
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? "";

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

    // Essaie d'abord avec ?format=image, puis fallback sans paramètre
    const urls = [
      `${WAHA_URL}/api/sessions/${sessionName}/auth/qr?format=image`,
      `${WAHA_URL}/api/${sessionName}/auth/qr?format=image`,
      `${WAHA_URL}/api/sessions/${sessionName}/auth/qr`,
    ];

    for (const url of urls) {
      const res = await fetch(url, { headers: { "X-Api-Key": WAHA_API_KEY } });
      console.log(`[QR] ${url} → ${res.status} ${res.headers.get("content-type")}`);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";

      // Réponse image directe
      if (contentType.includes("image")) {
        const buffer = await res.arrayBuffer();
        return new NextResponse(new Uint8Array(buffer), {
          headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
        });
      }

      // Réponse JSON avec base64
      if (contentType.includes("json")) {
        const data = await res.json();
        const b64 = data.qr ?? data.image ?? data.data ?? null;
        if (b64) {
          const base64Data = b64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          return new NextResponse(new Uint8Array(buffer), {
            headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
          });
        }
      }
    }

    return NextResponse.json({ error: "QR non disponible" }, { status: 503 });
  } catch (err) {
    console.error("[GET /api/waha/qr]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
