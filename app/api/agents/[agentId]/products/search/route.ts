// GET /api/agents/[agentId]/products/search?q=...&limit=8
// Recherche catalogue — appelée par n8n (N2) pour ancrer les réponses IA (RAG).
// Publique (pas de JWT) : ne renvoie que les produits ACTIFS de l'agent.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 8, 20);

  try {
    let rows;
    if (q) {
      // Recherche plein-texte + fallback ILIKE pour la tolérance
      const res = await query(
        `SELECT id, name, description, price, price_max, currency, category, tags,
                stock, image_url
         FROM camille.products
         WHERE agent_id = $1 AND active = true
           AND (
             to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,''))
               @@ plainto_tsquery('simple', $2)
             OR name ILIKE '%' || $2 || '%'
             OR category ILIKE '%' || $2 || '%'
           )
         ORDER BY sort_order ASC
         LIMIT $3`,
        [agentId, q, limit]
      );
      rows = res.rows;
    } else {
      const res = await query(
        `SELECT id, name, description, price, price_max, currency, category, tags,
                stock, image_url
         FROM camille.products
         WHERE agent_id = $1 AND active = true
         ORDER BY sort_order ASC, created_at DESC
         LIMIT $2`,
        [agentId, limit]
      );
      rows = res.rows;
    }
    return NextResponse.json({ query: q, count: rows.length, products: rows });
  } catch (err) {
    console.error("[products/search]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
