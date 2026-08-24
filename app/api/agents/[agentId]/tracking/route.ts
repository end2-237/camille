// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents/[agentId]/tracking — le suivi des livraisons, côté vendeur.
//
// Une commande vue depuis l'expédition : où elle va, d'où elle part, qui la
// porte, et l'heure de chaque étape franchie. C'est ce que le commerçant lit
// quand un client appelle pour demander « c'est où ? ».
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { ownsAgent } from "@/lib/companyAccounts";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RouteContext = { params: Promise<{ agentId: string }> };

const parse = (v: unknown) =>
  Array.isArray(v) ? v : (() => { try { return JSON.parse(String(v || "[]")); } catch { return []; } })();

const num = (v: unknown) => (v == null ? null : Number(v));

/** Le fil des étapes, de la plus récente à la plus ancienne. */
function timeline(o: any) {
  const ville = String(o.place_label || o.address || "").split(",")[0]?.trim();
  return [
    { at: o.delivered_at, label: "Commande livrée à l'adresse de destination", kind: "done" },
    { at: o.dispatched_at, label: ville ? `La commande est en route vers ${ville}` : "La commande est en route", kind: "road" },
    { at: o.picked_up_at, label: "Commande remise au livreur", kind: "hand" },
    { at: o.processing_at, label: "Commande en préparation", kind: "pack" },
    { at: o.created_at, label: "Commande reçue", kind: "new" },
  ].filter((e) => e.at);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await ownsAgent(agentId, user.id))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  // to_jsonb sur la commande : les colonnes de livreur viennent d'une migration
  // récente, et leur absence ne doit pas priver le vendeur de son suivi.
  const sql = `
    SELECT o.*,
           (to_jsonb(o)->>'courier_id')    AS courier_ref,
           (to_jsonb(o)->>'courier_name')  AS courier_label,
           (to_jsonb(o)->>'picked_up_at')  AS picked_up,
           a.business_name, a.location AS shop_location,
           a.latitude AS shop_lat, a.longitude AS shop_lng
      FROM camille.orders o
      JOIN camille.agents a ON a.id = o.agent_id
     WHERE o.agent_id = $1
       AND o.status <> 'annulee'
     ORDER BY (o.status = 'en_livraison') DESC, o.created_at DESC
     LIMIT 60`;

  try {
    const r = await query(sql, [agentId]);
    const total = await query(
      "SELECT COUNT(*) AS n FROM camille.orders WHERE agent_id = $1 AND status <> 'annulee'",
      [agentId]
    ).catch(() => ({ rows: [{ n: 0 }] }));

    // Les livreurs et leur dernière position : c'est ce qui fait avancer le
    // point sur la carte.
    let couriers: Record<string, any> = {};
    try {
      const c = await query(
        `SELECT c.id, c.display_name, c.phone, c.last_lat, c.last_lng, c.last_seen_at, u.full_name, u.email
           FROM camille.couriers c JOIN camille.users u ON u.id = c.user_id
          WHERE c.agent_id = $1`,
        [agentId]
      );
      couriers = Object.fromEntries(c.rows.map((x: any) => [String(x.id), x]));
    } catch { /* livreurs non installés : le suivi reste lisible sans eux */ }

    const shipments = r.rows.map((o: any) => {
      const items = parse(o.items);
      const livreur = o.courier_ref ? couriers[String(o.courier_ref)] : null;
      return {
        id: String(o.id),
        ref: o.ref,
        status: o.status,
        created_at: o.created_at,
        scheduled_at: o.scheduled_at ?? null,
        delivered_at: o.delivered_at ?? null,
        items_count: items.reduce((s: number, i: any) => s + (Number(i.qty) || 1), 0),
        total: Number(o.total) || 0,
        currency: o.currency || "XAF",
        customer_name: o.customer_name,
        phone: String(o.contact_phone || "").replace(/@(c\.us|lid|s\.whatsapp\.net)$/, ""),
        to: o.place_label || o.address || null,
        from: o.shop_location || o.business_name || null,
        lat: num(o.lat), lng: num(o.lng),
        shop_lat: num(o.shop_lat), shop_lng: num(o.shop_lng),
        company: o.company_name ?? null,
        timeline: timeline({ ...o, picked_up_at: o.picked_up }),
        courier: livreur
          ? {
              name: livreur.display_name || livreur.full_name || livreur.email,
              phone: livreur.phone ?? null,
              lat: num(livreur.last_lat),
              lng: num(livreur.last_lng),
              last_seen_at: livreur.last_seen_at ?? null,
            }
          : o.courier_label
            ? { name: o.courier_label, phone: null, lat: null, lng: null, last_seen_at: null }
            : null,
      };
    });

    return NextResponse.json({ ready: true, total: Number(total.rows[0]?.n) || shipments.length, shipments });
  } catch (e) {
    return NextResponse.json(
      { ready: false, shipments: [], total: 0, error: "Table des commandes absente — applique migration_orders.sql" },
      { status: (e as { code?: string }).code ? 200 : 500 }
    );
  }
}
