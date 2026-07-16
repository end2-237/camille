// POST /api/agents/[agentId]/products/reindex
// Calcule les embeddings des produits actifs et les écrit dans le magasin de
// vecteurs intégré (fichier sur volume persistant) — AUCUNE écriture dans Postgres.
//   - embedding TEXTE  → OpenAI (si OPENAI_API_KEY) — recherche sémantique
//   - embedding IMAGE  → CLIP local (si @xenova/transformers) — recherche visuelle
// Chaque volet s'exécute s'il est disponible.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { embedText, embeddingsEnabled, productText } from "@/lib/embeddings";
import { embedImage, imageEmbeddingsEnabled } from "@/lib/imageEmbeddings";
import { saveAgentIndex } from "@/lib/vectorStore";

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

  const textMap: Record<string, number[]> = {};
  const imageMap: Record<string, number[]> = {};
  let textIndexed = 0, imageIndexed = 0;
  let stage = "embeddings";

  try {
    for (const p of prods) {
      if (doText) {
        const emb = await embedText(productText({ ...p, tags: p.tags }));
        if (emb) { textMap[p.id] = emb; textIndexed++; }
      }
      if (doImage && p.image_url) {
        const iemb = await embedImage(p.image_url);
        if (iemb) { imageMap[p.id] = iemb; imageIndexed++; }
      }
    }

    stage = "write";
    await saveAgentIndex(agentId, textMap, imageMap);
  } catch (err) {
    // renvoie la cause exacte (droit d'écriture du volume, chargement CLIP, réseau…)
    return NextResponse.json(
      { error: `Échec reindex (${stage}) : ${String(err)}`, text_indexed: textIndexed, image_indexed: imageIndexed },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    total: prods.length,
    text_indexed: textIndexed,
    image_indexed: imageIndexed,
    engines: { text: doText, image: doImage },
  });
}
