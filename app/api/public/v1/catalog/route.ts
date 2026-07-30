// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/v1/catalog
//
// Le site du marchand lit SON catalogue Camille. Une seule saisie de produits
// alimente à la fois WhatsApp et le site : c'est tout l'intérêt.
//
//   curl https://camille.vps.buyticle.com/api/public/v1/catalog \
//        -H "X-Camille-Key: cam_pk_xxxxx"
//
// Paramètres : q (recherche), category, limit (1-100), offset.
// Clé publique suffisante — utilisable directement depuis le navigateur.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { authenticate, json, preflight } from "@/lib/publicApi";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, "public");
  if ("error" in auth) return auth.error;

  const p = req.nextUrl.searchParams;
  const q = (p.get("q") || "").trim();
  const category = (p.get("category") || "").trim();
  const limit = Math.min(100, Math.max(1, parseInt(p.get("limit") || "24", 10) || 24));
  const offset = Math.max(0, parseInt(p.get("offset") || "0", 10) || 0);

  const params: unknown[] = [auth.key.agent_id];
  let where = "WHERE agent_id = $1";

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    where += ` AND category = $${params.length}`;
  }

  try {
    const countRes = await query(`SELECT COUNT(*)::int AS n FROM camille.products ${where}`, params);
    params.push(limit, offset);

    // SELECT * puis filtrage en JS : le schema des produits a evolue plusieurs
    // fois (subcategory, variants, images n'existent pas partout). Figer une
    // liste de colonnes ici, c'est casser l'API a la prochaine migration.
    const r = await query(
      `SELECT * FROM camille.products
         ${where}
        ORDER BY sort_order ASC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const PUBLIC_FIELDS = [
      "id", "name", "description", "price", "price_max", "currency", "stock",
      "category", "subcategory", "image_url", "images", "variants",
      "product_url", "tags", "min_order", "rating",
    ];
    const products = r.rows.map((row: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const k of PUBLIC_FIELDS) if (k in row) out[k] = row[k];
      return out;
    });

    return json({
      products,
      total: countRes.rows[0]?.n ?? r.rows.length,
      limit,
      offset,
    }, 200, req);
  } catch (e) {
    return json({ error: "Catalogue indisponible", detail: (e as Error).message }, 500, req);
  }
}
