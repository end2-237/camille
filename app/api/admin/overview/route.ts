// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/overview — l'état de tous les marchands, en une requête.
//
// Sans cette vue, l'exploitant découvrait les pannes en lisant les journaux du
// serveur : le workflow n8n est resté inactif pendant qu'un client demandait
// deux fois la carte, et rien nulle part ne le disait. À cinq marchands on
// peut encore appeler chacun ; à vingt on vole à l'aveugle.
//
// Réservé aux comptes is_admin. Lecture seule.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { currentPeriod } from "@/lib/plans";
import { getPlanLimitDB, isUnlimitedTokens } from "@/lib/plans-db";
import { subscriptionState } from "@/lib/subscription";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Requête tolérante aux dérives de schéma.
 *
 * Une console d'exploitation qui tombe parce qu'une table manque est
 * exactement inutile au moment où on en a le plus besoin : pendant une panne.
 * Chaque bloc manquant est signalé plutôt que fatal.
 */
function makeSafe(failures: string[]) {
  return async function safe(sql: string, params: unknown[]): Promise<{ rows: any[] }> {
    try { return (await query(sql, params)) as any; }
    catch (e) {
      const m = (e as Error).message;
      console.error("[admin/overview] requête ignorée :", m);
      if (!failures.includes(m)) failures.push(m);
      return { rows: [] };
    }
  };
}

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const failures: string[] = [];
  const safe = makeSafe(failures);
  const periode = currentPeriod();

  try {
    // ── Les agents, avec leur propriétaire ────────────────────────────────────
    const agents = await safe(
      `SELECT a.id, a.name, a.status, a.plan, a.plan_expires_at, a.level,
              a.business_name, a.created_at,
              u.id AS user_id, u.email AS owner_email, u.full_name AS owner_name
         FROM camille.agents a
         JOIN camille.users u ON u.id = a.user_id
        WHERE a.status != 'archived'
        ORDER BY a.created_at DESC`,
      []
    );
    if (!agents.rows.length) {
      return NextResponse.json({ agents: [], ...(failures.length ? { degraded: failures } : {}) });
    }
    const ids = agents.rows.map((a) => a.id);

    // ── Sessions WhatsApp ─────────────────────────────────────────────────────
    const sessions = await safe(
      `SELECT agent_id, session_name, status, updated_at
         FROM camille.whatsapp_sessions WHERE agent_id = ANY($1::uuid[])`,
      [ids]
    );
    const parSession: Record<string, any> = {};
    sessions.rows.forEach((s) => { parSession[s.agent_id] = s; });

    // ── Consommation du mois ──────────────────────────────────────────────────
    const tokens = await safe(
      `SELECT agent_id, total_tokens FROM camille.token_usage
        WHERE agent_id = ANY($1::uuid[]) AND period = $2`,
      [ids, periode]
    );
    const parTokens: Record<string, number> = {};
    tokens.rows.forEach((t) => { parTokens[t.agent_id] = Number(t.total_tokens) || 0; });

    // ── Activité récente : messages traités et dernier jour actif ─────────────
    const activite = await safe(
      `SELECT agent_id,
              SUM(messages_handled) FILTER (WHERE date > CURRENT_DATE - 7) AS messages_7j,
              MAX(date) AS dernier_jour
         FROM camille.agent_analytics
        WHERE agent_id = ANY($1::uuid[])
        GROUP BY agent_id`,
      [ids]
    );
    const parActivite: Record<string, any> = {};
    activite.rows.forEach((r) => { parActivite[r.agent_id] = r; });

    // ── Commandes de la semaine ───────────────────────────────────────────────
    const commandes = await safe(
      `SELECT agent_id, COUNT(*) AS n, MAX(created_at) AS derniere
         FROM camille.orders
        WHERE agent_id = ANY($1::uuid[]) AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY agent_id`,
      [ids]
    );
    const parCommandes: Record<string, any> = {};
    commandes.rows.forEach((r) => { parCommandes[r.agent_id] = r; });

    // ── Assemblage ────────────────────────────────────────────────────────────
    const lignes = await Promise.all(agents.rows.map(async (a) => {
      const limite = await getPlanLimitDB(a.plan ?? "free").catch(() => 50_000);
      const illimite = isUnlimitedTokens(limite);
      const utilises = parTokens[a.id] ?? 0;
      const sess = parSession[a.id] ?? null;
      const act = parActivite[a.id] ?? {};
      const cmd = parCommandes[a.id] ?? {};
      const abo = subscriptionState(a.plan ?? "free", a.plan_expires_at ?? null);

      return {
        id: a.id,
        name: a.name,
        business_name: a.business_name,
        level: a.level ?? 1,
        status: a.status,
        owner: { id: a.user_id, email: a.owner_email, name: a.owner_name },
        plan: a.plan ?? "free",
        plan_expires_at: a.plan_expires_at,
        // `expired` vient du même calcul que le garde-fou qui bloque les
        // réponses : la console et le moteur ne peuvent pas se contredire.
        plan_expired: abo.expired,
        session: sess ? { name: sess.session_name, status: sess.status, updated_at: sess.updated_at } : null,
        tokens: { used: utilises, limit: illimite ? null : limite,
                  percent: illimite || !limite ? 0 : Math.round((utilises / limite) * 100) },
        messages_7j: Number(act.messages_7j ?? 0),
        dernier_jour_actif: act.dernier_jour ?? null,
        commandes_7j: Number(cmd.n ?? 0),
        derniere_commande: cmd.derniere ?? null,
      };
    }));

    return NextResponse.json({
      periode,
      total: lignes.length,
      agents: lignes,
      ...(failures.length ? { degraded: failures } : {}),
    });
  } catch (err) {
    console.error("[GET /api/admin/overview]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
