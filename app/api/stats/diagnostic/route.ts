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
  else if ((analytics.rows[0]?.rows ?? 0) === 0)
    problems.push("agent_analytics vide : n8n n'appelle pas POST /api/usage/record après chaque réponse.");
  if (!tokens.ok)
    problems.push(`Table token_usage inaccessible : ${tokens.error} — applique migration_stats_align.sql`);
  if (orphans.ok && orphans.rows.length)
    problems.push(`Conversations orphelines (session_name inconnu de whatsapp_sessions) : ${orphans.rows.map((r) => r.session_name).join(", ")}`);

  return NextResponse.json({
    agents: { count: agentIds.length, ok: agents.ok, error: agents.error },
    sessions: { count: sessions.rows.length, ok: sessions.ok, error: sessions.error, list: sessions.rows },
    conversations: { ok: conversations.ok, error: conversations.error, ...(conversations.rows[0] ?? {}) },
    analytics: { ok: analytics.ok, error: analytics.error, ...(analytics.rows[0] ?? {}) },
    token_usage: { ok: tokens.ok, error: tokens.error, ...(tokens.rows[0] ?? {}) },
    orphan_sessions: orphans.rows.map((r) => r.session_name),
    problems: problems.length ? problems : ["Aucun problème détecté : les données devraient s'afficher."],
  });
}
