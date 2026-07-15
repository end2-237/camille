// lib/embeddings.ts — embeddings texte + description d'image (server-only).
// Provider par défaut : OpenAI. Sans OPENAI_API_KEY → renvoie null (repli mots-clés).
//   text-embedding-3-small = 1536 dims (cf. migration_catalog_v2.sql).

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";

export function embeddingsEnabled(): boolean {
  return !!OPENAI_KEY;
}

/** Vecteur d'embedding d'un texte, ou null si indisponible. */
export async function embedText(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY || !text?.trim()) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d?.data?.[0]?.embedding as number[]) ?? null;
  } catch {
    return null;
  }
}

/** Décrit une image (mots-clés produit) pour une recherche catalogue, ou null. */
export async function describeImage(imageUrl: string): Promise<string | null> {
  if (!OPENAI_KEY || !imageUrl) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Décris ce produit en quelques mots-clés utiles pour une recherche dans un catalogue (type d'objet, catégorie, couleur, matière). Réponds uniquement par les mots-clés, séparés par des espaces." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d?.choices?.[0]?.message?.content as string)?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Formate un vecteur pour pgvector : "[0.1,0.2,...]". */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Texte indexable d'un produit (nom + catégorie + tags + description). */
export function productText(p: {
  name?: string; category?: string | null; tags?: string[] | null; description?: string | null;
}): string {
  const tags = Array.isArray(p.tags) ? p.tags.join(" ") : "";
  return [p.name, p.category, tags, p.description].filter(Boolean).join(" — ").slice(0, 2000);
}
