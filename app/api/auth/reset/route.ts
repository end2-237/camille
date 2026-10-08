// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/auth/reset?jeton=… — le lien est-il encore bon ? (pour la page)
// POST /api/auth/reset { jeton, password } — pose le nouveau mot de passe,
// consomme le jeton et ferme toutes les sessions ouvertes du compte.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";

const empreinte = (j: string) => createHash("sha256").update(j).digest("hex");

const INVALIDE = { error: "Ce lien n'est plus valable. Demandez-en un nouveau." };

export async function GET(req: NextRequest) {
  const jeton = req.nextUrl.searchParams.get("jeton") || "";
  if (!jeton) return NextResponse.json({ valide: false });
  const { rows } = await query(
    `SELECT u.email FROM camille.password_resets r JOIN camille.users u ON u.id = r.user_id
      WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > NOW()`,
    [empreinte(jeton)]
  );
  if (!rows[0]) return NextResponse.json({ valide: false });
  // L'adresse est masquée : le lien prouve l'accès à la boîte, pas plus.
  const [loc, dom] = String(rows[0].email).split("@");
  return NextResponse.json({ valide: true, email: `${loc.slice(0, 2)}${"•".repeat(Math.max(1, loc.length - 2))}@${dom}` });
}

const schema = z.object({ jeton: z.string().min(10), password: z.string().min(8, "Minimum 8 caractères") });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
  }
  const { jeton, password } = parsed.data;

  // Consommer le jeton d'abord, en une requête : deux envois simultanés du
  // même lien ne peuvent pas réussir tous les deux.
  const { rows } = await query(
    `UPDATE camille.password_resets SET used_at = NOW()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
      RETURNING user_id`,
    [empreinte(jeton)]
  );
  if (!rows[0]) return NextResponse.json(INVALIDE, { status: 400 });
  const userId = rows[0].user_id;

  await query(`UPDATE camille.users SET password_hash = $2 WHERE id = $1`, [userId, await hashPassword(password)]);
  // Les autres liens encore ouverts et toutes les sessions tombent avec l'ancien mot de passe.
  await query(`UPDATE camille.password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`, [userId]);
  await query(`DELETE FROM camille.sessions WHERE user_id = $1`, [userId]);

  return NextResponse.json({ ok: true });
}
