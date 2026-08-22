// PATCH /api/orders/[orderId] — fait avancer une commande dans son cycle de vie.
// nouvelle → en_traitement → en_livraison → livree ; annulee possible à tout
// moment. "traitee" est conservé : les commandes créées avant l'ajout du cycle
// l'utilisent. Chaque changement prévient le site du marchand s'il a déclaré
// un webhook.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { sendOrderDocument, sendThankYou } from "@/lib/facturation";
import { restoreStock } from "@/lib/orders";
import { ORDER_STATUSES, statusLabel, statusStep } from "@/lib/orderStatus";
import { notify } from "@/lib/webhooks";

type RouteContext = { params: Promise<{ orderId: string }> };
const ALLOWED: readonly string[] = ORDER_STATUSES;

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  // Horodatage de chaque étape : c'est ce qui alimente le suivi côté app.
  // COALESCE : on ne réécrit jamais une date déjà posée, l'historique reste vrai.
  const withTracking = `
    UPDATE camille.orders o
       SET status        = $1,
           note          = COALESCE($2, o.note),
           processing_at = CASE WHEN $1 IN ('en_traitement','en_livraison','livree','traitee')
                                THEN COALESCE(o.processing_at, NOW()) ELSE o.processing_at END,
           dispatched_at = CASE WHEN $1 IN ('en_livraison','livree')
                                THEN COALESCE(o.dispatched_at, NOW()) ELSE o.dispatched_at END,
           delivered_at  = CASE WHEN $1 = 'livree'
                                THEN COALESCE(o.delivered_at, NOW()) ELSE o.delivered_at END,
           updated_at    = NOW()
      FROM camille.agents a
     WHERE o.agent_id = a.id AND a.user_id = $3 AND o.id = $4
     RETURNING o.*`;

  // Repli si les colonnes de suivi n'ont pas encore été migrées (dispatched_at
  // vient de migration_site_integration.sql) : le changement de statut doit
  // marcher quand même, on perd juste l'horodatage des étapes.
  const withoutTracking = `
    UPDATE camille.orders o
       SET status = $1, note = COALESCE($2, o.note), updated_at = NOW()
      FROM camille.agents a
     WHERE o.agent_id = a.id AND a.user_id = $3 AND o.id = $4
     RETURNING o.*`;

  // Statut AVANT la mise à jour : c'est lui qui dit si l'on entre dans
  // l'annulation, ou si la commande y était déjà. Sans cette distinction, un
  // second passage recréditerait le stock une deuxième fois.
  let before: { status?: string; items?: unknown; agent_id?: string } = {};
  try {
    const b = await query(
      `SELECT o.status, o.items, o.agent_id
         FROM camille.orders o JOIN camille.agents a ON a.id = o.agent_id
        WHERE o.id = $1 AND a.user_id = $2`,
      [orderId, user.id]
    );
    before = b.rows[0] || {};
  } catch { /* la mise à jour dira elle-même si la commande est introuvable */ }

  const args = [status, body.note ?? null, user.id, orderId];

  let r;
  try {
    r = await query(withTracking, args);
  } catch (e) {
    // 42703 = undefined_column
    const code = (e as { code?: string }).code;
    if (code !== "42703") {
      return NextResponse.json(
        { error: "Mise à jour impossible", detail: (e as Error).message },
        { status: 500 }
      );
    }
    try {
      r = await query(withoutTracking, args);
    } catch (e2) {
      return NextResponse.json(
        { error: "Mise à jour impossible", detail: (e2 as Error).message },
        { status: 500 }
      );
    }
    const out = r.rows[0];
    if (!out) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    return NextResponse.json({
      order: out,
      warning: "Suivi indisponible — applique migration_orders.sql pour horodater les étapes.",
    });
  }

  if (!r.rows.length) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  const order = r.rows[0];

  // Le site du marchand apprend le changement au moment où il arrive, plutôt
  // que de sonder Camille en boucle. Best-effort et non bloquant : un site
  // injoignable ne doit pas retenir le commerçant.
  if (before.status !== status) {
    notify(String(order.agent_id), "order.status_changed", {
      ref: order.ref,
      status,
      status_label: statusLabel(status),
      step: statusStep(status),
      previous_status: before.status ?? null,
      total: Number(order.total) || 0,
      currency: order.currency || "XAF",
      customer_phone: order.contact_phone ?? null,
      scheduled_at: order.scheduled_at ?? null,
      processing_at: order.processing_at ?? null,
      dispatched_at: order.dispatched_at ?? null,
      delivered_at: order.delivered_at ?? null,
    }).catch(() => {});
  }

  // Annulation : la marchandise retourne en rayon.
  if (status === "annulee" && before.status && before.status !== "annulee") {
    const its = Array.isArray(before.items)
      ? before.items
      : (() => { try { return JSON.parse(String(before.items || "[]")); } catch { return []; } })();
    await restoreStock(String(before.agent_id), its).catch(() => {});
  }

  // Passage en traitement = accuse de reception : on envoie le bon de commande
  // en PDF au client. On ATTEND le resultat pour pouvoir le remonter dans l'app,
  // mais un echec ne remet jamais en cause le changement de statut.
  let doc: Awaited<ReturnType<typeof sendOrderDocument>> | undefined;
  if ((status === "en_traitement" || status === "en_livraison") && !order.doc_url) {
    doc = await sendOrderDocument(orderId);
  }

  // Livree = fin de parcours : on remercie le client. sendThankYou refuse
  // d'elle-meme un second envoi (thanked_at).
  let thanks: Awaited<ReturnType<typeof sendThankYou>> | undefined;
  if (status === "livree") {
    thanks = await sendThankYou(orderId);
  }

  return NextResponse.json({ order, ...(doc ? { doc } : {}), ...(thanks ? { thanks } : {}) });
}
