// POST /api/waha/phone — connexion WhatsApp par numéro de téléphone (code de couplage)
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

const WAHA_URL     = process.env.WAHA_URL     ?? "https://waha.vps.buyticle.com";
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { agentId, phoneNumber } = await req.json();
    if (!agentId || !phoneNumber) {
      return NextResponse.json({ error: "agentId et phoneNumber requis" }, { status: 400 });
    }

    // Vérifier que la session existe en DB
    const sessionRes = await query(
      "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1 AND user_id = $2",
      [agentId, user.id]
    );
    if (sessionRes.rows.length === 0) {
      return NextResponse.json({ error: "Session introuvable, connectez d'abord via QR" }, { status: 404 });
    }

    const { session_name } = sessionRes.rows[0];

    // Nettoyer le numéro (retirer +, espaces, tirets)
    const cleanPhone = phoneNumber.replace(/[\s\-\+\(\)]/g, "");

    const res = await fetch(
      `${WAHA_URL}/api/sessions/${session_name}/auth/request-code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": WAHA_API_KEY },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      }
    );

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Waha requestCode: ${res.status} ${text}`);
    }

    const data = text ? JSON.parse(text) : {};
    const code = data.code ?? data.pairingCode ?? null;

    if (!code) {
      return NextResponse.json({ error: "Code de couplage non reçu" }, { status: 502 });
    }

    return NextResponse.json({ code });
  } catch (err) {
    console.error("[POST /api/waha/phone]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
