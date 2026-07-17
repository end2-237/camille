// GET /api/agents/[agentId]/products/search?q=...&limit=8
// Recherche catalogue — appelée par n8n (N2) pour ancrer les réponses IA (RAG).
// Publique (pas de JWT) : ne renvoie que les produits ACTIFS de l'agent.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { embedText } from "@/lib/embeddings";
import { searchText } from "@/lib/vectorStore";
import { ofsLiveEnabled, searchOfs } from "@/lib/ofs";

type RouteContext = { params: Promise<{ agentId: string }> };

const COLS = `id, name, description, price, price_max, currency, category, tags, stock, image_url, product_url, variants`;

/** Recherche sémantique via le magasin de vecteurs intégré (fichier).
 *  Renvoie null si indisponible (pas d'index ou pas d'OPENAI_API_KEY) → repli mots-clés. */
async function semanticSearch(agentId: string, q: string, limit: number) {
  const emb = await embedText(q);
  if (!emb) return null;
  const ids = await searchText(agentId, emb, limit);
  if (!ids.length) return null;
  const res = await query(
    `SELECT ${COLS} FROM camille.products
     WHERE agent_id = $1 AND active = true AND id = ANY($2::uuid[])`,
    [agentId, ids]
  );
  const byId = new Map(res.rows.map((r) => [String(r.id), r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  return ordered.length ? ordered : null;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 8, 20);

  try {
    // 0) mode LIVE OFS : le catalogue vient de la marketplace en direct (pas de la DB Camille)
    if (ofsLiveEnabled()) {
      try {
        const rows = await searchOfs(q, limit, { cjOnly: true });
        return NextResponse.json({ query: q, mode: "ofs-live", count: rows.length, products: rows });
      } catch (e) {
        console.error("[ofs-live]", e); // en cas d'échec OFS → on retombe sur la DB locale
      }
    }
    // 1) recherche sémantique si disponible
    if (q) {
      const sem = await semanticSearch(agentId, q, limit);
      if (sem) return NextResponse.json({ query: q, mode: "semantic", count: sem.length, products: sem });
    }
    // 2) repli mots-clés / plein-texte
    let rows;
    if (q) {
      // Recherche plein-texte + fallback ILIKE pour la tolérance
      const res = await query(
        `SELECT id, name, description, price, price_max, currency, category, tags,
                stock, image_url, product_url, variants
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
                stock, image_url, product_url, variants
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
