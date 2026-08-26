// PATCH  /api/agents/[agentId]/products/[productId]  → met à jour un produit
// DELETE /api/agents/[agentId]/products/[productId]  → supprime un produit

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { coerce } from "@/lib/productFields";

type RouteContext = { params: Promise<{ agentId: string; productId: string }> };

const FIELDS = new Set([
  "name", "description", "price", "price_max", "currency", "category",
  "tags", "stock", "min_order", "rating", "image_url", "product_url", "active", "sort_order",
  "variants", "images", "daily_menu",
]);

async function assertOwner(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const r = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  return r.rows.length ? user : null;
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
    if ((e as { code?: string }).code === "42703" && "daily_menu" in body) {
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
  return NextResponse.json({ product: r.rows[0] });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { agentId, productId } = await params;
  if (!(await assertOwner(req, agentId))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await query("DELETE FROM camille.products WHERE id = $1 AND agent_id = $2", [productId, agentId]);
  return NextResponse.json({ success: true });
}
