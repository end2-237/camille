// GET  /api/agents/[agentId]/products        → liste des produits (auth propriétaire)
// POST /api/agents/[agentId]/products        → crée un produit (auth propriétaire)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { coerce } from "@/lib/productFields";

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

  let r;
  try {
    r = await query(
      `INSERT INTO camille.products
         (agent_id, name, description, price, price_max, currency, category, tags,
          stock, min_order, rating, image_url, product_url, active, sort_order, variants, images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        agentId,
        String(b.name).trim(),
        coerce("description", b.description),
        coerce("price", b.price),
        coerce("price_max", b.price_max),
        coerce("currency", b.currency),
        coerce("category", b.category),
        coerce("tags", b.tags),
        coerce("stock", b.stock),
        coerce("min_order", b.min_order),
        coerce("rating", b.rating),
        coerce("image_url", b.image_url),
        coerce("product_url", b.product_url),
        coerce("active", b.active),
        coerce("sort_order", b.sort_order),
        coerce("variants", b.variants),
        coerce("images", b.images),
      ]
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Création impossible", detail: (e as Error).message },
      { status: 500 }
    );
  }
  return NextResponse.json({ product: r.rows[0] }, { status: 201 });
}
