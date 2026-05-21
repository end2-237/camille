// POST /api/agents/[agentId]/owner-password
// Définit ou change le mot de passe du mode propriétaire.
// Le mot de passe est hashé avec bcrypt avant stockage — jamais en clair.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  let password: string;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Mot de passe trop court (min 4 caractères)" }, { status: 400 });
  }
  if (password.length > 64) {
    return NextResponse.json({ error: "Mot de passe trop long (max 64 caractères)" }, { status: 400 });
  }

  // Verify agent ownership
  const check = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (check.rows.length === 0) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    await query(
      `UPDATE camille.agents
       SET owner_password_hash = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [hash, agentId, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/agents/:id/owner-password]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — supprime le mot de passe (désactive le mode propriétaire)
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  const check = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (check.rows.length === 0) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  try {
    await query(
      `UPDATE camille.agents
       SET owner_password_hash = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    );

    // Invalider toutes les sessions propriétaire actives de cet agent
    await query(
      "UPDATE camille.owner_sessions SET is_active = FALSE WHERE agent_id = $1",
      [agentId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id/owner-password]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
