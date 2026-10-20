// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents/[agentId]/demandes-manquees?jours=30
//
// Ce que les clients ont demandé sans le trouver, regroupé et compté :
// la liste de courses du commerçant.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { peut } from "@/lib/equipe";
import { demandesManquees } from "@/lib/bilan";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await peut(user.id, agentId, "voir"))) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  const jours = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("jours")) || 30));
  try {
    return NextResponse.json({ demandes: await demandesManquees(agentId, jours, 10) });
  } catch {
    // Table absente (migration_ouverture.sql) : rien à montrer, pas d'erreur.
    return NextResponse.json({ demandes: [] });
  }
}
