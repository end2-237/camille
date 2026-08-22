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
//
// La réponse porte aussi de quoi HABILLER le site sans y coder d'images :
//   categories[] : chaque rayon avec son nombre d'articles et une vignette
//                  reprise du premier produit qui en a une ;
//   media[]      : les visuels déclarés par le marchand (logo, bannières,
//                  visuels de rayon) — ils priment sur la vignette déduite.
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

    // Coordonnées du marchand : sans elles, le site du client doit coder en
    // dur un numéro WhatsApp, qui devient faux dès que le marchand en change.
    // C'est l'agent qui fait autorité, pas le site.
    let merchant: Record<string, unknown> = {};
    let media: unknown[] = [];
    try {
      // to_jsonb : latitude, delivery_zones et media arrivent par des migrations
      // distinctes. Les lire ainsi évite qu'une base en retard fasse échouer
      // toute la requête pour une colonne absente.
      const m = await query(
        `SELECT business_name, whatsapp_number, location, website_url, sector,
                (to_jsonb(a)->'media')            AS media,
                (to_jsonb(a)->>'latitude')        AS latitude,
                (to_jsonb(a)->>'longitude')       AS longitude,
                (to_jsonb(a)->>'delivery_enabled') AS delivery_enabled,
                (to_jsonb(a)->>'delivery_fee')     AS delivery_fee,
                (to_jsonb(a)->'delivery_zones')    AS delivery_zones
           FROM camille.agents a WHERE id = $1`,
        [auth.key.agent_id]
      );
      const a = m.rows[0] || {};

      const num = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      // Les zones sont saisies librement par le marchand : on ne renvoie que
      // celles qui ont un nom, sous une forme unique {name, fee}.
      let zones: { name: string; fee: number }[] = [];
      try {
        const raw = Array.isArray(a.delivery_zones)
          ? a.delivery_zones
          : JSON.parse(String(a.delivery_zones || "[]"));
        zones = (Array.isArray(raw) ? raw : [])
          .map((z: Record<string, unknown>) => ({
            name: String(z?.zone ?? z?.name ?? "").trim(),
            fee: num(z?.fee ?? z?.price) ?? 0,
          }))
          .filter((z: { name: string }) => z.name);
      } catch {
        zones = [];
      }

      merchant = {
        name: a.business_name || null,
        whatsapp: a.whatsapp_number || null,
        location: a.location || null,
        website: a.website_url || null,
        sector: a.sector || null,
        // Coordonnées de la boutique : le site peut situer le marchand et
        // mesurer la distance jusqu'au client, au lieu de les coder en dur.
        lat: num(a.latitude),
        lng: num(a.longitude),
        delivery: {
          enabled: a.delivery_enabled === null ? true : a.delivery_enabled !== "false",
          fee: num(a.delivery_fee) ?? 0,
          zones,
        },
      };
      // Visuels destinés à être montrés. On ne renvoie que les natures
      // publiques : les médias de prospection interne n'ont rien à faire sur
      // la vitrine du marchand.
      const SHOWABLE = new Set(["logo", "banner", "category", "gallery", "menu"]);
      const raw = Array.isArray(a.media) ? a.media : [];
      media = raw
        .filter((x: Record<string, unknown>) => x && SHOWABLE.has(String(x.kind)) && x.url)
        .map((x: Record<string, unknown>) => ({
          kind: String(x.kind),
          url: String(x.url),
          caption: x.caption ? String(x.caption) : null,
        }));
    } catch {
      // Le catalogue reste utile même si ce complément échoue.
    }

    // Les rayons, avec une vignette déduite du catalogue : le site n'a alors
    // aucune image à héberger, et un rayon renommé ne laisse pas une vignette
    // orpheline derrière lui. Un visuel déclaré par le marchand (media
    // kind=category, caption = nom du rayon) prend le dessus.
    let categories: unknown[] = [];
    try {
      const c = await query(
        `SELECT category,
                COUNT(*)::int AS count,
                (ARRAY_AGG(image_url ORDER BY sort_order ASC, created_at DESC)
                   FILTER (WHERE image_url IS NOT NULL AND image_url <> ''))[1] AS image
           FROM camille.products
          WHERE agent_id = $1 AND category IS NOT NULL AND category <> ''
          GROUP BY category
          ORDER BY MIN(sort_order), category`,
        [auth.key.agent_id]
      );
      const declared = new Map(
        (media as { kind: string; url: string; caption: string | null }[])
          .filter((m) => m.kind === "category" && m.caption)
          .map((m) => [String(m.caption).toLowerCase(), m.url])
      );
      categories = c.rows.map((row: Record<string, unknown>) => ({
        name: row.category,
        count: Number(row.count) || 0,
        image: declared.get(String(row.category).toLowerCase()) || row.image || null,
      }));
    } catch {
      // Un catalogue sans rayons reste un catalogue.
    }

    return json({
      products,
      merchant,
      media,
      categories,
      total: countRes.rows[0]?.n ?? r.rows.length,
      limit,
      offset,
    }, 200, req);
  } catch (e) {
    return json({ error: "Catalogue indisponible", detail: (e as Error).message }, 500, req);
  }
}
