// GET/POST /api/agents/[agentId]/products/search-by-image
//   body/query: { imageUrl }  → décrit l'image puis cherche les produits similaires.
// Publique (appelée par n8n quand le client envoie une photo).
// Approche : vision → mots-clés → recherche sémantique/plein-texte.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { describeImage, embedText, toVectorLiteral } from "@/lib/embeddings";

type RouteContext = { params: Promise<{ agentId: string }> };

const COLS = `id, name, description, price, price_max, currency, category, tags, stock, image_url, product_url, variants`;

async function run(agentId: string, imageUrl: string, limit: number) {
  const desc = await describeImage(imageUrl);
  if (!desc) {
    return { error: "Recherche par image indisponible (OPENAI_API_KEY manquante).", products: [] as unknown[] };
  }
  // 1) sémantique
  const emb = await embedText(desc);
  if (emb) {
    try {
      const res = await query(
        `SELECT ${COLS} FROM camille.products
         WHERE agent_id = $1 AND active = true AND embedding IS NOT NULL
         ORDER BY embedding <=> $2::vector LIMIT $3`,
        [agentId, toVectorLiteral(emb), limit]
      );
      if (res.rows.length) return { keywords: desc, mode: "semantic", products: res.rows };
    } catch { /* pas de pgvector → repli */ }
  }
  // 2) repli plein-texte sur les mots-clés
  const res = await query(
    `SELECT ${COLS} FROM camille.products
     WHERE agent_id = $1 AND active = true
       AND ( to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,''))
             @@ plainto_tsquery('simple', $2) OR name ILIKE '%' || $2 || '%' OR category ILIKE '%' || $2 || '%' )
     ORDER BY sort_order ASC LIMIT $3`,
    [agentId, desc, limit]
  );
  return { keywords: desc, mode: "keyword", products: res.rows };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const body = await req.json().catch(() => ({}));
  const imageUrl = body.imageUrl || body.image_url;
  const limit = Math.min(Number(body.limit) || 6, 12);
  if (!imageUrl) return NextResponse.json({ error: "imageUrl requis" }, { status: 400 });
  try {
    return NextResponse.json(await run(agentId, imageUrl, limit));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const imageUrl = req.nextUrl.searchParams.get("imageUrl") || "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 6, 12);
  if (!imageUrl) return NextResponse.json({ error: "imageUrl requis" }, { status: 400 });
  try {
    return NextResponse.json(await run(agentId, imageUrl, limit));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
