// PATCH  /api/agents/[agentId]/products/[productId]  → met à jour un produit
// DELETE /api/agents/[agentId]/products/[productId]  → supprime un produit

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string; productId: string }> };

const FIELDS = new Set([
  "name", "description", "price", "price_max", "currency", "category",
  "tags", "stock", "min_order", "rating", "image_url", "product_url", "active", "sort_order",
  "variants", "images",
]);

async function assertOwner(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const r = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  return r.rows.length ? user : null;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { agentId, productId } = await params;
  if (!(await assertOwner(req, agentId))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const entries = Object.entries(body).filter(([k]) => FIELDS.has(k));
  if (!entries.length) return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 });

  const set = entries.map(([k], i) => `"${k}" = $${i + 3}`).join(", ");
  const vals = entries.map(([k, v]) =>
    ["tags", "variants", "images"].includes(k) ? JSON.stringify(Array.isArray(v) ? v : []) : v
  );

  const r = await query(
    `UPDATE camille.products SET ${set}, updated_at = NOW()
     WHERE id = $1 AND agent_id = $2 RETURNING *`,
    [productId, agentId, ...vals]
  );
  if (!r.rows.length) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  return NextResponse.json({ product: r.rows[0] });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { agentId, productId } = await params;
  if (!(await assertOwner(req, agentId))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await query("DELETE FROM camille.products WHERE id = $1 AND agent_id = $2", [productId, agentId]);
  return NextResponse.json({ success: true });
}
