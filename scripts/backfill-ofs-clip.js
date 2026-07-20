#!/usr/bin/env node
/* backfill-ofs-clip.js — remplit products.clip_embedding dans le Supabase OFS.
 *
 * À lancer UNE fois (reprenable : ne traite que les produits où clip_embedding IS NULL).
 * Pour chaque produit : on envoie son image au micro-service CLIP → vecteur 512 → UPDATE.
 *
 * Prérequis (variables d'env) :
 *   OFS_SUPABASE_URL           = https://xxxx.supabase.co
 *   OFS_SUPABASE_SERVICE_KEY   = <service_role key OFS>   (écriture — PAS l'anon key)
 *   CLIP_SERVICE_URL           = https://clip.mondomaine.com
 *   CLIP_API_KEY               = <clé du service CLIP>    (optionnel)
 *   BATCH                      = 50   (optionnel)
 *
 * Usage :  node scripts/backfill-ofs-clip.js
 * Dépendance : @supabase/supabase-js (déjà dans camille).
 */
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.OFS_SUPABASE_URL;
const KEY = process.env.OFS_SUPABASE_SERVICE_KEY;
const CLIP = (process.env.CLIP_SERVICE_URL || "").replace(/\/+$/, "");
const CLIP_KEY = process.env.CLIP_API_KEY || "";
const BATCH = Number(process.env.BATCH) || 50;

if (!URL || !KEY) { console.error("OFS_SUPABASE_URL et OFS_SUPABASE_SERVICE_KEY requis."); process.exit(1); }
if (!CLIP) { console.error("CLIP_SERVICE_URL requis."); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function embedImage(url) {
  try {
    const r = await fetch(CLIP + "/embed-image", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(CLIP_KEY ? { "x-api-key": CLIP_KEY } : {}) },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d?.embedding) ? d.embedding : null;
  } catch { return null; }
}

(async () => {
  // Pagination par curseur (id croissant) sur TOUT le catalogue : on n'embed que
  // les produits sans embedding, mais on avance toujours → pas de boucle infinie.
  let done = 0, skipped = 0, failed = 0, already = 0, lastId = "";
  for (;;) {
    let sel = sb.from("products")
      .select("id, img, images, clip_embedding")
      .order("id", { ascending: true })
      .limit(BATCH);
    if (lastId) sel = sel.gt("id", lastId);
    const { data, error } = await sel;
    if (error) { console.error("Lecture:", error.message); process.exit(1); }
    if (!data || !data.length) break;
    lastId = data[data.length - 1].id;

    for (const p of data) {
      if (p.clip_embedding) { already++; continue; }               // déjà indexé
      const img = p.img || (Array.isArray(p.images) && p.images[0]) || null;
      if (!img) { skipped++; continue; }                            // pas d'image
      const emb = await embedImage(img);
      if (!emb) { failed++; continue; }
      const { error: uErr } = await sb.from("products").update({ clip_embedding: emb }).eq("id", p.id);
      if (uErr) { failed++; continue; }
      done++;
    }
    console.log(`…parcourus jusqu'à ${lastId} — indexés:${done} déjà:${already} sansImage:${skipped} échecs:${failed}`);
  }
  console.log(`FINI — indexés:${done} déjà:${already} sansImage:${skipped} échecs:${failed}`);
  process.exit(0);
})();
