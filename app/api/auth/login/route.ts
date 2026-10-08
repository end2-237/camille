import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { verifyPassword, generateToken, tokenExpiresAt, SQL_EMAIL_VERIFIE } from "@/lib/auth-server";
import { tenter, oublier, ipDe } from "@/lib/limite";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // 10 essais par quart d'heure pour une même adresse depuis une même IP,
    // 50 par IP toutes adresses confondues : assez pour une faute de frappe,
    // trop peu pour deviner un mot de passe.
    const ip = ipDe(req);
    const cle = `login:${ip}:${email.toLowerCase()}`;
    const parAdresse = tenter(cle, 10, 15 * 60_000);
    const parIp = tenter(`login-ip:${ip}`, 50, 15 * 60_000);
    if (!parAdresse.ok || !parIp.ok) {
      const attente = Math.max(parAdresse.attente, parIp.attente);
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${Math.ceil(attente / 60)} min.` },
        { status: 429, headers: { "Retry-After": String(attente) } }
      );
    }

    // is_admin est lu ici parce que c'est cet objet-là qui finit dans le
    // navigateur et qui décide de l'affichage de la console d'exploitation.
    // to_jsonb plutôt que u.is_admin : sur une base où migration_admin.sql
    // n'est pas passée, demander la colonne ferait échouer TOUTE connexion.
    const result = await query(
      `SELECT id, email, full_name, plan, password_hash,
              COALESCE((to_jsonb(u)->>'is_admin')::boolean, FALSE) AS is_admin,
              ${SQL_EMAIL_VERIFIE} AS email_verified
         FROM camille.users u WHERE LOWER(email) = LOWER($1)
        ORDER BY (email = $1) DESC LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    oublier(cle);
    const token = generateToken(user.id);

    await query(
      `INSERT INTO camille.sessions (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, tokenExpiresAt()]
    );

    const { password_hash: _, ...safeUser } = user;

    return NextResponse.json({ user: safeUser, token });
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
