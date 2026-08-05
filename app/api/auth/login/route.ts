import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { verifyPassword, generateToken, tokenExpiresAt } from "@/lib/auth-server";

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

    // is_admin est lu ici parce que c'est cet objet-là qui finit dans le
    // navigateur et qui décide de l'affichage de la console d'exploitation.
    // to_jsonb plutôt que u.is_admin : sur une base où migration_admin.sql
    // n'est pas passée, demander la colonne ferait échouer TOUTE connexion.
    const result = await query(
      `SELECT id, email, full_name, plan, password_hash,
              COALESCE((to_jsonb(users)->>'is_admin')::boolean, FALSE) AS is_admin
         FROM camille.users WHERE email = $1`,
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
