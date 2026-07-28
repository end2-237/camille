// PATCH /api/orders/[orderId] — change le statut d'une commande (nouvelle | traitee | annulee)
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ orderId: string }> };
const ALLOWED = ["nouvelle", "traitee", "annulee"];

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const r = await query(
    `UPDATE camille.orders o
        SET status = $1, note = COALESCE($2, o.note), updated_at = NOW()
       FROM camille.agents a
      WHERE o.agent_id = a.id AND a.user_id = $3 AND o.id = $4
      RETURNING o.*`,
    [status, body.note ?? null, user.id, orderId]
  );
  if (!r.rows.length) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  return NextResponse.json({ order: r.rows[0] });
}
