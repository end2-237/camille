import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  hashPassword,
  generateToken,
  tokenExpiresAt,
} from "@/lib/auth-server";

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

    const { email, password, full_name } = parsed.data;

    const existing = await query(
      "SELECT id FROM camille.users WHERE email = $1",
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
      `INSERT INTO camille.users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, plan, created_at`,
      [email, password_hash, full_name ?? null]
    );

    const user = userResult.rows[0];
    const token = generateToken(user.id);

    await query(
      `INSERT INTO camille.sessions (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, tokenExpiresAt()]
    );

    return NextResponse.json({ user, token }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
