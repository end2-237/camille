// GET  /api/agents/[agentId]/products        → liste des produits (auth propriétaire)
// POST /api/agents/[agentId]/products        → crée un produit (auth propriétaire)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string }> };

async function assertOwner(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const r = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  return r.rows.length ? user : null;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const owner = await assertOwner(req, agentId);
  if (!owner) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const r = await query(
    `SELECT * FROM camille.products WHERE agent_id = $1
     ORDER BY sort_order ASC, created_at DESC`,
    [agentId]
  );
  return NextResponse.json({ products: r.rows });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const owner = await assertOwner(req, agentId);
  if (!owner) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const b = await req.json();
  if (!b.name || !String(b.name).trim()) {
    return NextResponse.json({ error: "Le nom du produit est requis" }, { status: 400 });
  }

  const r = await query(
    `INSERT INTO camille.products
       (agent_id, name, description, price, price_max, currency, category, tags,
        stock, min_order, rating, image_url, product_url, active, sort_order, variants, images)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      agentId,
      String(b.name).trim(),
      b.description ?? "",
      b.price ?? null,
      b.price_max ?? null,
      b.currency ?? "XAF",
      b.category ?? null,
      JSON.stringify(Array.isArray(b.tags) ? b.tags : []),
      b.stock ?? null,
      b.min_order ?? 1,
      b.rating ?? null,
      b.image_url ?? null,
      b.product_url ?? null,
      b.active ?? true,
      b.sort_order ?? 0,
      JSON.stringify(Array.isArray(b.variants) ? b.variants : []),
      JSON.stringify(Array.isArray(b.images) ? b.images : []),
    ]
  );
  return NextResponse.json({ product: r.rows[0] }, { status: 201 });
}
