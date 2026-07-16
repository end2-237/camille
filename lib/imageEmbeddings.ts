// lib/imageEmbeddings.ts — embeddings visuels CLIP via un MICRO-SERVICE dédié.
// On NE charge PAS le modèle CLIP dans l'app camille (onnxruntime-node + sharp
// alourdissent trop l'image / le VPS). À la place, un petit service stateless
// (dossier clip-service/, déployé comme app Coolify) calcule les vecteurs, et
// camille l'appelle en HTTP.
//
// Activé seulement si CLIP_SERVICE_URL est défini — sinon renvoie null/false et
// la recherche image retombe sur le repli (OpenAI Vision → mots-clés).
//   env camille :  CLIP_SERVICE_URL=https://clip.mondomaine.com   CLIP_API_KEY=<clé>
//
// Le service partage le MÊME espace vectoriel (clip-vit-base-patch32, 512 dims),
// donc image et texte sont comparables.

const CLIP_URL = (process.env.CLIP_SERVICE_URL || "").replace(/\/+$/, "");
const CLIP_API_KEY = process.env.CLIP_API_KEY || "";

export function imageEmbeddingsEnabled(): boolean {
  return !!CLIP_URL;
}

async function callClip(path: string, body: unknown): Promise<number[] | null> {
  if (!CLIP_URL) return null;
  try {
    const r = await fetch(CLIP_URL + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(CLIP_API_KEY ? { "x-api-key": CLIP_API_KEY } : {}) },
      body: JSON.stringify(body),
      // le 1er appel peut être lent (chargement du modèle côté service)
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d?.embedding) ? (d.embedding as number[]) : null;
  } catch {
    return null;
  }
}

/** Embedding CLIP d'une image (par URL), normalisé L2. null si indisponible. */
export async function embedImage(imageUrl: string): Promise<number[] | null> {
  if (!imageUrl) return null;
  return callClip("/embed-image", { url: imageUrl });
}

/** Embedding CLIP d'un texte (même espace que les images), normalisé L2. null si indisponible. */
export async function embedTextClip(text: string): Promise<number[] | null> {
  if (!text?.trim()) return null;
  return callClip("/embed-text", { text });
}
