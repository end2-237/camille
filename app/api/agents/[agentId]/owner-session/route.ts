// GET    /api/agents/[agentId]/owner-session?phone=xxx  → { is_owner: bool, expires_at?: string }
// POST   /api/agents/[agentId]/owner-session            → { success: bool } — vérifie mot de passe + crée session
// DELETE /api/agents/[agentId]/owner-session?phone=xxx  → { success: bool } — révoque session (/exit)
//
// Appelé par n8n (pas de JWT — authentification par mot de passe WhatsApp)

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

const SESSION_DURATION_HOURS = 8;

type RouteContext = { params: Promise<{ agentId: string }> };

/* ─── GET — Vérifier si une session propriétaire est active ──────────────── */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const phone = req.nextUrl.searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "Paramètre phone manquant" }, { status: 400 });
  }

  try {
    const result = await query(
      `SELECT id, expires_at, last_activity
       FROM camille.owner_sessions
       WHERE agent_id = $1
         AND phone = $2
         AND is_active = TRUE
         AND expires_at > NOW()
       ORDER BY authenticated_at DESC
       LIMIT 1`,
      [agentId, phone]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ is_owner: false });
    }

    // Rafraîchir last_activity et repousser expires_at
    const sessionId = result.rows[0].id;
    const newExpiry = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    await query(
      `UPDATE camille.owner_sessions
       SET last_activity = NOW(), expires_at = $1
       WHERE id = $2`,
      [newExpiry.toISOString(), sessionId]
    );

    return NextResponse.json({
      is_owner: true,
      expires_at: newExpiry.toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/agents/:id/owner-session]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/* ─── POST — Vérifier mot de passe + créer session ──────────────────────── */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;

  let phone: string;
  let password: string;
  try {
    ({ phone, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!phone || !password) {
    return NextResponse.json({ error: "phone et password requis" }, { status: 400 });
  }

  try {
    // Récupérer le hash du mot de passe de l'agent
    const agentResult = await query(
      "SELECT owner_password_hash FROM camille.agents WHERE id = $1 AND status = 'active'",
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json({ success: false, reason: "agent_not_found" });
    }

    const hash = agentResult.rows[0].owner_password_hash;
    if (!hash) {
      // Pas de mot de passe configuré → mode propriétaire désactivé
      return NextResponse.json({ success: false, reason: "no_password_set" });
    }

    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return NextResponse.json({ success: false, reason: "invalid_password" });
    }

    // Invalider les sessions précédentes de ce numéro
    await query(
      `UPDATE camille.owner_sessions
       SET is_active = FALSE
       WHERE agent_id = $1 AND phone = $2`,
      [agentId, phone]
    );

    // Créer la nouvelle session
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
    await query(
      `INSERT INTO camille.owner_sessions
         (agent_id, phone, authenticated_at, last_activity, expires_at, is_active)
       VALUES ($1, $2, NOW(), NOW(), $3, TRUE)`,
      [agentId, phone, expiresAt.toISOString()]
    );

    return NextResponse.json({
      success: true,
      expires_at: expiresAt.toISOString(),
      message: `✅ *Mode propriétaire activé !*\n\nBienvenue 👋\nVous pouvez maintenant me parler librement :\n\n🧠 *Conseiller stratégique* — Analysez votre business, planifiez par trimestre ou par an\n📅 *Community Management* — Calendriers éditoriaux, posts rédigés, campagnes pub\n\nTapez */exit* pour quitter le mode propriétaire.\nSession active : ${SESSION_DURATION_HOURS}h`,
    });
  } catch (err) {
    console.error("[POST /api/agents/:id/owner-session]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/* ─── DELETE — Révoquer la session (/exit) ───────────────────────────────── */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const phone = req.nextUrl.searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "Paramètre phone manquant" }, { status: 400 });
  }

  try {
    await query(
      `UPDATE camille.owner_sessions
       SET is_active = FALSE
       WHERE agent_id = $1 AND phone = $2 AND is_active = TRUE`,
      [agentId, phone]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id/owner-session]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
