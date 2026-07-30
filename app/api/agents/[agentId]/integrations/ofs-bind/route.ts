// POST /api/agents/[agentId]/integrations/ofs-bind
//   body: { email, password, source: "ofs_shop"|"ofs_cj"|"camille" }
// Lie l'agent à une source de catalogue OFS EN LIVE (sans importer) :
//   - ofs_shop : la boutique du compte OFS (vendors.user_id) → enregistre son vendor_id
//   - ofs_cj   : le catalogue plateforme CJ (super-admin)
//   - camille  : revient au catalogue local
// Auth : propriétaire de l'agent.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { connectOfs, ofsEnabled } from "@/lib/ofs";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;

  const owns = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  if (!owns.rows.length) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const source = ["ofs_shop", "ofs_cj", "camille"].includes(body.source) ? body.source : "ofs_shop";

  // Retour au catalogue local : pas besoin d'OFS.
  if (source === "camille") {
    const err = await setSource(agentId, "camille", null);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    return NextResponse.json({ success: true, source: "camille" });
  }

  if (!ofsEnabled()) return NextResponse.json({ error: "OFS non configuré (OFS_SUPABASE_ANON_KEY)." }, { status: 400 });

  // Agent OFS désigné (OFS_LIVE_AGENT_ID) : il peut rebasculer sur le grand catalogue
  // plateforme sans re-saisir ses identifiants — c'est le comportement qui était
  // automatique avant, désormais explicitement activable/désactivable.
  const OFS_LIVE_AGENT = process.env.OFS_LIVE_AGENT_ID || "";
  if (source === "ofs_cj" && OFS_LIVE_AGENT && OFS_LIVE_AGENT === agentId && !body.email) {
    const err = await setSource(agentId, "ofs_cj", null);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    return NextResponse.json({ success: true, source: "ofs_cj" });
  }

  const { email, password } = body;
  if (!email || !password) return NextResponse.json({ error: "email et password OFS requis" }, { status: 400 });

  let conn;
  try {
    conn = await connectOfs(email, password);
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }

  if (source === "ofs_cj") {
    if (!conn.isSuperAdmin) return NextResponse.json({ error: "Le catalogue plateforme (CJ) est réservé aux super-admins." }, { status: 403 });
    const err2 = await setSource(agentId, "ofs_cj", null);
    if (err2) return NextResponse.json({ error: err2 }, { status: 400 });
    return NextResponse.json({ success: true, source: "ofs_cj" });
  }

  // ofs_shop
  if (!conn.vendor) return NextResponse.json({ error: "Aucune boutique OFS liée à ce compte. Crée d'abord ta boutique sur OFS." }, { status: 400 });
  const err3 = await setSource(agentId, "ofs_shop", String(conn.vendor.id));
  if (err3) return NextResponse.json({ error: err3 }, { status: 400 });
  return NextResponse.json({ success: true, source: "ofs_shop", vendor: { id: conn.vendor.id, shop_name: conn.vendor.shop_name } });
}

/**
 * @returns null si tout va bien, sinon le message a renvoyer au client.
 * On ne LEVE plus : l'appelant renvoyait un 500 opaque, illisible depuis l'app.
 */
async function setSource(agentId: string, source: string, vendorId: string | null): Promise<string | null> {
  try {
    await query("UPDATE camille.agents SET catalog_source = $1, ofs_vendor_id = $2 WHERE id = $3", [source, vendorId, agentId]);
    return null;
  } catch (e) {
    // 42703 = colonne absente : la migration n'est pas passee.
    if ((e as { code?: string }).code === "42703") {
      return "Colonnes catalog_source / ofs_vendor_id absentes — applique migration_agent_catalog_source.sql (incluse dans migration_all.sql).";
    }
    return `Base de donnees : ${(e as Error).message}`;
  }
}
