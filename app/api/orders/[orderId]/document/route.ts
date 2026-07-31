// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/[orderId]/document — produire le bon de commande.
//
// Jusqu'ici le document n'était créé qu'au passage en traitement, et jamais
// réessayé : si buyfacturation était injoignable à cet instant précis, la
// commande avançait quand même et le vendeur se retrouvait sans bon, sans
// aucun moyen de le rattraper.
//
// Corps :
//   { send: false }  (défaut) produit le document et renvoie son URL
//   { send: true }   le renvoie aussi au client sur WhatsApp
//
// Un document déjà produit n'est pas refait : on renvoie celui qui existe,
// sauf demande explicite de renvoi au client.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { sendOrderDocument } from "@/lib/facturation";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const send = body.send === true;

  // La commande doit appartenir à un agent de cet utilisateur : un identifiant
  // de commande ne suffit pas à en obtenir le document.
  let order: Record<string, unknown> | undefined;
  try {
    const r = await query(
      `SELECT o.id, o.doc_url, o.doc_number
         FROM camille.orders o
         JOIN camille.agents a ON a.id = o.agent_id
        WHERE o.id = $1 AND a.user_id = $2`,
      [orderId, user.id]
    );
    order = r.rows[0];
  } catch (e) {
    return NextResponse.json(
      { error: "Lecture impossible", detail: (e as Error).message },
      { status: 500 }
    );
  }

  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  // Déjà produit et rien à renvoyer : inutile de solliciter buyfacturation.
  if (order.doc_url && !send) {
    return NextResponse.json({
      ok: true,
      doc_url: order.doc_url,
      doc_number: order.doc_number,
      reused: true,
    });
  }

  const r = await sendOrderDocument(orderId, { send });

  if (!r.ok && !r.pdfUrl) {
    return NextResponse.json(
      { ok: false, error: r.reason || "Génération impossible" },
      { status: 502 }
    );
  }

  // Le PDF peut exister alors que l'envoi WhatsApp a échoué : le vendeur doit
  // pouvoir le récupérer quand même, et savoir que le client ne l'a pas reçu.
  return NextResponse.json({
    ok: true,
    doc_url: r.pdfUrl,
    doc_number: r.number,
    sent: send && r.ok,
    ...(send && !r.ok ? { warning: r.reason } : {}),
  });
}
