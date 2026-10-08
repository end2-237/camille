// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot { email } — envoie un lien de réinitialisation.
//
// La réponse est toujours la même, que le compte existe ou non : la page ne
// doit pas servir à deviner qui est inscrit. Au plus 3 liens par heure et par
// compte ; le jeton n'est stocké que haché.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { query } from "@/lib/db";
import { envoyerEmail } from "@/lib/email";

const schema = z.object({ email: z.string().trim().email() });
const DUREE_MIN = 30;
const MAX_PAR_HEURE = 3;

const REPONSE = {
  ok: true,
  message: "Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé.",
};

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Adresse e-mail invalide" }, { status: 400 });

  try {
    const { rows } = await query(
      `SELECT id, email, full_name FROM camille.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [parsed.data.email]
    );
    const user = rows[0];
    if (!user) return NextResponse.json(REPONSE);

    const recents = await query(
      `SELECT COUNT(*)::int AS n FROM camille.password_resets
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [user.id]
    );
    if (recents.rows[0].n >= MAX_PAR_HEURE) return NextResponse.json(REPONSE);

    const jeton = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(jeton).digest("hex");
    await query(
      `INSERT INTO camille.password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
      [user.id, hash, String(DUREE_MIN)]
    );

    const base = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
    const lien = `${base}/reinitialiser?jeton=${jeton}`;
    const nom = user.full_name || "";
    await envoyerEmail({
      to: user.email,
      subject: "Réinitialiser votre mot de passe Camille",
      text:
        `Bonjour ${nom},\n\n` +
        `Quelqu'un (vous, normalement) a demandé à changer le mot de passe de votre compte Camille.\n\n` +
        `Choisissez-en un nouveau ici — le lien est valable ${DUREE_MIN} minutes et ne sert qu'une fois :\n${lien}\n\n` +
        `Si ce n'était pas vous, ignorez ce message : votre mot de passe actuel reste valable.\n\n— Camille`,
      html: mailHtml(nom, lien),
    });

    return NextResponse.json(REPONSE);
  } catch (e) {
    console.error("[auth/forgot]", e);
    return NextResponse.json(REPONSE);
  }
}

function echapper(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function mailHtml(nom: string, lien: string) {
  const l = echapper(lien);
  return `<!doctype html><html><body style="margin:0;background:#F5F1FF;font-family:Inter,Arial,sans-serif;color:#19171B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em">Camille</div>
<p style="font-size:15px;line-height:1.55;margin:20px 0 8px">Bonjour ${echapper(nom)},</p>
<p style="font-size:15px;line-height:1.55;margin:0 0 24px">Vous avez demandé à changer le mot de passe de votre compte. Le lien ci-dessous est valable ${DUREE_MIN} minutes et ne sert qu'une fois.</p>
<a href="${l}" style="display:inline-block;background:#6442E8;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px">Choisir un nouveau mot de passe</a>
<p style="font-size:13px;line-height:1.5;color:#6B6577;margin:24px 0 0">Si ce n'était pas vous, ignorez ce message : votre mot de passe actuel reste valable.</p>
</td></tr></table></td></tr></table></body></html>`;
}
