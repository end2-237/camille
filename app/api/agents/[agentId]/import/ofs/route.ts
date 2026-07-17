// POST /api/agents/[agentId]/import/ofs
//   body: { email, password, mode: "shop"|"all", limit? }
// Importe le catalogue OFS (boutique du compte, ou toute la plateforme si super-admin)
// dans le catalogue de l'agent Camille. Les produits OFS sont marqués (tag "ofs")
// et remplacés à chaque import (pas de doublon). Auth : propriétaire de l'agent.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { importOfs, ofsEnabled } from "@/lib/ofs";

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

  if (!ofsEnabled()) {
    return NextResponse.json({ error: "Import OFS non configuré (OFS_SUPABASE_ANON_KEY manquante)." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, password } = body;
  const mode = (["shop", "cj", "all"].includes(body.mode) ? body.mode : "shop") as "shop" | "cj" | "all";
  const limit = Math.min(Number(body.limit) || 2000, 5000);
  if (!email || !password) return NextResponse.json({ error: "email et password OFS requis" }, { status: 400 });

  let result;
  try {
    result = await importOfs(email, password, mode, limit);
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }

  const products = result.products;
  if (!products.length) {
    return NextResponse.json({ success: true, imported: 0, message: "Aucun produit à importer.", isSuperAdmin: result.isSuperAdmin });
  }

  // Remplace les produits déjà importés depuis OFS (marqués 'ofs')
  await query("DELETE FROM camille.products WHERE agent_id = $1 AND 'ofs' = ANY(tags)", [agentId]);

  // Insertion par lots
  let imported = 0;
  const startOrder = (await query("SELECT COALESCE(MAX(sort_order),0) AS m FROM camille.products WHERE agent_id = $1", [agentId])).rows[0].m || 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      await query(
        `INSERT INTO camille.products
           (agent_id, name, description, price, price_max, currency, category, tags,
            stock, min_order, rating, image_url, product_url, active, sort_order, variants, images)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [agentId, p.name, p.description, p.price, p.price_max, p.currency, p.category, p.tags,
         p.stock, 1, null, p.image_url, p.product_url, true, startOrder + i + 1,
         JSON.stringify(p.variants), JSON.stringify(p.images)]
      );
      imported++;
    } catch { /* ignore une ligne défaillante */ }
  }

  return NextResponse.json({
    success: true,
    imported,
    total: products.length,
    mode,
    isSuperAdmin: result.isSuperAdmin,
    vendor: result.vendor ? { id: result.vendor.id, shop_name: result.vendor.shop_name } : null,
    hint: "Lance ensuite un reindex pour la recherche image/sémantique.",
  });
}
