// ─────────────────────────────────────────────────────────────────────────────
// POST /api/internal/echeances — le tour quotidien des abonnements.
//
// Appelé une fois par jour par n8n (en-tête X-Camille-Key). Sans lui, les
// rappels d'échéance ne partaient qu'au passage d'un message : un agent
// silencieux expirait sans que son propriétaire soit prévenu.
//
//   1. Les essais échus passent au forfait gratuit.
//   2. Chaque abonnement qui se termine dans 7 jours, demain, ou aujourd'hui
//      déclenche son rappel (notification + e-mail), une seule fois par seuil.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { appelInterne, refusInterne } from "@/lib/interne";
import { terminerEssaisEchus } from "@/lib/essai";
import { subscriptionState } from "@/lib/subscription";
import { alerterEcheance } from "@/lib/usage-alerts";

export async function POST(req: NextRequest) {
  if (!appelInterne(req)) return refusInterne();

  // Les rappels d'essai partent AVANT la bascule : le jour J, on annonce le
  // passage au gratuit, puis on le fait.
  const r = await query(
    `SELECT id, user_id, plan, plan_expires_at,
            COALESCE(NULLIF(name, ''), 'Ton agent') AS name,
            COALESCE((to_jsonb(agents)->>'trial')::boolean, FALSE) AS trial
       FROM camille.agents
      WHERE status <> 'archived' AND plan_expires_at IS NOT NULL
        AND plan_expires_at BETWEEN NOW() - INTERVAL '1 day' AND NOW() + INTERVAL '8 days'`
  );

  let rappels = 0;
  for (const a of r.rows) {
    const sub = subscriptionState(a.plan, a.plan_expires_at);
    if (sub.daysLeft === null) continue;
    await alerterEcheance({ agentId: a.id, userId: a.user_id, agentName: a.name, daysLeft: sub.daysLeft, essai: a.trial })
      .then(() => { rappels++; })
      .catch(() => {});
  }

  const essais = await terminerEssaisEchus({});
  return NextResponse.json({ ok: true, examines: r.rows.length, rappels, essais_termines: essais });
}
