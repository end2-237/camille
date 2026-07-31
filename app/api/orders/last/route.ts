// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/last?agentId=…&phone=…
//
// La dernière commande d'un client, pour que l'agent puisse répondre « où en
// est ma commande ? » avec des faits plutôt qu'une formule.
//
// Jusqu'ici il demandait le numéro de bon de commande — que le client n'a
// souvent pas sous les yeux — alors que son numéro de téléphone suffit à
// retrouver sa commande.
//
// Route appelée par le workflow n8n, comme /api/agents/by-session : pas
// d'authentification utilisateur, et rien d'exposé au-delà de ce que le client
// connaît déjà de sa propre commande.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/** Ce que le client comprend, par opposition au statut technique. */
const ETAT: Record<string, string> = {
  nouvelle: "reçue",
  en_traitement: "en préparation",
  traitee: "en préparation",
  livree: "livrée",
  annulee: "annulée",
};

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const agentId = (p.get("agentId") || "").trim();
  const phone = (p.get("phone") || "").replace(/[^0-9]/g, "");

  if (!agentId || !phone) {
    return NextResponse.json({ error: "agentId et phone requis" }, { status: 400 });
  }

  try {
    // Le numéro est stocké tantôt brut, tantôt suffixé (@c.us, @lid) : on
    // compare sur les chiffres seuls, sinon un client sur deux reste
    // introuvable.
    const r = await query(
      `SELECT id, ref, status, total, currency, items, address, place_label,
              created_at, updated_at
         FROM camille.orders
        WHERE agent_id = $1
          AND regexp_replace(COALESCE(contact_phone, ''), '[^0-9]', '', 'g') = $2
        ORDER BY created_at DESC
        LIMIT 3`,
      [agentId, phone]
    );

    if (!r.rows.length) return NextResponse.json({ found: false, orders: [] });

    const orders = r.rows.map((o: Record<string, unknown>) => {
      const items = Array.isArray(o.items)
        ? o.items
        : (() => { try { return JSON.parse(String(o.items || "[]")); } catch { return []; } })();

      const created = new Date(String(o.created_at));
      const minutes = Math.max(0, Math.round((Date.now() - created.getTime()) / 60000));

      return {
        ref: o.ref,
        status: o.status,
        etat: ETAT[String(o.status)] || String(o.status),
        total: Number(o.total) || 0,
        currency: o.currency || "XAF",
        minutes,
        articles: (items as { name?: string; qty?: number }[])
          .map((i) => `${i.qty || 1}× ${i.name || "article"}`)
          .join(", "),
        lieu: o.place_label || o.address || "",
      };
    });

    return NextResponse.json({ found: true, last: orders[0], orders });
  } catch (e) {
    return NextResponse.json({ found: false, orders: [], error: (e as Error).message });
  }
}
