// POST /api/agents/[agentId]/products/reindex
// (Re)calcule les embeddings des produits actifs :
//   - embedding TEXTE (recherche sémantique)  → OpenAI, colonne `embedding` vector(1536)
//   - embedding IMAGE (recherche visuelle CLIP) → local, colonne `image_embedding` vector(512)
// Chaque volet s'exécute s'il est disponible ; l'un peut marcher sans l'autre.
// Nécessite migration_catalog_v2 (+ pgvector).

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { embedText, toVectorLiteral, embeddingsEnabled, productText } from "@/lib/embeddings";
import { embedImage, imageEmbeddingsEnabled } from "@/lib/imageEmbeddings";

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

  const doText = embeddingsEnabled();
  const doImage = imageEmbeddingsEnabled();
  if (!doText && !doImage) {
    return NextResponse.json(
      { error: "Aucun moteur d'embedding disponible (ni OPENAI_API_KEY texte, ni CLIP image).", indexed: 0 },
      { status: 400 }
    );
  }

  let prods;
  try {
    const r = await query(
      "SELECT id, name, description, category, tags, image_url FROM camille.products WHERE agent_id = $1 AND active = true",
      [agentId]
    );
    prods = r.rows;
  } catch {
    return NextResponse.json({ error: "Table produits indisponible." }, { status: 500 });
  }

  let textIndexed = 0, imageIndexed = 0, failed = 0;
  for (const p of prods) {
    let touched = false;

    // 1) embedding texte
    if (doText) {
      const emb = await embedText(productText({ ...p, tags: p.tags }));
      if (emb) {
        try {
          await query(
            "UPDATE camille.products SET embedding = $1::vector WHERE id = $2 AND agent_id = $3",
            [toVectorLiteral(emb), p.id, agentId]
          );
          textIndexed++; touched = true;
        } catch {
          return NextResponse.json(
            { error: "Colonne embedding absente — appliquez migration_catalog_v2.sql (+ pgvector).", indexed: textIndexed },
            { status: 400 }
          );
        }
      }
    }

    // 2) embedding image (CLIP)
    if (doImage && p.image_url) {
      const iemb = await embedImage(p.image_url);
      if (iemb) {
        try {
          await query(
            "UPDATE camille.products SET image_embedding = $1::vector WHERE id = $2 AND agent_id = $3",
            [toVectorLiteral(iemb), p.id, agentId]
          );
          imageIndexed++; touched = true;
        } catch {
          return NextResponse.json(
            { error: "Colonne image_embedding absente — appliquez migration_catalog_v2.sql (+ pgvector).", indexed: textIndexed },
            { status: 400 }
          );
        }
      }
    }

    if (touched) {
      await query("UPDATE camille.products SET needs_reindex = false WHERE id = $1 AND agent_id = $2", [p.id, agentId]);
    } else {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    total: prods.length,
    text_indexed: textIndexed,
    image_indexed: imageIndexed,
    failed,
    engines: { text: doText, image: doImage },
  });
}
