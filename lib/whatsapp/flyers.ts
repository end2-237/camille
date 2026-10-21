// ─────────────────────────────────────────────────────────────────────────────
// Les flyers de la médiathèque (Médias › Flyers), pour tous les secteurs.
//
// Un carrousel WhatsApp : chaque flyer est une carte avec son image, sa
// légende et deux boutons. Un seul flyer : l'image et ses boutons. Si Meta
// refuse le carrousel (numéro trop récent, format), les images partent une à
// une, suivies des boutons — le client voit toujours les affiches.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import * as meta from "./meta";

export type Flyer = { id: string; url: string; legende: string };

/** Les flyers de l'agent, dans l'ordre de la médiathèque (10 au plus : la limite du carrousel). */
export async function flyersDe(agentId: string): Promise<Flyer[]> {
  const r = await query(`SELECT to_jsonb(a)->'media' AS media FROM camille.agents a WHERE id = $1`, [agentId]).catch(() => ({ rows: [] }));
  let media = r.rows[0]?.media as unknown;
  if (typeof media === "string") {
    try { media = JSON.parse(media); } catch { media = []; }
  }
  return ((Array.isArray(media) ? media : []) as { kind?: string; url?: string; caption?: string }[])
    .filter((m) => m?.kind === "flyers" && m.url)
    .slice(0, 10)
    .map((m, i) => ({ id: `flyer_${i + 1}`, url: String(m.url), legende: String(m.caption || "").trim() }));
}

/** Envoie les flyers ; `boutons(id)` donne les deux boutons de chaque carte. */
export async function envoyerFlyers(
  phone: string, flyers: Flyer[], texte: string, boutons: (id: string) => { id: string; title: string }[], repli = ""
): Promise<void> {
  if (!flyers.length) return;
  if (flyers.length === 1) {
    const f = flyers[0];
    await meta.sendButtonsMedia(phone, { type: "image", url: f.url }, `${texte}${f.legende ? `\n\n${f.legende}` : ""}`, boutons(f.id));
    return;
  }
  const r = await meta.sendMediaCarousel(phone, texte, flyers.map((f) => ({ image: f.url, texte: f.legende || repli || texte, boutons: boutons(f.id) })));
  if (r.ok) return;
  console.warn(`[flyers] carrousel refusé (${r.error}) — envoi des images une à une`);
  for (const f of flyers) await meta.sendImage(phone, f.url, f.legende || undefined);
  await meta.sendButtons(phone, texte, boutons(flyers[0].id).slice(0, 1));
}
