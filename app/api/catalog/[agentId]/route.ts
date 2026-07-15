// GET /api/catalog/[agentId]  → catalogue PUBLIC (JSON) d'un agent.
// C'est le point d'accès API du « lien unique » du catalogue. Aucune auth.
// Ne renvoie que les produits actifs + les infos publiques de la boutique.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  try {
    const agentRes = await query(
      `SELECT id, name, business_name, description, website_url
       FROM camille.agents WHERE id = $1 AND status = 'active'`,
      [agentId]
    );
    if (!agentRes.rows.length) {
      return NextResponse.json({ error: "Catalogue introuvable" }, { status: 404 });
    }
    const prodRes = await query(
      `SELECT id, name, description, price, price_max, currency, category, tags,
              stock, min_order, rating, image_url, product_url
       FROM camille.products
       WHERE agent_id = $1 AND active = true
       ORDER BY sort_order ASC, created_at DESC`,
      [agentId]
    );
    const a = agentRes.rows[0];
    return NextResponse.json({
      shop: {
        id: a.id,
        name: a.business_name || a.name,
        description: a.description,
        website_url: a.website_url,
      },
      count: prodRes.rows.length,
      products: prodRes.rows,
    });
  } catch (err) {
    console.error("[catalog]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
