// POST /api/push/register — enregistre le jeton FCM d'un appareil.
// DELETE                  — le désactive (déconnexion).
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim();
  const platform = ["android", "ios", "web"].includes(b.platform) ? b.platform : "android";
  if (token.length < 20) return NextResponse.json({ error: "Jeton invalide" }, { status: 400 });

  try {
    // Le même appareil peut changer de compte : le jeton suit l'utilisateur.
    await query(
      `INSERT INTO camille.push_tokens (user_id, token, platform)
       VALUES ($1,$2,$3)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
             active = TRUE, last_error = NULL, updated_at = NOW()`,
      [user.id, token, platform]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "Table des jetons absente — applique migration_push.sql",
      detail: (e as Error).message,
    });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim();
  if (!token) return NextResponse.json({ ok: true });

  try {
    await query(
      "UPDATE camille.push_tokens SET active = FALSE, updated_at = NOW() WHERE token = $1 AND user_id = $2",
      [token, user.id]
    );
  } catch { /* table absente : rien à désactiver */ }
  return NextResponse.json({ ok: true });
}
