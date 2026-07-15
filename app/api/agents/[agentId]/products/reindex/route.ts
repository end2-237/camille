// POST /api/agents/[agentId]/products/reindex
// (Re)calcule les embeddings texte des produits actifs (recherche sémantique).
// Nécessite OPENAI_API_KEY + colonne embedding (migration_catalog_v2).

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { embedText, toVectorLiteral, embeddingsEnabled, productText } from "@/lib/embeddings";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;

  const owns = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  if (!owns.rows.length) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  if (!embeddingsEnabled()) {
    return NextResponse.json({ error: "Recherche sémantique désactivée (OPENAI_API_KEY manquante).", indexed: 0 }, { status: 400 });
  }

  let prods;
  try {
    const r = await query(
      "SELECT id, name, description, category, tags FROM camille.products WHERE agent_id = $1 AND active = true",
      [agentId]
    );
    prods = r.rows;
  } catch {
    return NextResponse.json({ error: "Table produits indisponible." }, { status: 500 });
  }

  let indexed = 0, failed = 0;
  for (const p of prods) {
    const emb = await embedText(productText({ ...p, tags: p.tags }));
    if (!emb) { failed++; continue; }
    try {
      await query(
        "UPDATE camille.products SET embedding = $1::vector, needs_reindex = false WHERE id = $2 AND agent_id = $3",
        [toVectorLiteral(emb), p.id, agentId]
      );
      indexed++;
    } catch {
      // colonne embedding absente → migration non appliquée
      return NextResponse.json({ error: "Colonne embedding absente — appliquez migration_catalog_v2.sql (+ pgvector).", indexed }, { status: 400 });
    }
  }
  return NextResponse.json({ success: true, indexed, failed, total: prods.length });
}
