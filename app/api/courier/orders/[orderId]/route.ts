// ─────────────────────────────────────────────────────────────────────────────
// POST /api/courier/orders/[orderId] — le livreur fait avancer sa course.
//
//   { action: "take"      } il prend la course : elle porte son nom
//   { action: "delivered" } il l'a remise : la commande est livrée
//
// Deux gestes, pas trois : un livreur n'annule pas une commande, ne change pas
// un prix, ne revient pas en arrière. Le reste du cycle appartient au
// commerçant, et la route le vérifie au lieu de faire confiance à l'écran.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { courierFor } from "@/lib/couriers";
import { sendThankYou } from "@/lib/facturation";
import { statusLabel, statusStep } from "@/lib/orderStatus";
import { notify } from "@/lib/webhooks";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  const o = await query(
    "SELECT id, agent_id, ref, status, courier_id FROM camille.orders WHERE id = $1",
    [orderId]
  );
  const order = o.rows[0];
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  const courier = await courierFor(user.id, order.agent_id);
  if (!courier) return NextResponse.json({ error: "Cette commande n'est pas la vôtre." }, { status: 403 });

  // Une course qui n'est pas partie n'appartient pas encore au livreur.
  if (order.status !== "en_livraison") {
    return NextResponse.json(
      { error: `Cette commande est « ${statusLabel(order.status)} » : elle n'est pas en livraison.` },
      { status: 409 }
    );
  }

  if (action === "take") {
    const r = await query(
      `UPDATE camille.orders
          SET courier_id = $1, courier_name = $2,
              picked_up_at = COALESCE(picked_up_at, NOW()), updated_at = NOW()
        WHERE id = $3 RETURNING *`,
      [courier.id, courier.display_name || user.full_name || user.email, orderId]
    );
    return NextResponse.json({ order: r.rows[0] });
  }

  if (action === "delivered") {
    const r = await query(
      `UPDATE camille.orders
          SET status = 'livree',
              delivered_at = COALESCE(delivered_at, NOW()),
              courier_id   = COALESCE(courier_id, $1),
              courier_name = COALESCE(courier_name, $2),
              updated_at   = NOW()
        WHERE id = $3 RETURNING *`,
      [courier.id, courier.display_name || user.full_name || user.email, orderId]
    );
    const livree = r.rows[0];

    // Le site du marchand est prévenu comme si le commerçant avait cliqué :
    // qui a fait avancer la commande ne change rien pour lui.
    notify(order.agent_id, "order.status", {
      ref: livree.ref,
      status: "livree",
      status_label: statusLabel("livree"),
      step: statusStep("livree"),
      by: "courier",
    }).catch(() => {});

    // Le remerciement au client part une seule fois (sendThankYou s'en assure).
    const thanks = await sendThankYou(String(orderId)).catch(() => undefined);

    return NextResponse.json({ order: livree, ...(thanks ? { thanks } : {}) });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
