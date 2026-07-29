// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/[orderId]/itinerary
// Trajet boutique → client : distance, durée et tracé.
// S'appuie sur OSRM (projet OpenStreetMap), public et sans clé d'API.
// Passe par le serveur plutôt que par le client : une seule source à changer
// le jour où l'on prend un fournisseur payant, et pas de souci de CORS.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;

  try {
    const r = await query(
      `SELECT o.lat, o.lng, o.address, a.latitude AS shop_lat, a.longitude AS shop_lng
         FROM camille.orders o
         JOIN camille.agents a ON a.id = o.agent_id
        WHERE a.user_id = $1 AND o.id = $2`,
      [user.id, orderId]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const o = r.rows[0];
    const dLat = Number(o.lat), dLng = Number(o.lng);
    const sLat = Number(o.shop_lat), sLng = Number(o.shop_lng);

    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      return NextResponse.json({ ok: false, reason: "no_customer_position" });
    }
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) {
      // La boutique n'a pas de coordonnées : on ne peut pas tracer de trajet,
      // mais la destination reste ouvrable dans Maps côté client.
      return NextResponse.json({ ok: false, reason: "no_shop_position", to: { lat: dLat, lng: dLng } });
    }

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${sLng},${sLat};${dLng},${dLat}?overview=simplified&geometries=geojson`;

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return NextResponse.json({ ok: false, reason: "router_unavailable" });

    const j = await res.json();
    const route = j?.routes?.[0];
    if (!route) return NextResponse.json({ ok: false, reason: "no_route" });

    // [lng,lat] chez OSRM → {lat,lng} pour l'affichage
    const coords: [number, number][] = route.geometry?.coordinates || [];
    return NextResponse.json({
      ok: true,
      distance_m: Math.round(route.distance || 0),
      duration_s: Math.round(route.duration || 0),
      from: { lat: sLat, lng: sLng },
      to: { lat: dLat, lng: dLng },
      points: coords.map(([lng, lat]) => ({ lat, lng })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: "error", detail: (e as Error).message });
  }
}
