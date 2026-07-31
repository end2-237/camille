// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats/diagnostic
// Dit précisément POURQUOI les statistiques sont vides : quelles tables existent,
// combien de lignes elles contiennent pour ce compte, et si les sessions WhatsApp
// sont bien reliées aux agents. Aucun secret n'est exposé.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function probe(sql: string, params: unknown[]): Promise<{ ok: boolean; rows: any[]; error?: string }> {
  try {
    const r = (await query(sql, params)) as any;
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, rows: [], error: (e as Error).message };
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const agents = await probe(
    `SELECT id, status FROM camille.agents WHERE user_id = $1`,
    [user.id]
  );
  const agentIds = agents.rows.map((a) => a.id);

  const sessions = await probe(
    `SELECT agent_id, session_name, status FROM camille.whatsapp_sessions WHERE user_id = $1`,
    [user.id]
  );

  const conversations = await probe(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE role = 'user')::int      AS user_msgs,
            COUNT(*) FILTER (WHERE role = 'assistant')::int AS bot_msgs,
            MAX(created_at) AS last_at
     FROM camille.agent_conversations
     WHERE session_name IN (
       SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = ANY($1::uuid[])
     )`,
    [agentIds]
  );

  const analytics = await probe(
    `SELECT COUNT(*)::int AS rows,
            COALESCE(SUM(messages_handled), 0)::int AS messages_handled,
            COALESCE(SUM(tokens_consumed), 0)::int  AS tokens,
            MAX(date) AS last_date
     FROM camille.agent_analytics
     WHERE agent_id = ANY($1::uuid[])`,
    [agentIds]
  );

  // « J'ai deux lignes dans agent_analytics et le tableau de bord affiche 0. »
  // Compter ne suffit pas à répondre : il faut savoir si ces lignes tombent
  // dans la fenêtre interrogée, et si elles appartiennent bien à un agent de
  // ce compte. On lit donc les lignes elles-mêmes, sans filtre d'agent, puis
  // on tranche.
  const WINDOW = 30;
  const winFrom = new Date();
  winFrom.setDate(winFrom.getDate() - WINDOW + 1);
  const from = winFrom.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const rawRows = await probe(
    `SELECT agent_id, date::text AS date, messages_handled, tokens_consumed,
            (agent_id = ANY($1::uuid[]))            AS mine,
            (date >= $2::date AND date <= $3::date) AS in_window
       FROM camille.agent_analytics
      ORDER BY date DESC
      LIMIT 20`,
    [agentIds, from, to]
  );

  const tokens = await probe(
    `SELECT COUNT(*)::int AS rows,
            COALESCE(SUM(total_tokens), 0)::int AS total_tokens,
            MAX(period) AS last_period
     FROM camille.token_usage
     WHERE agent_id = ANY($1::uuid[])`,
    [agentIds]
  );

  // Conversations orphelines : enregistrées sous un session_name qui n'est lié à aucun agent
  const orphans = await probe(
    `SELECT DISTINCT session_name
     FROM camille.agent_conversations
     WHERE session_name NOT IN (SELECT session_name FROM camille.whatsapp_sessions)
     LIMIT 10`,
    []
  );

  const problems: string[] = [];
  if (!agentIds.length) problems.push("Aucun agent sur ce compte.");
  if (sessions.ok && sessions.rows.length === 0)
    problems.push("Aucune session WhatsApp liée : les conversations ne peuvent pas être rattachées à un agent (connecte WhatsApp).");
  if (!conversations.ok)
    problems.push(`Table agent_conversations inaccessible : ${conversations.error}`);
  else if ((conversations.rows[0]?.total ?? 0) === 0)
    problems.push("Aucune conversation enregistrée pour tes sessions (n8n n'appelle pas POST /api/conversations, ou le session_name ne correspond pas).");
  if (!analytics.ok)
    problems.push(`Table agent_analytics inaccessible : ${analytics.error} — applique migration_stats_align.sql`);
  else if ((analytics.rows[0]?.rows ?? 0) === 0) {
    // Zéro ligne POUR CE COMPTE. La table est-elle vide, ou les lignes
    // appartiennent-elles à un autre agent ? Les deux se corrigent autrement.
    if (rawRows.ok && rawRows.rows.length)
      problems.push(
        `agent_analytics contient ${rawRows.rows.length} ligne(s), mais aucune pour tes agents : ` +
        `elles sont rattachées à ${[...new Set(rawRows.rows.map((r) => r.agent_id))].join(", ")}. ` +
        `n8n enregistre sous un agent_id qui n'est pas le tien — vérifie le lien session_name → agent.`
      );
    else
      problems.push("agent_analytics vide : n8n n'appelle pas POST /api/usage/record après chaque réponse.");
  } else if (rawRows.ok && rawRows.rows.some((r) => r.mine) && !rawRows.rows.some((r) => r.mine && r.in_window)) {
    problems.push(
      `Tes lignes agent_analytics existent mais sont toutes hors de la fenêtre ${from} → ${to} ` +
      `(la plus récente : ${analytics.rows[0]?.last_date}). Le tableau de bord n'affiche que les 30 derniers jours.`
    );
  }
  if (!tokens.ok)
    problems.push(`Table token_usage inaccessible : ${tokens.error} — applique migration_stats_align.sql`);
  if (orphans.ok && orphans.rows.length)
    problems.push(`Conversations orphelines (session_name inconnu de whatsapp_sessions) : ${orphans.rows.map((r) => r.session_name).join(", ")}`);

  return NextResponse.json({
    agents: { count: agentIds.length, ok: agents.ok, error: agents.error },
    sessions: { count: sessions.rows.length, ok: sessions.ok, error: sessions.error, list: sessions.rows },
    conversations: { ok: conversations.ok, error: conversations.error, ...(conversations.rows[0] ?? {}) },
    analytics: { ok: analytics.ok, error: analytics.error, ...(analytics.rows[0] ?? {}) },
    // Les lignes brutes, avec pour chacune : est-elle à moi, est-elle dans la
    // fenêtre. C'est ce qui permet de répondre sans accès à la base.
    analytics_rows: { window: { from, to }, ok: rawRows.ok, error: rawRows.error, rows: rawRows.rows },
    token_usage: { ok: tokens.ok, error: tokens.error, ...(tokens.rows[0] ?? {}) },
    orphan_sessions: orphans.rows.map((r) => r.session_name),
    problems: problems.length ? problems : ["Aucun problème détecté : les données devraient s'afficher."],
  });
}
