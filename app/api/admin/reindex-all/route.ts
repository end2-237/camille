// POST /api/admin/reindex-all
// Réindexe TOUS les agents (texte + image CLIP) en une fois, dans le magasin de
// vecteurs intégré. Exige le header X-Admin-Key: <ADMIN_REINDEX_KEY> ; sans clé
// configurée, la route répond 503 plutôt que de s'ouvrir.
// Aucune écriture Postgres (lecture seule) — écrit les fichiers d'index.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { embedText, embeddingsEnabled, productText } from "@/lib/embeddings";
import { embedImage, imageEmbeddingsEnabled } from "@/lib/imageEmbeddings";
import { saveAgentIndex } from "@/lib/vectorStore";

const ADMIN_KEY = process.env.ADMIN_REINDEX_KEY || "";

export async function POST(req: NextRequest) {
  // Si ADMIN_REINDEX_KEY est défini → on l'exige. Sinon endpoint ouvert (à sécuriser plus tard).
  // Sans clé configurée, on REFUSE. L'ancienne condition ne s'activait que
  // si la variable existait : une route d'administration restait donc
  // grande ouverte tant que personne ne pensait à la définir, et le code
  // l'annonçait lui-même dans sa réponse.
  if (!ADMIN_KEY) {
    return NextResponse.json(
      { error: "Administration non configurée (ADMIN_REINDEX_KEY absente)." },
      { status: 503 }
    );
  }
  if (req.headers.get("x-admin-key") !== ADMIN_KEY) {
    return NextResponse.json({ error: "Clé admin invalide." }, { status: 403 });
  }

  const doText = embeddingsEnabled();
  const doImage = imageEmbeddingsEnabled();
  if (!doText && !doImage) {
    return NextResponse.json({ error: "Aucun moteur d'embedding (ni OPENAI_API_KEY, ni CLIP_SERVICE_URL)." }, { status: 400 });
  }

  const agentsRes = await query(
    "SELECT id, name FROM camille.agents WHERE status <> 'archived' ORDER BY created_at ASC"
  );

  const results: Array<{ agentId: string; name: string; total: number; text: number; image: number; error?: string }> = [];

  for (const agent of agentsRes.rows) {
    try {
      const r = await query(
        "SELECT id, name, description, category, tags, image_url FROM camille.products WHERE agent_id = $1 AND active = true",
        [agent.id]
      );
      const textMap: Record<string, number[]> = {};
      const imageMap: Record<string, number[]> = {};
      for (const p of r.rows) {
        if (doText) {
          const emb = await embedText(productText({ ...p, tags: p.tags }));
          if (emb) textMap[p.id] = emb;
        }
        if (doImage && p.image_url) {
          const iemb = await embedImage(p.image_url);
          if (iemb) imageMap[p.id] = iemb;
        }
      }
      await saveAgentIndex(agent.id, textMap, imageMap);
      results.push({
        agentId: agent.id,
        name: agent.name,
        total: r.rows.length,
        text: Object.keys(textMap).length,
        image: Object.keys(imageMap).length,
      });
    } catch (err) {
      results.push({ agentId: agent.id, name: agent.name, total: 0, text: 0, image: 0, error: String(err) });
    }
  }

  const totals = results.reduce(
    (a, r) => ({ agents: a.agents + 1, text: a.text + r.text, image: a.image + r.image }),
    { agents: 0, text: 0, image: 0 }
  );

  return NextResponse.json({ success: true, engines: { text: doText, image: doImage }, totals, results });
}
