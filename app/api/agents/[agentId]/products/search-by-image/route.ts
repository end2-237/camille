// GET/POST /api/agents/[agentId]/products/search-by-image
//   body/query: { imageUrl }  → trouve les produits visuellement proches.
// Publique (appelée par n8n quand le client envoie une photo).
//
// Technique : embedding CLIP local de l'image entrante → similarité dans le
// magasin de vecteurs intégré (fichier, Option A) → on récupère les produits
// correspondants dans Postgres (LECTURE seule, aucune modification de schéma).
// Replis : (1) CLIP + magasin, (2) OpenAI Vision → mots-clés, (3) plein-texte.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { embedImage, imageEmbeddingsEnabled } from "@/lib/imageEmbeddings";
import { searchImageScored, indexStats } from "@/lib/vectorStore";
import { describeImage } from "@/lib/embeddings";

type RouteContext = { params: Promise<{ agentId: string }> };

const COLS = `id, name, description, price, price_max, currency, category, tags, stock, image_url, product_url, variants`;

/** Récupère les produits par ids (lecture seule) en conservant l'ordre de similarité. */
async function fetchByIds(agentId: string, ids: string[]) {
  if (!ids.length) return [];
  const res = await query(
    `SELECT ${COLS} FROM camille.products
     WHERE agent_id = $1 AND active = true AND id = ANY($2::uuid[])`,
    [agentId, ids]
  );
  const byId = new Map(res.rows.map((r) => [String(r.id), r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** (1) CLIP + magasin de vecteurs intégré. Renvoie {rows} (avec score) ou {fail}. */
async function clipSearch(agentId: string, imageUrl: string, limit: number) {
  const emb = await embedImage(imageUrl);
  if (!emb) return { fail: "clip_query_failed" as const };
  const scored = await searchImageScored(agentId, emb, limit);
  if (!scored.length) return { fail: "index_empty" as const };
  const rows = await fetchByIds(agentId, scored.map((s) => s.id));
  // attache le score de similarité (arrondi) à chaque produit
  const scoreById = new Map(scored.map((s) => [s.id, s.score]));
  const withScore = rows.map((r) => ({ ...r, score: Math.round((scoreById.get(String(r.id)) ?? 0) * 1000) / 1000 }));
  return { rows: withScore };
}

/** (2) OpenAI Vision : décrit l'image → recherche plein-texte sur les mots-clés. */
async function visionSearch(agentId: string, imageUrl: string, limit: number) {
  const desc = await describeImage(imageUrl);
  if (!desc) return null;
  const res = await query(
    `SELECT ${COLS} FROM camille.products
     WHERE agent_id = $1 AND active = true
       AND ( to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,''))
             @@ plainto_tsquery('simple', $2) OR name ILIKE '%' || $2 || '%' OR category ILIKE '%' || $2 || '%' )
     ORDER BY sort_order ASC LIMIT $3`,
    [agentId, desc, limit]
  );
  return { keywords: desc, rows: res.rows };
}

async function run(agentId: string, imageUrl: string, limit: number) {
  const clip = await clipSearch(agentId, imageUrl, limit);
  if ("rows" in clip && clip.rows && clip.rows.length) return { mode: "clip", products: clip.rows };

  // diagnostic précis quand CLIP ne donne rien
  const stats = await indexStats(agentId);
  const clipFail = "fail" in clip ? clip.fail : null;

  const vis = await visionSearch(agentId, imageUrl, limit);
  if (vis) return { mode: "vision", keywords: vis.keywords, products: vis.rows };

  return {
    error:
      clipFail === "clip_query_failed"
        ? "Le service CLIP n'a pas pu vectoriser l'image de la requête (URL injoignable depuis le VPS, ou CLIP_SERVICE_URL absent/KO)."
        : "Aucun vecteur image pour cet agent côté recherche (index non partagé : volume /app/data/vectors non monté, ou reindex sur un autre conteneur).",
    diagnostic: { clipFail, indexImageCount: stats.image, clipEnabled: imageEmbeddingsEnabled() },
    products: [] as unknown[],
  };
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
