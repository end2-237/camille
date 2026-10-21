// ─────────────────────────────────────────────────────────────────────────────
// Les rendez-vous d'un agent.
//
//   GET    ?jours=14 → les rendez-vous (7 jours passés → N jours à venir),
//                      les réglages et les prochains créneaux libres
//   POST   { phone, nom?, debut, duree?, prestation? } → rendez-vous saisi
//          par le commerçant (refusé s'il chevauche)
//   PATCH  { id, statut, motif? } → confirmer, annuler, terminé, absent ;
//          le client est prévenu sur WhatsApp
//   PUT    { duree, pas } → réglages (durée par défaut, espacement)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { changerStatut, proposer, reglagesRdv, reserver, type Statut } from "@/lib/rendezvous";

type RouteContext = { params: Promise<{ agentId: string }> };

async function garde(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(user.id, agentId, "ventes"))) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const refus = await garde(req, agentId);
  if (refus) return refus;
  const jours = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("jours")) || 14));
  let liste: unknown[] = [];
  let pret = true;
  try {
    liste = (await query(
      `SELECT * FROM camille.rendez_vous
        WHERE agent_id = $1 AND debut > NOW() - INTERVAL '7 days' AND debut < NOW() + ($2 || ' days')::interval
        ORDER BY debut ASC LIMIT 500`,
      [agentId, String(jours)]
    )).rows;
  } catch {
    pret = false; // migration_rendezvous.sql pas encore passée
  }
  const agent = (await query(`SELECT to_jsonb(a)->>'business_hours' AS h FROM camille.agents a WHERE id = $1`, [agentId])).rows[0];
  const [reglages, libres] = await Promise.all([reglagesRdv(agentId), pret ? proposer(agentId, agent?.h, undefined, 6) : Promise.resolve([])]);
  return NextResponse.json({ pret, rendezVous: liste, reglages, horaires: agent?.h || null, libres: libres.map((d) => d.toISOString()) });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const refus = await garde(req, agentId);
  if (refus) return refus;
  const b = (await req.json().catch(() => ({}))) as { phone?: string; nom?: string; debut?: string; duree?: number; prestation?: string; note?: string };
  const phone = String(b.phone || "").replace(/\D/g, "");
  const debut = new Date(String(b.debut || ""));
  if (phone.length < 9 || Number.isNaN(debut.getTime())) return NextResponse.json({ error: "Téléphone et date requis" }, { status: 400 });
  const r = await reserver({
    agentId, phone: phone.length === 9 ? `237${phone}` : phone, nom: b.nom, debut,
    duree: b.duree ? Math.min(480, Math.max(15, Number(b.duree))) : undefined,
    prestation: b.prestation, note: b.note, source: "tableau",
  });
  if (!r.ok) {
    const msg = r.raison === "pris" ? "Ce créneau chevauche un rendez-vous existant." : r.raison === "passe" ? "Ce créneau est déjà passé." : "Rendez-vous non enregistré.";
    return NextResponse.json({ error: msg, detail: "detail" in r ? r.detail : undefined }, { status: r.raison === "erreur" ? 500 : 409 });
  }
  // Saisi par le commerçant : confirmé d'office, et le client est prévenu.
  const c = await changerStatut(agentId, r.rdv.id, "confirme");
  return NextResponse.json({ ok: true, rdv: r.rdv, avertissement: c.error }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const refus = await garde(req, agentId);
  if (refus) return refus;
  const b = (await req.json().catch(() => ({}))) as { id?: string; statut?: string; motif?: string };
  const statuts: Statut[] = ["demande", "confirme", "annule", "termine", "absent"];
  if (!b.id || !statuts.includes(b.statut as Statut)) return NextResponse.json({ error: "Rendez-vous ou statut invalide" }, { status: 400 });
  const r = await changerStatut(agentId, b.id, b.statut as Statut, String(b.motif || "").slice(0, 200));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true, avertissement: r.error });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const refus = await garde(req, agentId);
  if (refus) return refus;
  const b = (await req.json().catch(() => ({}))) as { duree?: number; pas?: number };
  const duree = Math.min(480, Math.max(15, Math.round(Number(b.duree) / 15) * 15 || 30));
  const pas = Math.min(240, Math.max(15, Math.round(Number(b.pas) / 15) * 15 || duree));
  // capabilities peut être du JSON texte selon les bases : on le relit et le réécrit entier.
  const r = await query(`SELECT to_jsonb(a)->'capabilities' AS c FROM camille.agents a WHERE id = $1`, [agentId]);
  let caps = r.rows[0]?.c as Record<string, unknown> | string | null;
  if (typeof caps === "string") { try { caps = JSON.parse(caps); } catch { caps = {}; } }
  const suivant = { ...((caps as Record<string, unknown>) || {}), rdv: { duree, pas } };
  await query(`UPDATE camille.agents SET capabilities = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(suivant), agentId]);
  return NextResponse.json({ ok: true, reglages: { duree, pas } });
}
