// lib/imageEmbeddings.ts — embeddings visuels CLIP (512 dims), 100% local.
// Technique : au lieu d'appeler OpenAI Vision, on calcule un embedding CLIP
// (image ET texte partagent le même espace vectoriel) et on fait la similarité
// directement dans Supabase/Postgres via pgvector (colonne products.image_embedding).
//
// Modèle : Xenova/clip-vit-base-patch32 → vecteurs de 512 dimensions (cf. migration_catalog_v2.sql).
// Aucune clé API requise. Le modèle se télécharge au premier appel puis est mis en cache.
// Si @xenova/transformers n'est pas installé / échoue → renvoie null (repli mots-clés/OpenAI).

const CLIP_MODEL = process.env.CLIP_MODEL || "Xenova/clip-vit-base-patch32";

// Singletons chargés paresseusement (le premier appel télécharge/charge le modèle).
let _mod: Promise<unknown> | null = null;
let _processor: Promise<unknown> | null = null;
let _tokenizer: Promise<unknown> | null = null;
let _vision: Promise<unknown> | null = null;
let _text: Promise<unknown> | null = null;
let _disabled = false;

/* eslint-disable @typescript-eslint/no-explicit-any */

async function lib(): Promise<any | null> {
  if (_disabled) return null;
  if (!_mod) {
    // import dynamique via specifier calculé : le paquet est ESM + optionnel,
    // on évite ainsi que le build échoue s'il n'est pas installé.
    const spec = "@xenova/transformers";
    _mod = import(/* webpackIgnore: true */ spec)
      .then((m: any) => {
        // Cache local persistant (monté en volume Docker) + pas de télémétrie.
        try {
          m.env.cacheDir = process.env.TRANSFORMERS_CACHE || "/app/.cache/transformers";
          m.env.allowLocalModels = false;
        } catch { /* noop */ }
        return m;
      })
      .catch(() => {
        _disabled = true;
        return null;
      });
  }
  return _mod;
}

/** true si la recherche visuelle CLIP est disponible dans cet environnement. */
export function imageEmbeddingsEnabled(): boolean {
  return !_disabled;
}

function l2normalize(v: Float32Array | number[]): number[] {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] as number) * (v[i] as number);
  const n = Math.sqrt(s) || 1;
  return Array.from(v, (x) => (x as number) / n);
}

/** Embedding CLIP d'une image (par URL), normalisé L2. null si indisponible. */
export async function embedImage(imageUrl: string): Promise<number[] | null> {
  if (!imageUrl) return null;
  const m = await lib();
  if (!m) return null;
  try {
    if (!_processor) _processor = m.AutoProcessor.from_pretrained(CLIP_MODEL);
    if (!_vision) _vision = m.CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);
    const processor: any = await _processor;
    const vision: any = await _vision;
    const image = await m.RawImage.read(imageUrl);
    const inputs = await processor(image);
    const out = await vision(inputs);
    return l2normalize(out.image_embeds.data);
  } catch {
    return null;
  }
}

/** Embedding CLIP d'un texte (même espace que les images), normalisé L2. null si indisponible. */
export async function embedTextClip(text: string): Promise<number[] | null> {
  if (!text?.trim()) return null;
  const m = await lib();
  if (!m) return null;
  try {
    if (!_tokenizer) _tokenizer = m.AutoTokenizer.from_pretrained(CLIP_MODEL);
    if (!_text) _text = m.CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL);
    const tokenizer: any = await _tokenizer;
    const textModel: any = await _text;
    const inputs = tokenizer([text.slice(0, 200)], { padding: true, truncation: true });
    const out = await textModel(inputs);
    return l2normalize(out.text_embeds.data);
  } catch {
    return null;
  }
}
