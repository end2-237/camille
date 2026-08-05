// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/agents/[agentId] — les deux gestes d'exploitation.
//
//   { plan: "pro" }                  → change le plan
//   { plan_expires_at: "2026-12-31" }→ prolonge (ou "" pour retirer l'échéance)
//   { action: "restart_session" }    → relance la session WhatsApp
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
