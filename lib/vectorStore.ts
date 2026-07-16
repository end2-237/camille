// lib/vectorStore.ts — magasin de vecteurs intégré à camille (Option A).
// AUCUNE base externe, AUCUNE modification de Postgres : les embeddings (texte 1536
// et image CLIP 512) sont stockés dans un simple fichier JSON par agent, sur un
// volume persistant, et la similarité cosinus est calculée en mémoire.
//
// Volume persistant (Coolify) : monter un volume sur VECTOR_STORE_DIR (déf. /app/data/vectors)
// pour que l'index survive aux redéploiements (sinon relancer un « reindex »).
//
// Échelle : ~40 Mo de RAM pour 5000 produits/boutique, recherche en quelques ms.

import { promises as fs } from "fs";
import path from "path";

const DIR = process.env.VECTOR_STORE_DIR || "/app/data/vectors";

/** Contenu du fichier d'un agent : id produit → vecteur. */
type IndexFile = { text: Record<string, number[]>; image: Record<string, number[]> };
/** Forme préparée pour la recherche (normes pré-calculées). */
type Prepared = { ids: string[]; vecs: number[][]; norms: number[] };
type Loaded = { text: Prepared; image: Prepared };

// Cache en mémoire par agent (évite de relire/parser le fichier à chaque message).
const cache = new Map<string, { prepared: Loaded }>();

function fileFor(agentId: string): string {
  return path.join(DIR, `${agentId}.json`);
}

function prepare(rec: Record<string, number[]>): Prepared {
  const ids = Object.keys(rec);
  const vecs = ids.map((id) => rec[id]);
  const norms = vecs.map((v) => {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    return Math.sqrt(s) || 1;
  });
  return { ids, vecs, norms };
}

async function readFile(agentId: string): Promise<IndexFile> {
  try {
    const raw = await fs.readFile(fileFor(agentId), "utf8");
    const j = JSON.parse(raw);
    return { text: j.text || {}, image: j.image || {} };
  } catch {
    return { text: {}, image: {} };
  }
}

async function load(agentId: string): Promise<Loaded> {
  const c = cache.get(agentId);
  if (c) return c.prepared;
  const data = await readFile(agentId);
  const prepared: Loaded = { text: prepare(data.text), image: prepare(data.image) };
  cache.set(agentId, { prepared });
  return prepared;
}

/** (Ré)écrit tout l'index d'un agent (texte + image) et rafraîchit le cache. */
export async function saveAgentIndex(
  agentId: string,
  text: Record<string, number[]>,
  image: Record<string, number[]>
): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const data: IndexFile = { text, image };
  await fs.writeFile(fileFor(agentId), JSON.stringify(data));
  cache.set(agentId, { prepared: { text: prepare(text), image: prepare(image) } });
}

function topK(prep: Prepared, q: number[], limit: number): string[] {
  let qn = 0;
  for (let i = 0; i < q.length; i++) qn += q[i] * q[i];
  qn = Math.sqrt(qn) || 1;
  const scored = prep.ids.map((id, i) => {
    const v = prep.vecs[i];
    const n = Math.min(v.length, q.length);
    let dot = 0;
    for (let k = 0; k < n; k++) dot += v[k] * q[k];
    return { id, s: dot / (prep.norms[i] * qn) };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.id);
}

/** Recherche sémantique texte : renvoie les product_id ordonnés par similarité. */
export async function searchText(agentId: string, q: number[], limit: number): Promise<string[]> {
  const l = await load(agentId);
  return l.text.ids.length ? topK(l.text, q, limit) : [];
}

/** Recherche visuelle : renvoie les product_id ordonnés par similarité. */
export async function searchImage(agentId: string, q: number[], limit: number): Promise<string[]> {
  const l = await load(agentId);
  return l.image.ids.length ? topK(l.image, q, limit) : [];
}

/** true si l'agent a un index texte. */
export async function hasTextIndex(agentId: string): Promise<boolean> {
  return (await load(agentId)).text.ids.length > 0;
}

/** true si l'agent a un index image. */
export async function hasImageIndex(agentId: string): Promise<boolean> {
  return (await load(agentId)).image.ids.length > 0;
}

export function vectorStoreDir(): string {
  return DIR;
}

/** Nombre de vecteurs indexés pour un agent (diagnostic). */
export async function indexStats(agentId: string): Promise<{ text: number; image: number }> {
  const l = await load(agentId);
  return { text: l.text.ids.length, image: l.image.ids.length };
}
