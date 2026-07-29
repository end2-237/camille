// PATCH /api/orders/[orderId] — fait avancer une commande dans son cycle de vie.
// nouvelle (à traiter) → en_traitement → livree ; annulee possible à tout moment.
// "traitee" est conservé : les commandes créées avant l'ajout du cycle l'utilisent.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { sendOrderDocument } from "@/lib/facturation";

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
  const withTracking = `
    UPDATE camille.orders o
       SET status        = $1,
           note          = COALESCE($2, o.note),
           processing_at = CASE WHEN $1 IN ('en_traitement','livree','traitee')
                                THEN COALESCE(o.processing_at, NOW()) ELSE o.processing_at END,
           delivered_at  = CASE WHEN $1 = 'livree'
                                THEN COALESCE(o.delivered_at, NOW()) ELSE o.delivered_at END,
           updated_at    = NOW()
      FROM camille.agents a
     WHERE o.agent_id = a.id AND a.user_id = $3 AND o.id = $4
     RETURNING o.*`;

  // Repli si les colonnes de suivi n'ont pas encore été migrées : le changement
  // de statut doit marcher quand même, on perd juste l'horodatage des étapes.
  const withoutTracking = `
    UPDATE camille.orders o
       SET status = $1, note = COALESCE($2, o.note), updated_at = NOW()
      FROM camille.agents a
     WHERE o.agent_id = a.id AND a.user_id = $3 AND o.id = $4
     RETURNING o.*`;

  const args = [status, body.note ?? null, user.id, orderId];

  let r;
  try {
    r = await query(withTracking, args);
  } catch (e) {
    // 42703 = undefined_column
    const code = (e as { code?: string }).code;
    if (code !== "42703") {
      return NextResponse.json(
        { error: "Mise à jour impossible", detail: (e as Error).message },
        { status: 500 }
      );
    }
    try {
      r = await query(withoutTracking, args);
    } catch (e2) {
      return NextResponse.json(
        { error: "Mise à jour impossible", detail: (e2 as Error).message },
        { status: 500 }
      );
    }
    const out = r.rows[0];
    if (!out) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    return NextResponse.json({
      order: out,
      warning: "Suivi indisponible — applique migration_orders.sql pour horodater les étapes.",
    });
  }

  if (!r.rows.length) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  const order = r.rows[0];

  // Passage en traitement = accuse de reception : on envoie le bon de commande
  // en PDF au client. On ATTEND le resultat pour pouvoir le remonter dans l'app,
  // mais un echec ne remet jamais en cause le changement de statut.
  let doc: Awaited<ReturnType<typeof sendOrderDocument>> | undefined;
  if (status === "en_traitement" && !order.doc_url) {
    doc = await sendOrderDocument(orderId);
  }

  return NextResponse.json({ order, ...(doc ? { doc } : {}) });
}
