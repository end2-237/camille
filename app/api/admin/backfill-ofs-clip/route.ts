// POST /api/admin/backfill-ofs-clip?after=<id>&limit=100
// Remplit products.clip_embedding dans le Supabase OFS, PAR LOT (curseur par id).
// Déclenchable en un simple curl ; à rappeler avec le `nextAfter` renvoyé jusqu'à done:true.
//
// Protégé par le header x-admin-key === ADMIN_REINDEX_KEY (si défini).
// Env requis côté camille : OFS_SUPABASE_URL, OFS_SUPABASE_SERVICE_KEY, CLIP_SERVICE_URL
//   (OFS_SUPABASE_SERVICE_KEY = service_role OFS — écriture ; ≠ anon key).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embedImage, imageEmbeddingsEnabled } from "@/lib/imageEmbeddings";

export const maxDuration = 300; // laisse le temps au lot (embeddings CLIP)

export async function POST(req: NextRequest) {
  // Sans clé configurée, on REFUSE. L'ancienne condition ne s'activait que si
  // la variable existait : la route restait grande ouverte tant que personne
  // ne pensait à la définir.
  const adminKey = process.env.ADMIN_REINDEX_KEY || "";
  if (!adminKey) {
    return NextResponse.json(
      { error: "Administration non configurée (ADMIN_REINDEX_KEY absente)." },
      { status: 503 }
    );
  }
  if (req.headers.get("x-admin-key") !== adminKey) {
    return NextResponse.json({ error: "clé admin invalide" }, { status: 401 });
  }

  const URL = process.env.OFS_SUPABASE_URL || "https://alrbokstfwwlvbvghrqr.supabase.co";
  const KEY = process.env.OFS_SUPABASE_SERVICE_KEY || "";
  if (!KEY)  return NextResponse.json({ error: "OFS_SUPABASE_SERVICE_KEY manquante (service_role, écriture)" }, { status: 400 });
  if (!imageEmbeddingsEnabled()) return NextResponse.json({ error: "CLIP_SERVICE_URL manquante" }, { status: 400 });

  const after = req.nextUrl.searchParams.get("after") || "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 100, 300);
  // Mode CRON : ne prend QUE les produits sans embedding (nouveaux). Pas de curseur :
  // chaque appel vide un lot de nouveautés → idéal pour un cron périodique.
  const onlyNew = ["1", "true", "yes"].includes((req.nextUrl.searchParams.get("only_new") || "").toLowerCase());
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });

  let sel = sb.from("products").select("id, img, images, clip_embedding").order("id", { ascending: true }).limit(limit);
  if (onlyNew) sel = sel.is("clip_embedding", null);
  else if (after) sel = sel.gt("id", after);
  const { data, error } = await sel;
  if (error) return NextResponse.json({ error: "lecture OFS : " + error.message }, { status: 500 });

  const rows = data || [];
  let indexed = 0, already = 0, noImage = 0, failed = 0;

  for (const p of rows as Array<{ id: string; img?: string; images?: string[]; clip_embedding?: unknown }>) {
    if (p.clip_embedding) { already++; continue; }
    const img = p.img || (Array.isArray(p.images) && p.images[0]) || null;
    if (!img) { noImage++; continue; }
    const emb = await embedImage(img);
    if (!emb) { failed++; continue; }
    const { error: uErr } = await sb.from("products").update({ clip_embedding: emb }).eq("id", p.id);
    if (uErr) { failed++; continue; }
    indexed++;
  }

  const done = rows.length < limit;                 // dernière page atteinte
  const nextAfter = rows.length ? rows[rows.length - 1].id : after;
  return NextResponse.json({ done, nextAfter, scanned: rows.length, indexed, already, noImage, failed });
}
