// ─────────────────────────────────────────────────────────────────────────────
// L'équipe d'un compte.
//
//   GET  → { membres: [...] (si l'on est propriétaire), acces: [...] (les
//          comptes dont on est membre) }
//   POST { email, role, agent_ids|null } → invite (lien par e-mail, 7 jours)
//
// Seul le propriétaire d'un compte gère son équipe. Les rôles : gerant,
// vendeur (voir lib/equipe.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { envoyerInvitation } from "@/lib/invitation";
import type { Role } from "@/lib/equipe";

const MANQUE = "Équipe non installée — applique migration_team.sql";
const ROLES = new Set(["gerant", "vendeur"]);

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  try {
    const membres = await query(
      `SELECT m.id, m.email, m.role, m.agent_ids, m.status, m.invited_at, m.accepted_at,
              m.expires_at < NOW() AS expiree, u.full_name
         FROM camille.team_members m
         LEFT JOIN camille.users u ON u.id = m.member_id
        WHERE m.owner_id = $1 AND m.status <> 'revoked'
        ORDER BY m.status = 'active' DESC, m.invited_at DESC`,
      [user.id]
    );
    const acces = await query(
      `SELECT m.id, m.role, m.agent_ids, o.email AS proprietaire_email, o.full_name AS proprietaire_nom
         FROM camille.team_members m
         JOIN camille.users o ON o.id = m.owner_id
        WHERE m.member_id = $1 AND m.status = 'active'
        ORDER BY m.accepted_at DESC`,
      [user.id]
    );
    return NextResponse.json({ membres: membres.rows, acces: acces.rows });
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return NextResponse.json({ membres: [], acces: [], error: MANQUE });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!user.email_verified) {
    return NextResponse.json({ error: "Confirmez d'abord votre adresse e-mail.", code: "email_non_verifie" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as { email?: string; role?: string; agent_ids?: unknown };
  const email = String(b.email || "").trim().toLowerCase();
  const role = String(b.role || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Adresse e-mail invalide" }, { status: 400 });
  if (!ROLES.has(role)) return NextResponse.json({ error: "Rôle inconnu" }, { status: 400 });
  if (email === user.email.toLowerCase()) return NextResponse.json({ error: "C'est votre propre adresse." }, { status: 400 });

  // Agents : tous (null), ou une liste qui doit appartenir au compte.
  let agentIds: string[] | null = null;
  if (Array.isArray(b.agent_ids)) {
    agentIds = [...new Set(b.agent_ids.map(String))];
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM camille.agents WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [user.id, agentIds]
    ).catch(() => ({ rows: [{ n: -1 }] }));
    if (!agentIds.length || r.rows[0].n !== agentIds.length) {
      return NextResponse.json({ error: "Choisissez au moins un de vos agents." }, { status: 400 });
    }
  }

  try {
    const max = Math.max(1, Number(process.env.MAX_MEMBRES_EQUIPE ?? 10));
    const n = await query(
      `SELECT COUNT(*)::int AS n FROM camille.team_members WHERE owner_id = $1 AND status <> 'revoked'`,
      [user.id]
    );
    const deja = await query(
      `SELECT id, status FROM camille.team_members WHERE owner_id = $1 AND LOWER(email) = $2 AND status <> 'revoked'`,
      [user.id, email]
    );
    if (deja.rows[0]?.status === "active") {
      return NextResponse.json({ error: "Cette personne fait déjà partie de votre équipe." }, { status: 409 });
    }
    if (!deja.rows.length && n.rows[0].n >= max) {
      return NextResponse.json({ error: `Votre équipe compte déjà ${max} membres.` }, { status: 403 });
    }

    const jeton = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(jeton).digest("hex");
    // Une invitation en attente pour la même adresse est remplacée (nouveau
    // lien, nouveau rôle) plutôt que doublée.
    if (deja.rows.length) {
      await query(
        `UPDATE camille.team_members
            SET role = $2, agent_ids = $3, token_hash = $4, expires_at = NOW() + INTERVAL '7 days', invited_at = NOW()
          WHERE id = $1`,
        [deja.rows[0].id, role, agentIds, hash]
      );
    } else {
      await query(
        `INSERT INTO camille.team_members (owner_id, email, role, agent_ids, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
        [user.id, email, role, agentIds, hash]
      );
    }

    const commerce = await query(
      `SELECT business_name FROM camille.agents WHERE user_id = $1 AND status <> 'archived' ORDER BY created_at LIMIT 1`,
      [user.id]
    );
    const base = (process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? "" : req.nextUrl.origin)).replace(/\/$/, "");
    const lien = `${base}/rejoindre?jeton=${jeton}`;
    const envoye = await envoyerInvitation({
      email,
      lien,
      invitant: user.full_name || user.email,
      commerce: commerce.rows[0]?.business_name || "",
      role: role as Role,
    });
    // Le lien revient aussi au propriétaire : il peut l'envoyer par WhatsApp.
    // Il ne sert qu'à l'adresse invitée (vérifiée à l'acceptation).
    return NextResponse.json({ ok: true, envoye, lien }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return NextResponse.json({ error: MANQUE }, { status: 500 });
    throw e;
  }
}
