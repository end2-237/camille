// PATCH  /api/agents/[agentId]/products/[productId]  → met à jour un produit
// DELETE /api/agents/[agentId]/products/[productId]  → supprime un produit

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut, type Action } from "@/lib/equipe";
import { pousserUn, retirerUn } from "@/lib/whatsapp/catalogue-sync";
import { idsAttendus, type AxeVariante } from "@/lib/whatsapp/variantes";
import { coerce } from "@/lib/productFields";

type RouteContext = { params: Promise<{ agentId: string; productId: string }> };

const FIELDS = new Set([
  "name", "description", "price", "price_max", "currency", "category",
  "tags", "stock", "min_order", "rating", "image_url", "product_url", "active", "sort_order",
  "variants", "images", "daily_menu", "available_days", "options",
]);

async function assertOwner(req: NextRequest, agentId: string, action: Action = "catalogue") {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  return (await peut(user.id, agentId, action)) ? user : null;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { agentId, productId } = await params;
  if (!(await assertOwner(req, agentId))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const entries = Object.entries(body).filter(([k]) => FIELDS.has(k));
  if (!entries.length) return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 });

  const set = entries.map(([k], i) => `"${k}" = $${i + 3}`).join(", ");
  const vals = entries.map(([k, v]) => coerce(k, v));

  let r;
  try {
    r = await query(
      `UPDATE camille.products SET ${set}, updated_at = NOW()
       WHERE id = $1 AND agent_id = $2 RETURNING *`,
      [productId, agentId, ...vals]
    );
  } catch (e) {
    // Un 500 nu ne dit rien au commerçant ni à celui qui débogue : on rend la
    // raison exacte, c'est elle qui permet de corriger. Et 400 plutôt que 500 :
    // une contrainte violée vient de ce qui a été envoyé, pas d'une panne.
    const msg = (e as Error).message;
    console.error("[PATCH product]", productId, msg);
    // La colonne du menu du jour arrive par une migration : tant qu'elle n'est
    // pas appliquée, autant le dire clairement plutôt que de renvoyer l'erreur
    // brute de Postgres.
    if ((e as { code?: string }).code === "42703" && ("daily_menu" in body || "available_days" in body)) {
      return NextResponse.json(
        { error: "Le menu du jour n'est pas encore activé sur cette base (migration_daily_menu.sql)" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Enregistrement impossible", detail: msg },
      { status: 400 }
    );
  }
  if (!r.rows.length) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  // Le prix ou le stock vient de changer : Meta doit le savoir, sinon le
  // carrousel annonce un prix que le commerçant ne pratique plus.
  const maj = r.rows[0] as Record<string, unknown>;
  pousserUn(agentId, {
    id: String(maj.id), name: String(maj.name),
    description: maj.description as string | null,
    price: maj.price != null ? Number(maj.price) : null,
    currency: maj.currency as string | null,
    image_url: maj.image_url as string | null,
    stock: maj.stock != null ? Number(maj.stock) : null,
    category: maj.category as string | null,
    active: maj.active as boolean | null,
    variants: Array.isArray(maj.variants) ? (maj.variants as AxeVariante[]) : null,
    images: Array.isArray(maj.images) ? (maj.images as string[]) : null,
  }).catch(() => {});

  return NextResponse.json({ product: maj });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { agentId, productId } = await params;
  if (!(await assertOwner(req, agentId))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // On lit le lien AVANT de supprimer : après, on ne saurait plus quels
  // articles retirer chez Meta, et ils y resteraient proposables à la vente.
  // Un produit décliné en a plusieurs : « <id>:noir », « <id>:bleu »…
  const aRetirer: string[] = [];
  try {
    const q = await query(
      `SELECT id::text AS id, name, image_url,
              COALESCE(to_jsonb(p)->>'meta_retailer_id', id::text) AS lien,
              COALESCE(to_jsonb(p)->'variants', '[]'::jsonb) AS variants
         FROM camille.products p WHERE id = $1 AND agent_id = $2`,
      [productId, agentId]
    );
    const row = q.rows[0];
    if (row) {
      aRetirer.push(String(row.lien), String(row.id));
      aRetirer.push(...idsAttendus(
        { id: String(row.id), name: String(row.name), image_url: row.image_url },
        Array.isArray(row.variants) ? (row.variants as AxeVariante[]) : null
      ));
    }
  } catch { /* lecture impossible : l'identifiant Camille sert de repli */ aRetirer.push(productId); }

  await query("DELETE FROM camille.products WHERE id = $1 AND agent_id = $2", [productId, agentId]);
  retirerUn([...new Set(aRetirer)], agentId).catch(() => {});
  return NextResponse.json({ success: true });
}
