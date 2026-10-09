// GET  /api/agents/[agentId]/products        → liste des produits (auth propriétaire)
// POST /api/agents/[agentId]/products        → crée un produit (auth propriétaire)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut, type Action } from "@/lib/equipe";
import { pousserUn } from "@/lib/whatsapp/catalogue-sync";
import type { AxeVariante } from "@/lib/whatsapp/variantes";
import { coerce } from "@/lib/productFields";

type RouteContext = { params: Promise<{ agentId: string }> };

async function assertOwner(req: NextRequest, agentId: string, action: Action = "catalogue") {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  return (await peut(user.id, agentId, action)) ? user : null;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const owner = await assertOwner(req, agentId, "voir");
  if (!owner) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const r = await query(
    `SELECT * FROM camille.products WHERE agent_id = $1
     ORDER BY sort_order ASC, created_at DESC`,
    [agentId]
  );
  return NextResponse.json({ products: r.rows });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const owner = await assertOwner(req, agentId, "catalogue");
  if (!owner) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const b = await req.json();
  if (!b.name || !String(b.name).trim()) {
    return NextResponse.json({ error: "Le nom du produit est requis" }, { status: 400 });
  }

  // Les deux dernières colonnes arrivent par migration_daily_menu.sql : sur une
  // base qui ne l'a pas encore, on réinsère sans elles plutôt que d'empêcher la
  // création d'un produit.
  const BASE = [
    "agent_id", "name", "description", "price", "price_max", "currency", "category", "tags",
    "stock", "min_order", "rating", "image_url", "product_url", "active", "sort_order",
    "variants", "images",
  ];
  // `options` (restaurant : accompagnement, sauce…) arrive par migration_restaurant.sql.
  const colonnes = [...BASE, "daily_menu", "available_days", "options"];
  const inserer = (cols: string[], valeurs: unknown[]) =>
    query(
      `INSERT INTO camille.products (${cols.join(", ")})
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})
       RETURNING *`,
      valeurs
    );

  let r;
  try {
    const valeurs = [
      agentId,
      String(b.name).trim(),
      coerce("description", b.description),
      coerce("price", b.price),
      coerce("price_max", b.price_max),
      coerce("currency", b.currency),
      coerce("category", b.category),
      coerce("tags", b.tags),
      coerce("stock", b.stock),
      coerce("min_order", b.min_order),
      coerce("rating", b.rating),
      coerce("image_url", b.image_url),
      coerce("product_url", b.product_url),
      coerce("active", b.active),
      coerce("sort_order", b.sort_order),
      coerce("variants", b.variants),
      coerce("images", b.images),
      coerce("daily_menu", b.daily_menu),
      coerce("available_days", b.available_days),
      coerce("options", b.options),
    ];
    try {
      r = await inserer(colonnes, valeurs);
    } catch (e) {
      if ((e as { code?: string }).code !== "42703") throw e;
      r = await inserer(BASE, valeurs.slice(0, BASE.length));
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Création impossible", detail: (e as Error).message },
      { status: 500 }
    );
  }
  // Le catalogue doit être UNIQUE : un article créé dans Camille part chez
  // Meta sans que le commerçant ait un second geste à faire. En arrière-plan,
  // parce que la création a déjà réussi — la faire échouer parce que Meta n'a
  // pas répondu serait absurde. La réconciliation complète rattrape le reste.
  const cree = r.rows[0] as Record<string, unknown>;
  pousserUn(agentId, {
    id: String(cree.id), name: String(cree.name),
    description: cree.description as string | null,
    price: cree.price != null ? Number(cree.price) : null,
    currency: cree.currency as string | null,
    image_url: cree.image_url as string | null,
    stock: cree.stock != null ? Number(cree.stock) : null,
    category: cree.category as string | null,
    active: cree.active as boolean | null,
    variants: Array.isArray(cree.variants) ? (cree.variants as AxeVariante[]) : null,
    images: Array.isArray(cree.images) ? (cree.images as string[]) : null,
  }, { marque: (owner as { business_name?: string })?.business_name }).catch(() => {});

  return NextResponse.json({ product: cree }, { status: 201 });
}
