// ─────────────────────────────────────────────────────────────────────────────
// PATCH  /api/team/:id { role?, agent_ids? } — le propriétaire ajuste un accès
// DELETE /api/team/:id                      — le propriétaire retire un membre,
//                                             ou le membre quitte l'équipe
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type Ctx = { params: Promise<{ memberId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { memberId } = await params;
  const b = (await req.json().catch(() => ({}))) as { role?: string; agent_ids?: unknown };

  const sets: string[] = [];
  const vals: unknown[] = [memberId, user.id];
  if (b.role !== undefined) {
    if (!["gerant", "vendeur"].includes(String(b.role))) return NextResponse.json({ error: "Rôle inconnu" }, { status: 400 });
    vals.push(b.role); sets.push(`role = $${vals.length}`);
  }
  if (b.agent_ids !== undefined) {
    let ids: string[] | null = null;
    if (Array.isArray(b.agent_ids)) {
      ids = [...new Set(b.agent_ids.map(String))];
      const r = await query(
        `SELECT COUNT(*)::int AS n FROM camille.agents WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [user.id, ids]
      ).catch(() => ({ rows: [{ n: -1 }] }));
      if (!ids.length || r.rows[0].n !== ids.length) return NextResponse.json({ error: "Choisissez au moins un de vos agents." }, { status: 400 });
    }
    vals.push(ids); sets.push(`agent_ids = $${vals.length}`);
  }
  if (!sets.length) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

  const r = await query(
    `UPDATE camille.team_members SET ${sets.join(", ")}
      WHERE id = $1 AND owner_id = $2 AND status <> 'revoked' RETURNING id`,
    vals
  );
  if (!r.rows.length) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { memberId } = await params;
  // Le propriétaire retire ; le membre peut aussi partir de lui-même.
  const r = await query(
    `UPDATE camille.team_members SET status = 'revoked', token_hash = NULL
      WHERE id = $1 AND (owner_id = $2 OR member_id = $2) AND status <> 'revoked' RETURNING id`,
    [memberId, user.id]
  );
  if (!r.rows.length) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
