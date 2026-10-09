// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/team/accept?jeton=… — ce que contient l'invitation (page /rejoindre)
// POST /api/team/accept { jeton } — l'utilisateur connecté rejoint l'équipe
//
// L'invitation vaut pour UNE adresse : il faut être connecté avec elle, et
// l'avoir confirmée. Un lien transféré à quelqu'un d'autre ne sert à rien.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

const empreinte = (j: string) => createHash("sha256").update(j).digest("hex");

async function invitation(jeton: string) {
  if (!jeton) return null;
  const r = await query(
    `SELECT m.id, m.email, m.role, m.owner_id, o.full_name AS invitant, o.email AS invitant_email,
            (SELECT business_name FROM camille.agents WHERE user_id = m.owner_id AND status <> 'archived'
              ORDER BY created_at LIMIT 1) AS commerce
       FROM camille.team_members m JOIN camille.users o ON o.id = m.owner_id
      WHERE m.token_hash = $1 AND m.status = 'pending' AND m.expires_at > NOW()`,
    [empreinte(jeton)]
  );
  return r.rows[0] || null;
}

export async function GET(req: NextRequest) {
  const inv = await invitation(req.nextUrl.searchParams.get("jeton") || "").catch(() => null);
  if (!inv) return NextResponse.json({ valide: false });
  return NextResponse.json({
    valide: true,
    email: inv.email,
    role: inv.role,
    invitant: inv.invitant || inv.invitant_email,
    commerce: inv.commerce || null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { jeton?: string };
  const inv = await invitation(String(b.jeton || ""));
  if (!inv) return NextResponse.json({ error: "Cette invitation n'est plus valable. Demandez-en une nouvelle." }, { status: 400 });

  if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: `Cette invitation est destinée à ${inv.email}. Connectez-vous avec cette adresse.`, code: "autre_adresse" },
      { status: 403 }
    );
  }
  if (!user.email_verified) {
    return NextResponse.json({ error: "Confirmez d'abord votre adresse e-mail.", code: "email_non_verifie" }, { status: 403 });
  }
  if (inv.owner_id === user.id) return NextResponse.json({ error: "C'est votre propre compte." }, { status: 400 });

  await query(
    `UPDATE camille.team_members
        SET member_id = $2, status = 'active', accepted_at = NOW(), token_hash = NULL
      WHERE id = $1`,
    [inv.id, user.id]
  );
  return NextResponse.json({ ok: true });
}
