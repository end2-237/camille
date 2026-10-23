// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/agents/[agentId]/parcours  → brouillon, version publiée, historique
// PUT  /api/agents/[agentId]/parcours  → enregistre le brouillon { brouillon }
// POST /api/agents/[agentId]/parcours  → { action: "publier" | "desactiver" |
//                                          "activer" | "restaurer" (version) |
//                                          "reinitialiser" (phone) }
//
// Écrire et tester : quiconque peut régler l'agent. Publier : forfait
// Entreprise (ou administrateur), et seulement un parcours valide.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { valider } from "@/lib/parcours-regles";
import { oublierParcours, reinitialiserContact } from "@/lib/whatsapp/parcours";

type RouteContext = { params: Promise<{ agentId: string }> };

const SANS_TABLE =
  "Les parcours ne sont pas encore installés : exécutez migration_parcours.sql dans Supabase Studio.";

async function acces(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  return (await peut(user.id, agentId, "reglages")) ? user : null;
}

/** Le forfait du propriétaire de l'agent (pas celui d'un membre de l'équipe). */
async function entreprise(agentId: string, estAdmin: boolean): Promise<boolean> {
  if (estAdmin) return true;
  const r = await query(
    `SELECT u.plan FROM camille.agents a JOIN camille.users u ON u.id = a.user_id WHERE a.id = $1`,
    [agentId]
  );
  return r.rows[0]?.plan === "enterprise";
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const user = await acces(req, agentId);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const droit = await entreprise(agentId, user.is_admin).catch(() => false);
  try {
    const r = await query(
      `SELECT brouillon, publie, version, actif, publie_at, updated_at FROM camille.parcours WHERE agent_id = $1`,
      [agentId]
    );
    const v = await query(
      `SELECT version, publie_at FROM camille.parcours_versions WHERE agent_id = $1 ORDER BY version DESC LIMIT 30`,
      [agentId]
    );
    const row = r.rows[0] || null;
    return NextResponse.json({
      pret: true, entreprise: droit,
      brouillon: row?.brouillon ?? null, publie: row?.publie ?? null,
      version: row?.version ?? 0, actif: Boolean(row?.actif),
      publie_at: row?.publie_at ?? null, updated_at: row?.updated_at ?? null,
      versions: v.rows,
    });
  } catch {
    return NextResponse.json({ pret: false, entreprise: droit, error: SANS_TABLE });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  if (!(await acces(req, agentId))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const brouillon = b?.brouillon;
  if (!brouillon || typeof brouillon !== "object" || Array.isArray(brouillon)) {
    return NextResponse.json({ error: "Le brouillon doit être un objet JSON." }, { status: 400 });
  }
  if (JSON.stringify(brouillon).length > 200_000) {
    return NextResponse.json({ error: "Parcours trop volumineux (200 Ko au plus)." }, { status: 413 });
  }
  // Un brouillon se garde même incomplet : on travaille dessus. La validation
  // est rendue pour l'affichage ; c'est la publication qui l'exige.
  const verdict = valider(brouillon);
  try {
    await query(
      `INSERT INTO camille.parcours (agent_id, brouillon, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (agent_id) DO UPDATE SET brouillon = EXCLUDED.brouillon, updated_at = NOW()`,
      [agentId, JSON.stringify(brouillon)]
    );
  } catch {
    return NextResponse.json({ error: SANS_TABLE }, { status: 503 });
  }
  return NextResponse.json({ enregistre: true, valide: verdict.ok, erreurs: verdict.erreurs, avertissements: verdict.avertissements });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const user = await acces(req, agentId);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const action = String(b?.action || "");

  try {
    if (action === "reinitialiser") {
      const phone = String(b?.phone || "").replace(/[^0-9]/g, "");
      if (phone.length < 8) return NextResponse.json({ error: "Numéro invalide." }, { status: 400 });
      const complet = phone.length === 9 ? `237${phone}` : phone;
      await reinitialiserContact(agentId, complet);
      return NextResponse.json({ ok: true, phone: complet });
    }

    if (action === "restaurer") {
      const v = await query(
        `SELECT definition FROM camille.parcours_versions WHERE agent_id = $1 AND version = $2`,
        [agentId, Number(b?.version)]
      );
      if (!v.rows.length) return NextResponse.json({ error: "Version introuvable." }, { status: 404 });
      await query(`UPDATE camille.parcours SET brouillon = $2::jsonb, updated_at = NOW() WHERE agent_id = $1`,
        [agentId, JSON.stringify(v.rows[0].definition)]);
      return NextResponse.json({ ok: true, brouillon: v.rows[0].definition });
    }

    if (action === "desactiver" || action === "activer") {
      const r = await query(
        `UPDATE camille.parcours SET actif = $2, updated_at = NOW() WHERE agent_id = $1 AND ($2 = false OR publie IS NOT NULL) RETURNING actif`,
        [agentId, action === "activer"]
      );
      oublierParcours(agentId);
      if (!r.rows.length) return NextResponse.json({ error: "Aucun parcours publié à activer." }, { status: 400 });
      return NextResponse.json({ ok: true, actif: r.rows[0].actif });
    }

    if (action === "publier") {
      if (!(await entreprise(agentId, user.is_admin))) {
        return NextResponse.json({ error: "La publication des parcours est réservée au forfait Entreprise." }, { status: 403 });
      }
      const r = await query(`SELECT brouillon, version FROM camille.parcours WHERE agent_id = $1`, [agentId]);
      const brouillon = r.rows[0]?.brouillon;
      if (!brouillon) return NextResponse.json({ error: "Aucun brouillon à publier." }, { status: 400 });
      const verdict = valider(brouillon);
      if (!verdict.ok) return NextResponse.json({ error: "Le parcours contient des erreurs.", ...verdict }, { status: 422 });
      const version = Number(r.rows[0].version || 0) + 1;
      await query(
        `INSERT INTO camille.parcours_versions (agent_id, version, definition, publie_par) VALUES ($1, $2, $3::jsonb, $4)`,
        [agentId, version, JSON.stringify(brouillon), user.id]
      );
      await query(
        `UPDATE camille.parcours SET publie = brouillon, version = $2, actif = true, publie_at = NOW(), updated_at = NOW() WHERE agent_id = $1`,
        [agentId, version]
      );
      oublierParcours(agentId);
      return NextResponse.json({ ok: true, version, avertissements: verdict.avertissements });
    }
  } catch (e) {
    console.error("[parcours] action", action, "échouée :", (e as Error).message);
    return NextResponse.json({ error: SANS_TABLE }, { status: 503 });
  }
  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
