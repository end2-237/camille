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
    // 0) source du catalogue PAR AGENT (multi-tenant sûr) : défaut = catalogue Camille
    //    de l'agent (jamais OFS par défaut, sinon fuite entre comptes). OFS uniquement si :
    //    - la colonne catalog_source de l'agent le dit ('ofs_cj' / 'ofs_shop'), OU
    //    - l'agent est l'agent OFS désigné par OFS_LIVE_AGENT_ID (repli avant migration).
    const OFS_LIVE_AGENT = process.env.OFS_LIVE_AGENT_ID || "";
    let src = "camille";
    let ofsVendorId: string | null = null;
    try {
      const cfg = await query("SELECT catalog_source, ofs_vendor_id FROM camille.agents WHERE id = $1", [agentId]);
      if (cfg.rows.length && cfg.rows[0].catalog_source) { src = cfg.rows[0].catalog_source; ofsVendorId = cfg.rows[0].ofs_vendor_id || null; }
      else if (ofsLiveEnabled() && OFS_LIVE_AGENT && OFS_LIVE_AGENT === agentId) src = "ofs_cj";
    } catch {
      // colonnes absentes → OFS uniquement pour l'agent désigné (pas de fuite globale)
      if (ofsLiveEnabled() && OFS_LIVE_AGENT && OFS_LIVE_AGENT === agentId) src = "ofs_cj";
    }

    if (src === "ofs_cj" || src === "ofs_shop") {
      try {
        const opts = src === "ofs_shop" && ofsVendorId ? { vendorId: ofsVendorId } : { cjOnly: true };
        const rows = await searchOfs(q, limit, opts);
        return NextResponse.json({ query: q, mode: src === "ofs_shop" ? "ofs-shop" : "ofs-live", count: rows.length, products: rows });
      } catch (e) {
        console.error("[ofs]", e); // échec OFS → repli DB locale
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
