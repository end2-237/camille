// ─────────────────────────────────────────────────────────────────────────────
// « Vous avez ça ? » + une photo.
//
// Au Cameroun, beaucoup de clients montrent plutôt qu'ils n'écrivent : une
// capture d'écran d'un statut, la photo d'une paire vue chez une voisine.
// L'index d'images du catalogue (CLIP) existait, mais rien ne le reliait à
// WhatsApp : la photo restait sans réponse.
//
// La photo reçue est téléchargée chez Meta (elle n'y est lisible qu'avec le
// jeton), déposée dans les médias de Camille pour avoir une adresse publique,
// puis comparée aux images du catalogue.
// ─────────────────────────────────────────────────────────────────────────────
import * as meta from "./meta";
import { embedImage, imageEmbeddingsEnabled } from "@/lib/imageEmbeddings";
import { searchImageScored } from "@/lib/vectorStore";

const coreUrl = () => (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");

/** Sous ce score, la ressemblance ne vaut pas une proposition. */
const SEUIL = 0.6;

/** Dépose un média reçu dans les médias de Camille ; son adresse publique, ou null. */
export async function garderMedia(agentId: string, mediaId: string, nature = "client"): Promise<string | null> {
  const m = await meta.telechargerMedia(mediaId, 8 * 1024 * 1024);
  if (!m) return null;
  const ext = (m.mime.split("/")[1] || "bin").split(";")[0].replace("jpeg", "jpg");
  try {
    const res = await fetch(`${coreUrl()}/api/media/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": process.env.CAMILLE_CORE_API_KEY ?? "" },
      body: JSON.stringify({
        name: `${agentId.replace(/-/g, "")}_${nature}_${Date.now()}.${ext}`,
        data: Buffer.from(m.octets).toString("base64"),
        mimeType: m.mime.split(";")[0],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { url?: string }).url || null;
  } catch (e) {
    console.error("[photo] média non déposé :", (e as Error).message);
    return null;
  }
}

/** Les produits qui ressemblent à la photo, du plus proche au moins proche. */
export async function produitsSemblables(agentId: string, url: string, limite = 5): Promise<string[]> {
  if (!imageEmbeddingsEnabled()) return [];
  const emb = await embedImage(url);
  if (!emb) return [];
  const scores = await searchImageScored(agentId, emb, limite).catch(() => []);
  return scores.filter((s) => s.score >= SEUIL).map((s) => s.id);
}
