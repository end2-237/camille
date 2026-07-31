// ─────────────────────────────────────────────────────────────────────────────
// GET   /api/notifications        — journal du compte (centre de notifications)
// PATCH /api/notifications        — marque comme lu ({ id } ou { all: true })
//
// Toutes les notifications push sont journalisées ici par lib/fcm. Cette page
// reste donc utile même quand le push est coupé ou refusé par l'utilisateur.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const limit = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "60", 10)));

  try {
    const r = await query(
      `SELECT id, kind, title, body, data, read_at, created_at
         FROM camille.notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [user.id, limit]
    );
    // Le compte doit porter sur TOUTES les notifications, pas sur la page
    // renvoyee : l'app demandait limit=1 pour n'avoir que le compteur, et
    // recevait donc 0 ou 1, jamais davantage. Le badge restait bloque sur 1.
    const c = await query(
      "SELECT COUNT(*)::int AS n FROM camille.notifications WHERE user_id = $1 AND read_at IS NULL",
      [user.id]
    );
    return NextResponse.json({ notifications: r.rows, unread: c.rows[0]?.n ?? 0 });
  } catch (e) {
    return NextResponse.json({
      notifications: [],
      unread: 0,
      error: "Table des notifications absente — applique migration_push.sql",
      detail: (e as Error).message,
    });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({}));

  try {
    if (b.all) {
      await query(
        "UPDATE camille.notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL",
        [user.id]
      );
    } else if (b.id) {
      await query(
        "UPDATE camille.notifications SET read_at = NOW() WHERE user_id = $1 AND id = $2",
        [user.id, b.id]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
