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
  const { action, photo, lat, lng } = (await req.json().catch(() => ({}))) as {
    action?: string; photo?: string | null; lat?: number; lng?: number;
  };

  const o = await query(
    "SELECT id, agent_id, ref, status, courier_id, courier_name FROM camille.orders WHERE id = $1",
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
    // Une course ne se prend qu'une fois : sans cette condition, un second
    // livreur écrasait le premier, et deux motos partaient pour un seul colis.
    const r = await query(
      `UPDATE camille.orders
          SET courier_id = $1, courier_name = $2,
              picked_up_at = COALESCE(picked_up_at, NOW()), updated_at = NOW()
        WHERE id = $3 AND (courier_id IS NULL OR courier_id = $1) RETURNING *`,
      [courier.id, courier.display_name || user.full_name || user.email, orderId]
    );
    if (!r.rows.length) {
      return NextResponse.json(
        { error: `Cette course est déjà prise par ${order.courier_name || "un autre livreur"}.` },
        { status: 409 }
      );
    }
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

    // La preuve de remise : où, et (si le livreur l'a prise) la photo. En cas
    // de litige « je n'ai rien reçu », c'est elle qui tranche.
    const preuve = await enregistrerPreuve(String(orderId), String(order.agent_id), photo, lat, lng);
    if (preuve) Object.assign(livree, preuve);

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

const coreUrl = () => (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");

async function enregistrerPreuve(
  orderId: string, agentId: string, photo?: string | null, lat?: number, lng?: number
): Promise<{ proof_url?: string | null; delivered_lat?: number | null; delivered_lng?: number | null } | null> {
  let url: string | null = null;
  const m = String(photo || "").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (m && m[2].length < 7_000_000) {
    try {
      const res = await fetch(`${coreUrl()}/api/media/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": process.env.CAMILLE_CORE_API_KEY ?? "" },
        body: JSON.stringify({
          name: `${agentId.replace(/-/g, "")}_preuve_${orderId.slice(0, 8)}_${Date.now()}.jpg`,
          data: m[2],
          mimeType: m[1],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) url = ((await res.json()) as { url?: string }).url || null;
    } catch (e) {
      console.error("[livraison] photo de remise non enregistrée :", (e as Error).message);
    }
  }
  const okLat = Number.isFinite(Number(lat)) ? Number(lat) : null;
  const okLng = Number.isFinite(Number(lng)) ? Number(lng) : null;
  if (!url && okLat == null) return null;
  try {
    await query(
      `UPDATE camille.orders
          SET proof_url = COALESCE($2, proof_url), delivered_lat = COALESCE($3, delivered_lat), delivered_lng = COALESCE($4, delivered_lng)
        WHERE id = $1`,
      [orderId, url, okLat, okLng]
    );
  } catch (e) {
    // Colonnes absentes (migration_livraison.sql) : la livraison reste valide.
    console.warn("[livraison] preuve non enregistrée :", (e as Error).message);
    return null;
  }
  return { proof_url: url, delivered_lat: okLat, delivered_lng: okLng };
}
