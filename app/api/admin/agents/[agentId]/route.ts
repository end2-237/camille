// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/agents/[agentId] — les deux gestes d'exploitation.
//
//   { plan: "pro" }                  → change le plan
//   { plan_expires_at: "2026-12-31" }→ prolonge (ou "" pour retirer l'échéance)
//   { action: "restart_session" }    → relance la session WhatsApp
//   { action: "prolonger", plan?, mois }      → remet l'agent en service pour
//                                              N mois (ou en enterprise)
//   { action: "paiement_agence", plan, mois, montant, mode, reference? }
//                                            → réabonnement payé en agence :
//                                              paiement enregistré, reçu
//                                              envoyé, agent prolongé
//
// Ce sont exactement les deux choses qu'on faisait à la main dans Postgres et
// dans camille-core. Les sortir de la console d'administration, c'est éviter
// qu'un dépannage à 22 h se termine par un UPDATE sans WHERE.
//
// Réservé aux comptes is_admin.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaStartSession } from "@/lib/waha";
import { getPlansFromDB, type DbPlan } from "@/lib/plans-db";
import { randomBytes } from "crypto";
import { sortirDeLEssai } from "@/lib/essai";
import { envoyerRecu, numeroterRecu } from "@/lib/recu";

const MODES: Record<string, string> = { especes: "espèces", momo: "Mobile Money", virement: "virement", autre: "autre" };

/** Le plan demandé, s'il existe (liste lue en base). */
async function planConnu(plan: string): Promise<boolean> {
  const { plans } = await getPlansFromDB().catch(() => ({ plans: [] as DbPlan[] }));
  const connus = new Set(plans.map((p: DbPlan) => p.id));
  return !connus.size || connus.has(plan);
}

/**
 * Pose le plan et repousse l'échéance de N mois, à partir de la fin en cours si
 * elle est encore devant (un renouvellement anticipé s'ajoute), sinon
 * d'aujourd'hui. free et enterprise n'ont pas d'échéance.
 */
async function prolonger(agentId: string, plan: string, mois: number) {
  const r = await query(
    `UPDATE camille.agents
        SET plan = $2,
            plan_expires_at = CASE
              WHEN $2 IN ('free', 'enterprise') THEN NULL
              ELSE GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + ($3 || ' months')::interval
            END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, plan, plan_expires_at`,
    [agentId, plan, String(mois)]
  );
  await sortirDeLEssai(agentId);
  return r.rows[0];
}

type RouteContext = { params: Promise<{ agentId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { agentId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const r = await query(
    `SELECT a.id, a.name, a.plan, ws.session_name
       FROM camille.agents a
       LEFT JOIN camille.whatsapp_sessions ws ON ws.agent_id = a.id
      WHERE a.id = $1`,
    [agentId]
  );
  if (!r.rows.length) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  const agent = r.rows[0];

  // ── Relance de session ──────────────────────────────────────────────────────
  if (body.action === "restart_session") {
    if (!agent.session_name) {
      return NextResponse.json({ error: "Cet agent n'a pas de session WhatsApp" }, { status: 400 });
    }
    try {
      await wahaStartSession(agent.session_name);
      console.log(`[admin] ${admin.email} a relancé la session ${agent.session_name}`);
      return NextResponse.json({ ok: true, action: "restart_session", session: agent.session_name });
    } catch (e) {
      return NextResponse.json({ error: `Relance impossible : ${(e as Error).message}` }, { status: 502 });
    }
  }

  // ── Remise en service / réabonnement en agence ──────────────────────────────
  if (body.action === "prolonger" || body.action === "paiement_agence") {
    const plan = String(body.plan || agent.plan || "starter").trim();
    const mois = Math.round(Number(body.mois) || 1);
    if (!(await planConnu(plan))) return NextResponse.json({ error: `Plan inconnu : ${plan}` }, { status: 400 });
    if (mois < 1 || mois > 36) return NextResponse.json({ error: "Durée entre 1 et 36 mois" }, { status: 400 });

    let recu: string | null = null;
    if (body.action === "paiement_agence") {
      const montant = Math.round(Number(body.montant));
      const mode = String(body.mode || "especes");
      if (!(montant > 0)) return NextResponse.json({ error: "Montant reçu requis" }, { status: 400 });
      if (!MODES[mode]) return NextResponse.json({ error: "Mode de paiement inconnu" }, { status: 400 });
      const reference = String(body.reference || "").replace(/:/g, "-").trim().slice(0, 60);
      const owner = await query(`SELECT user_id FROM camille.agents WHERE id = $1`, [agentId]);
      const ref = `AGC-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
      // Même table que Monetbil : l'historique, les reçus et les rappels
      // voient un paiement en agence comme n'importe quel autre.
      await query(
        `INSERT INTO camille.payments
           (id, user_id, agent_id, plan_id, amount, currency, status, transaction_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'XAF', 'success', $6, NOW(), NOW())`,
        [ref, owner.rows[0].user_id, agentId, plan, montant,
         `agence:${mode}${reference ? `:${reference}` : ""}:${mois}m:${admin.email}`]
      );
      recu = await numeroterRecu(ref);
      const a = await prolonger(agentId, plan, mois);
      await envoyerRecu(ref);
      console.log(`[admin] ${admin.email} a encaissé en agence ${montant} XAF (${MODES[mode]}) pour ${agent.name} : ${plan} ${mois} mois, reçu ${recu ?? ref}`);
      return NextResponse.json({ ok: true, agent: a, paiement: ref, recu });
    }

    const a = await prolonger(agentId, plan, mois);
    console.log(`[admin] ${admin.email} a remis ${agent.name} en service : ${plan}${plan === "free" || plan === "enterprise" ? "" : ` ${mois} mois`}`);
    return NextResponse.json({ ok: true, agent: a });
  }

  // ── Plan et échéance ────────────────────────────────────────────────────────
  const champs: string[] = [];
  const vals: unknown[] = [];

  if (typeof body.plan === "string" && body.plan.trim()) {
    // Liste fermée, lue en base : un plan inventé passerait les contrôles de
    // quota sans jamais correspondre à une limite, et l'agent répondrait
    // gratuitement jusqu'à ce que quelqu'un s'en aperçoive.
    const { plans } = await getPlansFromDB().catch(() => ({ plans: [] as DbPlan[] }));
    const connus = new Set(plans.map((p: DbPlan) => p.id));
    if (connus.size && !connus.has(body.plan.trim())) {
      return NextResponse.json(
        { error: `Plan inconnu : ${body.plan}. Connus : ${[...connus].join(", ")}` },
        { status: 400 }
      );
    }
    champs.push(`plan = $${champs.length + 2}`);
    vals.push(body.plan.trim());
  }

  if (body.plan_expires_at !== undefined) {
    const v = String(body.plan_expires_at ?? "").trim();
    if (v && Number.isNaN(Date.parse(v))) {
      return NextResponse.json({ error: "Date d'échéance illisible" }, { status: 400 });
    }
    champs.push(`plan_expires_at = $${champs.length + 2}`);
    vals.push(v || null);
  }

  if (!champs.length) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  try {
    const up = await query(
      `UPDATE camille.agents SET ${champs.join(", ")}, updated_at = NOW()
        WHERE id = $1 RETURNING id, name, plan, plan_expires_at`,
      [agentId, ...vals]
    );
    // Trace nominative : une console qui change des plans sans laisser de trace
    // rend impossible de répondre à « qui a mis ce compte en Pro ? ».
    console.log(`[admin] ${admin.email} a modifié ${agent.name} :`, JSON.stringify(body));
    return NextResponse.json({ ok: true, agent: up.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: `Modification refusée : ${(e as Error).message}` }, { status: 400 });
  }
}
