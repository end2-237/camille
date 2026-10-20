// PATCH /api/orders/[orderId] — fait avancer une commande dans son cycle de vie.
// nouvelle → en_traitement → en_livraison → livree ; annulee possible à tout
// moment. "traitee" est conservé : les commandes créées avant l'ajout du cycle
// l'utilisent. Chaque changement prévient le site du marchand s'il a déclaré
// un webhook.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { sqlAgentAccessible } from "@/lib/equipe";
import { sendOrderDocument, sendThankYou } from "@/lib/facturation";
import { restoreStock } from "@/lib/orders";
import { ORDER_STATUSES, statusLabel, statusStep } from "@/lib/orderStatus";
import { notify } from "@/lib/webhooks";
import { annoncerStatut } from "@/lib/whatsapp/suivi-envoi";
import { notifyUser } from "@/lib/fcm";

type RouteContext = { params: Promise<{ orderId: string }> };
const ALLOWED: readonly string[] = ORDER_STATUSES;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/[orderId] — le détail complet d'une commande.
//
// La liste ne montre que l'essentiel ; c'est ici qu'on trouve le reste, et
// notamment ce qui n'était affiché nulle part : l'heure exacte de la commande,
// le créneau demandé, le moyen de paiement annoncé, les frais, la provenance,
// et ce que l'on sait du client (e-mail, entreprise, commandes précédentes).
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;

  const sql = `SELECT o.*,
                      a.latitude       AS shop_lat,
                      a.longitude      AS shop_lng,
                      a.business_name  AS shop_name,
                      a.location       AS shop_location
                 FROM camille.orders o
                 JOIN camille.agents a ON a.id = o.agent_id
                WHERE o.id = $1 AND ${await sqlAgentAccessible("a", "$2")}`;

  let order: Record<string, unknown> | undefined;
  try {
    order = (await query(sql, [orderId, user.id])).rows[0];
  } catch (e) {
    // Coordonnées de boutique absentes (migration_agent_geo.sql) : la commande
    // reste consultable, seul l'itinéraire manque.
    if ((e as { code?: string }).code !== "42703") throw e;
    order = (
      await query(sql.replace(/,\s*a\.latitude[\s\S]*?a\.location\s+AS shop_location/, ""), [orderId, user.id])
    ).rows[0];
  }

  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  // La fiche client : ce que le site a appris de lui, et son historique.
  // Best-effort — une base sans camille.contacts enrichie ne doit pas priver
  // le vendeur du détail de sa commande.
  let customer: Record<string, unknown> | null = null;
  const phone = String(order.contact_phone || "").replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");
  if (phone) {
    try {
      const c = await query(
        `SELECT display_name, email, company, addresses, orders_count, last_order_at
           FROM camille.contacts WHERE agent_id = $1 AND phone = $2`,
        [order.agent_id, phone]
      );
      customer = c.rows[0] ?? null;
    } catch { /* colonnes non migrées : on s'en passe */ }
  }

  return NextResponse.json({ order, customer });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));

  // Deux gestes sans changement de statut : confier la course à un livreur,
  // et corriger la commande avant qu'elle ne parte.
  if (!body.status && (body.courier_id !== undefined || body.edit)) {
    return body.edit ? modifier(user.id, orderId, body.edit) : confier(user.id, orderId, body.courier_id);
  }

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
     WHERE o.agent_id = a.id AND ${await sqlAgentAccessible("a", "$3")} AND o.id = $4
     RETURNING o.*`;

  // Repli si les colonnes de suivi n'ont pas encore été migrées (dispatched_at
  // vient de migration_site_integration.sql) : le changement de statut doit
  // marcher quand même, on perd juste l'horodatage des étapes.
  const withoutTracking = `
    UPDATE camille.orders o
       SET status = $1, note = COALESCE($2, o.note), updated_at = NOW()
      FROM camille.agents a
     WHERE o.agent_id = a.id AND ${await sqlAgentAccessible("a", "$3")} AND o.id = $4
     RETURNING o.*`;

  // Statut AVANT la mise à jour : c'est lui qui dit si l'on entre dans
  // l'annulation, ou si la commande y était déjà. Sans cette distinction, un
  // second passage recréditerait le stock une deuxième fois.
  let before: { status?: string; items?: unknown; agent_id?: string } = {};
  try {
    const b = await query(
      `SELECT o.status, o.items, o.agent_id
         FROM camille.orders o JOIN camille.agents a ON a.id = o.agent_id
        WHERE o.id = $1 AND ${await sqlAgentAccessible("a", "$2")}`,
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

  // Les autres étapes s'annoncent au client avec des boutons (agents Meta ;
  // camille-core garde son parcours). Après le bon de commande, pour qu'il
  // arrive en premier. « livree » passe par sendThankYou ci-dessus.
  let suivi: Awaited<ReturnType<typeof annoncerStatut>> | undefined;
  if (before.status !== status && ["en_traitement", "en_livraison", "annulee"].includes(status)) {
    suivi = await annoncerStatut(orderId).catch(() => undefined);
  }

  return NextResponse.json({
    order, ...(doc ? { doc } : {}), ...(thanks ? { thanks } : {}), ...(suivi && !suivi.skipped ? { suivi } : {}),
  });
}

// ── Confier la course ───────────────────────────────────────────────────────

/** La commande, si l'utilisateur y a accès. */
async function commandeAccessible(userId: string, orderId: string) {
  const r = await query(
    `SELECT o.* FROM camille.orders o JOIN camille.agents a ON a.id = o.agent_id
      WHERE o.id = $1 AND ${await sqlAgentAccessible("a", "$2")}`,
    [orderId, userId]
  );
  return r.rows[0] as Record<string, any> | undefined;
}

async function confier(userId: string, orderId: string, courierId: unknown) {
  const o = await commandeAccessible(userId, orderId);
  if (!o) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  if (["livree", "annulee"].includes(o.status)) {
    return NextResponse.json({ error: "Cette commande est terminée." }, { status: 409 });
  }

  // null : on retire le livreur.
  if (courierId === null || courierId === "") {
    const r = await query(
      "UPDATE camille.orders SET courier_id = NULL, courier_name = NULL, updated_at = NOW() WHERE id = $1 RETURNING *",
      [orderId]
    );
    return NextResponse.json({ order: r.rows[0] });
  }

  // Le livreur doit être rattaché à CETTE boutique, et actif.
  const c = await query(
    `SELECT c.id, c.user_id, COALESCE(NULLIF(c.display_name, ''), u.full_name, u.email) AS nom
       FROM camille.couriers c JOIN camille.users u ON u.id = c.user_id
      WHERE c.id = $1 AND c.agent_id = $2 AND c.status = 'active'`,
    [String(courierId), o.agent_id]
  );
  const livreur = c.rows[0];
  if (!livreur) return NextResponse.json({ error: "Ce livreur n'est pas rattaché à cette boutique." }, { status: 400 });

  const r = await query(
    "UPDATE camille.orders SET courier_id = $2, courier_name = $3, updated_at = NOW() WHERE id = $1 RETURNING *",
    [orderId, livreur.id, livreur.nom]
  );
  notifyUser(livreur.user_id, "commande", {
    title: `Course confiée — commande ${o.ref}`,
    body: o.address ? `Livraison : ${String(o.address).slice(0, 120)}` : "Ouvre l'espace livreur pour l'itinéraire.",
    data: { type: "courier", ref: String(o.ref), orderId },
    channel: "commandes",
  }).catch(() => {});
  return NextResponse.json({ order: r.rows[0] });
}

// ── Corriger la commande ────────────────────────────────────────────────────

/**
 * Avant le départ en livraison : retirer un article, baisser une quantité,
 * corriger les frais ou la note. On ne fait que RETIRER (le stock rendu est
 * exact) : ajouter un article, c'est une nouvelle commande.
 */
async function modifier(
  userId: string,
  orderId: string,
  edit: { items?: { qty?: number }[]; delivery_fee?: number; note?: string | null }
) {
  const o = await commandeAccessible(userId, orderId);
  if (!o) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  if (!["nouvelle", "en_traitement", "traitee"].includes(o.status)) {
    return NextResponse.json({ error: "La commande est déjà partie : elle ne se modifie plus." }, { status: 409 });
  }

  const avant: any[] = Array.isArray(o.items)
    ? o.items
    : (() => { try { return JSON.parse(String(o.items || "[]")); } catch { return []; } })();
  let apres = avant;
  const rendus: any[] = [];
  if (Array.isArray(edit.items)) {
    if (edit.items.length !== avant.length) {
      return NextResponse.json({ error: "Envoie une quantité par article (0 pour le retirer)." }, { status: 400 });
    }
    apres = [];
    avant.forEach((it, i) => {
      const q0 = Number(it.qty) || 1;
      const q1 = Math.max(0, Math.min(q0, Math.floor(Number(edit.items![i]?.qty ?? q0))));
      if (q1 < q0) rendus.push({ ...it, qty: q0 - q1 });
      if (q1 > 0) apres.push({ ...it, qty: q1 });
    });
    if (!apres.length) {
      return NextResponse.json({ error: "Il reste au moins un article : pour tout retirer, annulez la commande." }, { status: 400 });
    }
  }

  const frais = edit.delivery_fee !== undefined ? Math.max(0, Number(edit.delivery_fee) || 0) : Number(o.delivery_fee) || 0;
  const sousTotal = apres.reduce((t, l) => t + (Number(l.price) || 0) * (Number(l.qty) || 1), 0);
  const note = edit.note !== undefined ? (String(edit.note || "").trim().slice(0, 1000) || null) : o.note;

  const r = await query(
    `UPDATE camille.orders
        SET items = $2::jsonb, delivery_fee = $3, total = $4, note = $5, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [orderId, JSON.stringify(apres), frais, sousTotal + frais, note]
  );
  if (rendus.length) await restoreStock(String(o.agent_id), rendus).catch(() => {});
  notify(String(o.agent_id), "order.updated", { ref: o.ref, total: sousTotal + frais, items: apres }).catch(() => {});
  return NextResponse.json({ order: r.rows[0] });
}
