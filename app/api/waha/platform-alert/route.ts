// ─────────────────────────────────────────────────────────────────────────────
// POST /api/waha/platform-alert
//
// Appelée par camille-core quand sa veille voit quelque chose bouger côté
// WhatsApp — typiquement une version de la bibliothèque publiée, qui paraît
// presque toujours parce que le protocole a changé.
//
// C'est un signal AVANCÉ : il arrive quelques jours avant les déconnexions.
// Il ne s'adresse donc pas aux vendeurs — ils n'ont rien à en faire — mais aux
// comptes administrateurs, qui peuvent programmer la montée de version avant
// que ça ne casse plutôt qu'après.
//
// Route serveur à serveur : clé partagée, pas de compte.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";

const CORE_KEY = () => process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

export async function POST(req: NextRequest) {
  if ((req.headers.get("x-api-key") ?? "") !== CORE_KEY()) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 401 });
  }

  let body: { niveau?: string; diagnostic?: string; prevision?: string; version?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const diagnostic = String(body.diagnostic ?? "").trim();
  const prevision = String(body.prevision ?? "").trim();
  const version = String(body.version ?? "").trim();
  if (!diagnostic) {
    return NextResponse.json({ error: "diagnostic requis" }, { status: 400 });
  }

  try {
    // to_jsonb : sur une base où migration_admin.sql n'est pas encore passée,
    // demander la colonne ferait échouer la requête entière.
    const r = await query(
      `SELECT id FROM camille.users
        WHERE COALESCE((to_jsonb(users)->>'is_admin')::boolean, FALSE)`
    );
    const admins = r.rows as { id: string }[];
    if (!admins.length) {
      return NextResponse.json({ ok: true, notified: 0, reason: "aucun administrateur" });
    }

    await Promise.all(
      admins.map((a) =>
        notifyUser(a.id, "systeme", {
          title: "Mouvement côté WhatsApp",
          body: prevision ? `${diagnostic} ${prevision}` : diagnostic,
          channel: "alertes",
          data: { type: "platform_update", version },
        }).catch(() => {})
      )
    );

    return NextResponse.json({ ok: true, notified: admins.length });
  } catch (err) {
    console.error("[POST /api/waha/platform-alert]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
