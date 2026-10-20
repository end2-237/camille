// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/[agentId]/caisse — une vente au comptoir.
//
//   { lignes: [{ productId, qty }], paiement?: "especes" | "momo" | "om", client?: string }
//
// La double saisie tuait le stock : un article vendu en boutique restait
// « disponible » sur WhatsApp, et le client suivant commandait du vide. La
// vente au comptoir passe donc par Camille : le stock baisse, Meta est mis à
// jour, et la vente rejoint le chiffre du jour — sans notification, le
// commerçant est déjà devant son client.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { applyStock, makeRef } from "@/lib/orders";
import { rafraichirChezMeta } from "@/lib/whatsapp/catalogue-sync";

type RouteContext = { params: Promise<{ agentId: string }> };

const PAIEMENTS: Record<string, string> = { especes: "Espèces", momo: "MTN Mobile Money", om: "Orange Money" };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await peut(user.id, agentId, "ventes"))) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as {
    lignes?: { productId?: string; qty?: number }[]; paiement?: string; client?: string;
  };
  const demandees = (Array.isArray(b.lignes) ? b.lignes : [])
    .map((l) => ({ productId: String(l.productId || ""), qty: Math.max(1, Math.floor(Number(l.qty) || 1)) }))
    .filter((l) => /^[0-9a-f-]{36}$/i.test(l.productId));
  if (!demandees.length) return NextResponse.json({ error: "Ajoutez au moins un article." }, { status: 400 });

  // Le prix et le nom viennent du catalogue, jamais de l'écran.
  const r = await query(
    `SELECT id::text AS id, name, price, COALESCE(currency, 'XAF') AS currency, image_url, stock
       FROM camille.products WHERE agent_id = $1 AND id = ANY($2::uuid[])`,
    [agentId, demandees.map((l) => l.productId)]
  );
  const parId = new Map(r.rows.map((p: Record<string, unknown>) => [String(p.id), p]));
  const items = demandees.flatMap((l) => {
    const p = parId.get(l.productId) as Record<string, unknown> | undefined;
    return p
      ? [{ productId: l.productId, name: String(p.name), qty: l.qty, price: Number(p.price) || 0, currency: String(p.currency), image: (p.image_url as string) || undefined }]
      : [];
  });
  if (!items.length) return NextResponse.json({ error: "Articles introuvables dans ce catalogue." }, { status: 400 });

  const total = items.reduce((t, i) => t + i.price * i.qty, 0);
  const paiement = PAIEMENTS[String(b.paiement || "especes")] || PAIEMENTS.especes;

  let ref = makeRef();
  for (let i = 0; i < 4; i++) {
    const deja = await query("SELECT 1 FROM camille.orders WHERE ref = $1", [ref]);
    if (!deja.rows.length) break;
    ref = makeRef();
  }

  let id: string;
  try {
    const ins = await query(
      `INSERT INTO camille.orders
         (ref, agent_id, items, total, currency, customer_name, source, status, payment_method, fulfillment,
          delivery_fee, processing_at, delivered_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'caisse', 'livree', $7, 'sur_place', 0, NOW(), NOW())
       RETURNING id`,
      [ref, agentId, JSON.stringify(items), total, items[0].currency, String(b.client || "").trim().slice(0, 120) || null, paiement]
    );
    id = String(ins.rows[0].id);
  } catch (e) {
    return NextResponse.json({ error: "Vente non enregistrée", detail: (e as Error).message }, { status: 500 });
  }

  const stock = await applyStock(agentId, items);
  rafraichirChezMeta(agentId, stock.touches).catch(() => {});

  return NextResponse.json({
    ok: true, id, ref, total, currency: items[0].currency,
    // Ce qui passe sous le seuil : à recommander.
    bas: stock.low, manquants: stock.ruptures,
  });
}
