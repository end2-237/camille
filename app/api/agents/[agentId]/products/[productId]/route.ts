// PATCH  /api/agents/[agentId]/products/[productId]  → met à jour un produit
// DELETE /api/agents/[agentId]/products/[productId]  → supprime un produit

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string; productId: string }> };

const FIELDS = new Set([
  "name", "description", "price", "price_max", "currency", "category",
  "tags", "stock", "min_order", "rating", "image_url", "product_url", "active", "sort_order",
  "variants", "images",
]);

/** Colonnes texte déclarées NOT NULL : un champ vidé doit y écrire "", pas NULL. */
const TEXTE_NON_NUL = new Set(["description", "currency"]);
/** Colonnes numériques : NULL est permis, mais pas une chaîne ni un NaN. */
const NUMERIQUES = new Set(["price", "price_max", "stock", "min_order", "rating", "sort_order"]);

/**
 * Met une valeur en forme pour Postgres.
 *
 * `description` est NOT NULL en base ; l'application mobile envoyait `null`
 * dès que le vendeur laissait la description vide, et l'enregistrement du
 * stock échouait alors avec une 500 sans explication.
 */
function normalize(k: string, v: unknown): unknown {
  if (["tags", "variants", "images"].includes(k)) {
    return JSON.stringify(Array.isArray(v) ? v : []);
  }
  if (TEXTE_NON_NUL.has(k)) {
    const s = v == null ? "" : String(v);
    return k === "currency" && !s.trim() ? "XAF" : s;
  }
  if (NUMERIQUES.has(k)) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return v;
}

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
  const vals = entries.map(([k, v]) => normalize(k, v));

  try {
    const r = await query(
      `UPDATE camille.products SET ${set}, updated_at = NOW()
       WHERE id = $1 AND agent_id = $2 RETURNING *`,
      [productId, agentId, ...vals]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    return NextResponse.json({ product: r.rows[0] });
  } catch (e) {
    // Sans ce catch, la moindre erreur SQL sortait en 500 nu : l'application
    // affichait « erreur 500 » et il fallait aller lire les logs du serveur
    // pour apprendre qu'un champ vide violait une contrainte.
    const msg = (e as Error).message;
    console.error("[PATCH product]", productId, msg);
    return NextResponse.json({ error: `Enregistrement refusé : ${msg}` }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { agentId, productId } = await params;
  if (!(await assertOwner(req, agentId))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await query("DELETE FROM camille.products WHERE id = $1 AND agent_id = $2", [productId, agentId]);
  return NextResponse.json({ success: true });
}
