// PATCH /api/orders/[orderId] — fait avancer une commande dans son cycle de vie.
// nouvelle (à traiter) → en_traitement → livree ; annulee possible à tout moment.
// "traitee" est conservé : les commandes créées avant l'ajout du cycle l'utilisent.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ orderId: string }> };
const ALLOWED = ["nouvelle", "en_traitement", "livree", "traitee", "annulee"];

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  // Horodatage de chaque étape : c'est ce qui alimente le suivi côté app.
  // COALESCE : on ne réécrit jamais une date déjà posée, l'historique reste vrai.
  const r = await query(
    `UPDATE camille.orders o
        SET status        = $1,
            note          = COALESCE($2, o.note),
            processing_at = CASE WHEN $1 IN ('en_traitement','livree','traitee')
                                 THEN COALESCE(o.processing_at, NOW()) ELSE o.processing_at END,
            delivered_at  = CASE WHEN $1 = 'livree'
                                 THEN COALESCE(o.delivered_at, NOW()) ELSE o.delivered_at END,
            updated_at    = NOW()
       FROM camille.agents a
      WHERE o.agent_id = a.id AND a.user_id = $3 AND o.id = $4
      RETURNING o.*`,
    [status, body.note ?? null, user.id, orderId]
  );
  if (!r.rows.length) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  return NextResponse.json({ order: r.rows[0] });
}
