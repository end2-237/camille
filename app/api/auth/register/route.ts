import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { hashPassword, generateToken, tokenExpiresAt, SQL_EMAIL_VERIFIE } from "@/lib/auth-server";
import { tenter, ipDe } from "@/lib/limite";
import { envoyerCode } from "@/lib/verification-email";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 5 comptes par heure et par IP : de quoi inscrire une équipe, pas de
    // quoi fabriquer des comptes gratuits à la chaîne.
    const essai = tenter(`register:${ipDe(req)}`, 5, 60 * 60_000);
    if (!essai.ok) {
      return NextResponse.json(
        { error: "Trop de comptes créés depuis cette connexion. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(essai.attente) } }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password, full_name } = parsed.data;

    const existing = await query(
      "SELECT id FROM camille.users WHERE LOWER(email) = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password);

    const userResult = await query(
      `INSERT INTO camille.users AS u (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, plan, created_at, FALSE AS is_admin,
                 ${SQL_EMAIL_VERIFIE} AS email_verified`,
      [email, password_hash, full_name ?? null]
    );

    const user = userResult.rows[0];
    const token = generateToken(user.id);

    await query(
      `INSERT INTO camille.sessions (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, tokenExpiresAt()]
    );

    // Le code de vérification part tout de suite. Un échec (SMTP, migration
    // absente) ne doit pas faire échouer l'inscription : la page de
    // vérification permet d'en redemander un.
    if (!user.email_verified) {
      await envoyerCode(user.id, user.email, user.full_name).catch((e) =>
        console.error("[register] code non envoyé :", e instanceof Error ? e.message : e)
      );
    }

    return NextResponse.json({ user, token }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
