// ─────────────────────────────────────────────────────────────────────────────
// GET /api/courier/orders — les courses du livreur connecté.
//
// Uniquement les commandes PARTIES en livraison, et uniquement pour les
// boutiques auxquelles ce compte est rattaché. Ni le catalogue, ni le chiffre
// d'affaires, ni les fiches clients : un livreur a besoin d'une adresse, d'un
// numéro et d'un trajet.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { COURIERS_MISSING, missionsOf, ridesFor } from "@/lib/couriers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const items = (v: unknown) =>
  Array.isArray(v) ? v : (() => { try { return JSON.parse(String(v || "[]")); } catch { return []; } })();

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const [missions, rides] = await Promise.all([missionsOf(user.id), ridesFor(user.id)]);
    return NextResponse.json({
      ready: true,
      courier: true,
      missions: missions.map((m) => ({ agent_id: m.agent_id, shop: m.business_name || m.agent_name })),
      orders: rides.map((o: any) => ({
        id: String(o.id),
        ref: o.ref,
        agent_id: o.agent_id,
        shop: o.shop_name,
        shop_location: o.shop_location,
        status: o.status,
        total: Number(o.total) || 0,
        currency: o.currency || "XAF",
        // Le détail des plats ne regarde pas le livreur : le nombre suffit à
        // vérifier qu'il emporte le bon nombre de sacs.
        items_count: items(o.items).reduce((s: number, i: any) => s + (Number(i.qty) || 1), 0),
        customer_name: o.customer_name,
        phone: String(o.contact_phone || "").replace(/@(c\.us|lid|s\.whatsapp\.net)$/, ""),
        address: o.place_label || o.address,
        note: o.note,
        company: o.company_name,
        payment_method: o.payment_method,
        lat: o.lat == null ? null : Number(o.lat),
        lng: o.lng == null ? null : Number(o.lng),
        shop_lat: o.shop_lat == null ? null : Number(o.shop_lat),
        shop_lng: o.shop_lng == null ? null : Number(o.shop_lng),
        scheduled_at: o.scheduled_at,
        dispatched_at: o.dispatched_at,
        picked_up_at: o.picked_up_at,
        mine: o.courier_id != null,
      })),
    });
  } catch (e) {
    const c = (e as { code?: string }).code;
    if (c === "42703" || c === "42P01") {
      return NextResponse.json({ ready: false, orders: [], error: COURIERS_MISSING });
    }
    return NextResponse.json({ ready: false, orders: [], error: (e as Error).message }, { status: 500 });
  }
}
