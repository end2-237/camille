import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = "7d";

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string };
  } catch {
    return null;
  }
}

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  /** Accès à la console d'exploitation. Faux tant que la migration n'est pas passée. */
  is_admin: boolean;
};

export async function getUserFromRequest(
  req: NextRequest
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;

  // to_jsonb plutôt que u.is_admin : sur une base où migration_admin.sql n'est
  // pas encore passée, demander la colonne ferait échouer TOUTE
  // l'authentification. Un déploiement ne doit pas dépendre de l'ordre dans
  // lequel on applique les migrations.
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.plan, u.created_at,
            COALESCE((to_jsonb(u)->>'is_admin')::boolean, FALSE) AS is_admin
     FROM camille.sessions s
     JOIN camille.users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0] as AuthUser;
}

/**
 * Comme getUserFromRequest, mais refuse quiconque n'est pas administrateur.
 *
 * Renvoie `null` dans les deux cas — non authentifié et non autorisé — pour ne
 * pas révéler l'existence de la console à un compte ordinaire qui tâtonne.
 */
export async function getAdminFromRequest(
  req: NextRequest
): Promise<AuthUser | null> {
  const user = await getUserFromRequest(req);
  return user?.is_admin ? user : null;
}

export function tokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}
