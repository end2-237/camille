// ─────────────────────────────────────────────────────────────────────────────
// GET /api/courier/orders/[orderId]/itinerary?from=lat,lng
//
// Le trajet du livreur jusqu'au client. La différence avec l'itinéraire du
// commerçant tient dans le point de départ : celui-ci part d'OÙ EST LE
// LIVREUR, pas de la boutique. C'est ce qui permet de recalculer la route
// pendant qu'il roule, et de voir la distance fondre.
//
// OSRM (projet OpenStreetMap), public et sans clé.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { courierFor } from "@/lib/couriers";

type RouteContext = { params: Promise<{ orderId: string }> };

const coord = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;

  const r = await query(
    `SELECT o.lat, o.lng, o.agent_id, a.latitude AS shop_lat, a.longitude AS shop_lng
       FROM camille.orders o JOIN camille.agents a ON a.id = o.agent_id
      WHERE o.id = $1`,
    [orderId]
  );
  const o = r.rows[0];
  if (!o) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  if (!(await courierFor(user.id, o.agent_id))) {
    return NextResponse.json({ error: "Cette commande n'est pas la vôtre." }, { status: 403 });
  }

  const dLat = coord(o.lat), dLng = coord(o.lng);
  if (dLat == null || dLng == null) {
    return NextResponse.json({ ok: false, reason: "no_customer_position" });
  }

  // Départ : la position envoyée par le téléphone du livreur ; à défaut la
  // boutique, le temps que le GPS se cale.
  const [fLatRaw, fLngRaw] = String(req.nextUrl.searchParams.get("from") || "").split(",");
  const fLat = coord(fLatRaw) ?? coord(o.shop_lat);
  const fLng = coord(fLngRaw) ?? coord(o.shop_lng);
  if (fLat == null || fLng == null) {
    return NextResponse.json({ ok: false, reason: "no_start", to: { lat: dLat, lng: dLng } });
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fLng},${fLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return NextResponse.json({ ok: false, reason: "router_unavailable", to: { lat: dLat, lng: dLng }, from: { lat: fLat, lng: fLng } });

    const j = await res.json();
    const route = j?.routes?.[0];
    if (!route) return NextResponse.json({ ok: false, reason: "no_route", to: { lat: dLat, lng: dLng }, from: { lat: fLat, lng: fLng } });

    const coords: [number, number][] = route.geometry?.coordinates || [];
    return NextResponse.json({
      ok: true,
      distance_m: Math.round(route.distance || 0),
      duration_s: Math.round(route.duration || 0),
      from: { lat: fLat, lng: fLng },
      to: { lat: dLat, lng: dLng },
      points: coords.map(([lng, lat]) => ({ lat, lng })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: "error", detail: (e as Error).message, to: { lat: dLat, lng: dLng } });
  }
}
