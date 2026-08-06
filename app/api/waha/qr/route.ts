// ─────────────────────────────────────────────────────────────────────────────
// GET /api/waha/qr?session=NAME[&format=json]
//
// Deux formats, pour deux usages.
//
//   (défaut)      l'image PNG — le dashboard web la pose dans un <img>
//   format=json   { qr, status } — l'application mobile
//
// Le second existe parce qu'une balise image échoue en SILENCE. Réseau coupé,
// session inconnue, jeton refusé, QR pas encore prêt : les quatre donnaient le
// même carré gris, et il était impossible de savoir lequel. En JSON, l'app lit
// le message et l'affiche — le diagnostic passe de « ça ne marche pas » à une
// phrase qui dit quoi faire.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaGetQR } from "@/lib/waha";

export async function GET(req: NextRequest) {
  const json = req.nextUrl.searchParams.get("format") === "json";
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

    const { buffer, dataUrl, coreStatus, message } = await wahaGetQR(sessionName);

    if (!buffer || !dataUrl) {
      // On explique l'attente au lieu de la subir. Ces états sont normaux
      // pendant les premières secondes ; c'est de ne rien en dire qui ne l'est pas.
      const explication =
        coreStatus === "CONNECTED" ? "Cet agent est déjà connecté à WhatsApp."
        : coreStatus === "DISCONNECTED" ? "La session se reconnecte. Le QR apparaîtra dès que WhatsApp répondra."
        : coreStatus === "AUTH_FAILURE" ? "La liaison a été refusée. Réinitialise la session, puis relance la connexion."
        : coreStatus === "INITIALIZING" ? "La session démarre. Le QR arrive dans quelques secondes."
        : message || "QR pas encore disponible.";

      return NextResponse.json(
        { error: explication, status: coreStatus, detail: message },
        { status: 503 }
      );
    }

    if (json) {
      return NextResponse.json({ qr: dataUrl, status: coreStatus });
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
