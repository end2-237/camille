// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-email { code }        — confirme l'adresse du compte
// POST /api/auth/verify-email { renvoyer: 1 } — envoie un nouveau code
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { envoyerCode, verifierCode } from "@/lib/verification-email";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.email_verified) return NextResponse.json({ ok: true, deja: true });

  const b = (await req.json().catch(() => ({}))) as { code?: string; renvoyer?: unknown };

  if (b.renvoyer) {
    const r = await envoyerCode(user.id, user.email, user.full_name);
    if (!r.ok) return NextResponse.json({ error: r.erreur, attente: r.attente }, { status: 429 });
    return NextResponse.json({ ok: true, envoye: true });
  }

  const r = await verifierCode(user.id, String(b.code || ""));
  if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: 400 });
  return NextResponse.json({ ok: true, user: { ...user, email_verified: true } });
}
