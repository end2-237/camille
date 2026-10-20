// ─────────────────────────────────────────────────────────────────────────────
// L'option « Site » (+10 000 FCFA / mois).
//
//   GET   la demande en cours (statut, adresse) et l'aperçu du brief
//   POST  { envies?, domaine? } — le commerçant demande son site
//
// Étape 1 de la feuille de route : le site est fabriqué par l'équipe avec DIP
// à partir du brief ; l'équipe est prévenue à chaque demande.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { notifyUser } from "@/lib/fcm";
import { composerBrief } from "@/lib/site-brief";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await peut(user.id, agentId, "reglages"))) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  let demande = null;
  try {
    demande = (await query(
      `SELECT id, statut, domaine, envies, url, created_at FROM camille.site_demandes
        WHERE agent_id = $1 AND statut <> 'annule' ORDER BY created_at DESC LIMIT 1`,
      [agentId]
    )).rows[0] ?? null;
  } catch { /* table absente : migration_ouverture.sql */ }
  return NextResponse.json({ demande, brief: await composerBrief(agentId) });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await peut(user.id, agentId, "reglages"))) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { envies?: string; domaine?: string };
  const envies = String(b.envies || "").trim().slice(0, 2000);
  const domaine = String(b.domaine || "").trim().toLowerCase().replace(/^https?:\/\//, "").slice(0, 120);
  const brief = await composerBrief(agentId, envies, domaine);

  let id: string;
  try {
    const r = await query(
      `INSERT INTO camille.site_demandes (agent_id, user_id, domaine, envies, brief)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [agentId, user.id, domaine || null, envies || null, brief]
    );
    id = String(r.rows[0].id);
  } catch (e) {
    return NextResponse.json({ error: "Demande non enregistrée", detail: (e as Error).message }, { status: 500 });
  }

  // L'équipe Camille est prévenue : c'est elle qui fabrique le site.
  try {
    const admins = await query(`SELECT id FROM camille.users u WHERE COALESCE((to_jsonb(u)->>'is_admin')::boolean, false)`);
    for (const a of admins.rows) {
      await notifyUser(String(a.id), "systeme", {
        title: "Nouvelle demande de site",
        body: `${domaine || "Sans domaine"} — agent ${agentId.slice(0, 8)}. Brief prêt dans l'exploitation.`,
        data: { type: "platform_update", agentId },
        channel: "alertes",
      }).catch(() => {});
    }
  } catch { /* la demande est enregistrée, c'est l'essentiel */ }

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
