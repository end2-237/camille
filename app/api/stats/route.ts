// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats?agentId=UUID&period=30d
// Statistiques complètes pour le dashboard analytics.
// period: 7d | 30d | 90d | 6m | 12m  (défaut: 30d)
// agentId: UUID d'un agent précis (optionnel — si absent, tous les agents)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest }                         from "@/lib/auth-server";
import { query }                                      from "@/lib/db";
import { currentPeriod }                              from "@/lib/plans";
import { getPlanLimitDB, isUnlimitedTokens }          from "@/lib/plans-db";
import { wahaAnalytics }                              from "@/lib/waha";

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodToDays(p: string): number {
  switch (p) {
    case "7d":  return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "6m":  return 180;
    case "12m": return 365;
    default:    return 30;
  }
}

function dateRange(days: number): { from: string; to: string } {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

// Exécute une requête en tolérant les dérives de schéma (colonne/table absente) :
// renvoie des lignes vides au lieu de faire planter toute la page de stats.
/* eslint-disable @typescript-eslint/no-explicit-any */
async function safe(sql: string, params: unknown[]): Promise<{ rows: any[] }> {
  try { return (await query(sql, params)) as any; }
  catch (e) { console.error("[stats] requête ignorée:", (e as Error).message); return { rows: [] }; }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const params      = req.nextUrl.searchParams;
    const agentIdParam = params.get("agentId");
    const periodParam  = params.get("period") ?? "30d";
    const days         = periodToDays(periodParam);
    const { from, to } = dateRange(days);

    // ── 1. Fetch agents belonging to user ─────────────────────────────────────
    const agentsRes = await safe(
      `SELECT id, plan, status, capabilities, identity, business_context, created_at
       FROM camille.agents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    const allAgents = agentsRes.rows;
    if (allAgents.length === 0) {
      return NextResponse.json({ empty: true, agents: [] });
    }

    // Validate agentId ownership
    let agentIds: string[];
    if (agentIdParam) {
      const owned = allAgents.find((a) => a.id === agentIdParam);
      if (!owned) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
      agentIds = [agentIdParam];
    } else {
      agentIds = allAgents.map((a) => a.id);
    }

    const agentIdsParam = agentIds.map((_, i) => `$${i + 1}`).join(",");

    // ── 2. Daily analytics series ─────────────────────────────────────────────
    const analyticsRes = await safe(
      `SELECT
         date,
         SUM(messages_handled)                            AS messages,
         SUM(leads_captured)                              AS leads,
         SUM(escalations)                                 AS escalations,
         ROUND(AVG(avg_response_ms))::INT                 AS avg_response_ms,
         SUM(tokens_consumed)                             AS tokens
       FROM camille.agent_analytics
       WHERE agent_id = ANY($1::uuid[])
         AND date >= $2 AND date <= $3
       GROUP BY date
       ORDER BY date ASC`,
      [agentIds, from, to]
    );

    // ── 3. Monthly token usage ─────────────────────────────────────────────────
    const monthsBack = Math.max(6, Math.ceil(days / 30));
    const tokenHistRes = await safe(
      `SELECT
         period,
         SUM(total_tokens)      AS total_tokens,
         SUM(prompt_tokens)     AS prompt_tokens,
         SUM(completion_tokens) AS completion_tokens
       FROM camille.token_usage
       WHERE agent_id = ANY($1::uuid[])
       GROUP BY period
       ORDER BY period DESC
       LIMIT $2`,
      [agentIds, monthsBack]
    );

    // ── 4. Current month token usage + plan limits ────────────────────────────
    const nowPeriod = currentPeriod();
    const tokenNowRes = await safe(
      `SELECT agent_id, total_tokens
       FROM camille.token_usage
       WHERE agent_id = ANY($1::uuid[]) AND period = $2`,
      [agentIds, nowPeriod]
    );
    const tokenByAgent: Record<string, number> = {};
    tokenNowRes.rows.forEach((r) => { tokenByAgent[r.agent_id] = Number(r.total_tokens); });

    // ── 5. Per-agent analytics aggregates ─────────────────────────────────────
    const perAgentRes = await safe(
      `SELECT
         agent_id,
         SUM(messages_handled)                           AS total_messages,
         SUM(leads_captured)                             AS total_leads,
         SUM(escalations)                                AS total_escalations,
         ROUND(AVG(avg_response_ms))::INT                AS avg_response_ms,
         SUM(tokens_consumed)                            AS total_tokens,
         COUNT(DISTINCT date)                            AS active_days
       FROM camille.agent_analytics
       WHERE agent_id = ANY($1::uuid[])
         AND date >= $2 AND date <= $3
       GROUP BY agent_id`,
      [agentIds, from, to]
    );
    const perAgentMap: Record<string, typeof perAgentRes.rows[number]> = {};
    perAgentRes.rows.forEach((r) => { perAgentMap[r.agent_id] = r; });

    // ── 6. Unique contacts & conversation stats ───────────────────────────────
    const convStatsRes = await safe(
      `SELECT
         COUNT(DISTINCT contact_phone)             AS unique_contacts,
         COUNT(*)                                  AS total_messages,
         COUNT(*) FILTER (WHERE role = 'user')     AS user_messages,
         COUNT(*) FILTER (WHERE role = 'assistant') AS bot_messages
       FROM camille.agent_conversations
       WHERE session_name = ANY(
         SELECT identity->>'session_name'
         FROM camille.agents
         WHERE id = ANY($1::uuid[])
       )
         AND created_at >= $2::date
         AND created_at <= ($3::date + INTERVAL '1 day')`,
      [agentIds, from, to]
    );

    // ── 7. Hourly distribution of conversations ───────────────────────────────
    const hourlyRes = await safe(
      `SELECT
         EXTRACT(HOUR FROM created_at)::INT AS hour,
         COUNT(*)                           AS count
       FROM camille.agent_conversations
       WHERE session_name = ANY(
         SELECT identity->>'session_name'
         FROM camille.agents
         WHERE id = ANY($1::uuid[])
       )
         AND role = 'user'
         AND created_at >= $2::date
         AND created_at <= ($3::date + INTERVAL '1 day')
       GROUP BY hour
       ORDER BY hour ASC`,
      [agentIds, from, to]
    );

    // Build full 24-hour array
    const hourlyMap: Record<number, number> = {};
    hourlyRes.rows.forEach((r) => { hourlyMap[Number(r.hour)] = Number(r.count); });
    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
      hour:  h,
      count: hourlyMap[h] ?? 0,
    }));

    // ── 8. Day-of-week distribution ───────────────────────────────────────────
    const dowRes = await safe(
      `SELECT
         EXTRACT(DOW FROM created_at)::INT AS dow,
         COUNT(*)                          AS count
       FROM camille.agent_conversations
       WHERE session_name = ANY(
         SELECT identity->>'session_name'
         FROM camille.agents
         WHERE id = ANY($1::uuid[])
       )
         AND role = 'user'
         AND created_at >= $2::date
         AND created_at <= ($3::date + INTERVAL '1 day')
       GROUP BY dow
       ORDER BY dow ASC`,
      [agentIds, from, to]
    );
    const dowMap: Record<number, number> = {};
    dowRes.rows.forEach((r) => { dowMap[Number(r.dow)] = Number(r.count); });
    const DOW_LABELS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
    const dowDistribution = Array.from({ length: 7 }, (_, d) => ({
      dow:   d,
      label: DOW_LABELS[d],
      count: dowMap[d] ?? 0,
    }));

    // ── 9. Conversation length distribution (avg messages per contact) ─────────
    const convLenRes = await safe(
      `SELECT
         contact_phone,
         COUNT(*) FILTER (WHERE role = 'user') AS user_msgs
       FROM camille.agent_conversations
       WHERE session_name = ANY(
         SELECT identity->>'session_name'
         FROM camille.agents
         WHERE id = ANY($1::uuid[])
       )
         AND created_at >= $2::date
         AND created_at <= ($3::date + INTERVAL '1 day')
       GROUP BY contact_phone`,
      [agentIds, from, to]
    );
    const convLengths = convLenRes.rows.map((r) => Number(r.user_msgs));
    const avgConvLength = convLengths.length
      ? Math.round(convLengths.reduce((s, v) => s + v, 0) / convLengths.length)
      : 0;
    const maxConvLength = convLengths.length ? Math.max(...convLengths) : 0;

    // ── 10. Fill missing days in daily series ─────────────────────────────────
    const dailyMap: Record<string, typeof analyticsRes.rows[number]> = {};
    analyticsRes.rows.forEach((r) => {
      dailyMap[r.date instanceof Date ? r.date.toISOString().slice(0,10) : String(r.date).slice(0,10)] = r;
    });

    const dailySeries: Array<{
      date: string;
      messages: number;
      leads: number;
      escalations: number;
      avg_response_ms: number | null;
      tokens: number;
    }> = [];

    const cursor = new Date(from);
    const end    = new Date(to);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      const row = dailyMap[key];
      dailySeries.push({
        date:            key,
        messages:        row ? Number(row.messages)   : 0,
        leads:           row ? Number(row.leads)      : 0,
        escalations:     row ? Number(row.escalations): 0,
        avg_response_ms: row ? Number(row.avg_response_ms) : null,
        tokens:          row ? Number(row.tokens)     : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // ── 11. Global aggregates ─────────────────────────────────────────────────
    const totalMessages    = dailySeries.reduce((s, d) => s + d.messages, 0);
    const totalLeads       = dailySeries.reduce((s, d) => s + d.leads, 0);
    const totalEscalations = dailySeries.reduce((s, d) => s + d.escalations, 0);
    const totalTokens      = dailySeries.reduce((s, d) => s + d.tokens, 0);
    const responseTimes    = dailySeries.filter((d) => d.avg_response_ms !== null).map((d) => d.avg_response_ms as number);
    const avgResponseMs    = responseTimes.length
      ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length)
      : null;

    const convStats        = convStatsRes.rows[0] ?? {};
    const uniqueContacts   = Number(convStats.unique_contacts ?? 0);
    const escalationRate   = totalMessages > 0 ? Math.round((totalEscalations / totalMessages) * 100) : 0;
    const leadConvRate     = uniqueContacts > 0 ? Math.round((totalLeads / uniqueContacts) * 100) : 0;

    // Peak day and hour
    const peakDay  = dailySeries.reduce((best, d) => d.messages > best.messages ? d : best, dailySeries[0] ?? { date: null, messages: 0 });
    const peakHour = hourlyDistribution.reduce((best, h) => h.count > best.count ? h : best, hourlyDistribution[0]);

    // ── 11b. Messages REÇUS (source : Camille Core) ───────────────────────────
    // agent_analytics ne compte que les messages traités par l'IA. Camille Core, lui,
    // compte tout ce qui entre — c'est ce que l'utilisateur veut voir.
    const receivedByAgent: Record<string, number> = {};
    let totalReceived = 0;
    try {
      const sessRes = await safe(
        `SELECT agent_id, session_name FROM camille.whatsapp_sessions WHERE agent_id = ANY($1::uuid[])`,
        [agentIds]
      );
      const fromMs = new Date(`${from}T00:00:00Z`).getTime();
      const toMs   = new Date(`${to}T23:59:59Z`).getTime();
      const results = await Promise.all(
        sessRes.rows.map(async (r: { agent_id: string; session_name: string }) => ({
          agentId: r.agent_id,
          data: await wahaAnalytics(r.session_name, fromMs, toMs),
        }))
      );
      results.forEach(({ agentId: aid, data }) => {
        if (!data) return;
        receivedByAgent[aid] = (receivedByAgent[aid] ?? 0) + data.messages;
        totalReceived += data.messages;
      });
    } catch {
      // Camille Core indisponible : on renvoie simplement 0, sans casser les stats
    }

    // ── 12. Per-agent enriched list ───────────────────────────────────────────
    const agentDetails = await Promise.all(
      (agentIdParam ? allAgents.filter((a) => a.id === agentIdParam) : allAgents).map(async (a) => {
        const agg       = perAgentMap[a.id];
        const planId    = a.plan ?? "free";
        const limit     = await getPlanLimitDB(planId);
        const unlimited = isUnlimitedTokens(limit);
        const used      = tokenByAgent[a.id] ?? 0;
        const percent   = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
        const caps      = (a.capabilities ?? {}) as Record<string, boolean>;
        const activeCapsCount = Object.values(caps).filter(Boolean).length;

        return {
          id:               a.id,
          name:             (a.identity as Record<string, string>)?.name ?? "Agent",
          emoji:            (a.identity as Record<string, string>)?.avatar_emoji ?? "🤖",
          status:           a.status,
          plan:             planId,
          sector:           (a.business_context as Record<string, string>)?.sector ?? "",
          activeCaps:       activeCapsCount,
          created_at:       a.created_at,
          period_messages:  agg ? Number(agg.total_messages)      : 0,
          messages_received: receivedByAgent[a.id] ?? 0,
          period_leads:     agg ? Number(agg.total_leads)         : 0,
          period_escalations: agg ? Number(agg.total_escalations) : 0,
          period_tokens:    agg ? Number(agg.total_tokens)        : 0,
          avg_response_ms:  agg ? Number(agg.avg_response_ms)     : null,
          active_days:      agg ? Number(agg.active_days)         : 0,
          token_used_month: used,
          token_limit:      limit,
          token_unlimited:  unlimited,
          token_percent:    percent,
        };
      })
    );

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      period: periodParam,
      from,
      to,

      // Global KPIs
      overview: {
        total_messages:     totalMessages,
        messages_received:  totalReceived,
        unique_contacts:    uniqueContacts,
        total_leads:        totalLeads,
        total_escalations:  totalEscalations,
        escalation_rate:    escalationRate,
        lead_conversion:    leadConvRate,
        total_tokens:       totalTokens,
        avg_response_ms:    avgResponseMs,
        avg_conv_length:    avgConvLength,
        max_conv_length:    maxConvLength,
        peak_day:           peakDay?.date ?? null,
        peak_day_messages:  peakDay?.messages ?? 0,
        peak_hour:          peakHour?.hour ?? null,
        peak_hour_count:    peakHour?.count ?? 0,
      },

      // Time series
      daily_series:      dailySeries,
      monthly_tokens:    tokenHistRes.rows.map((r) => ({
        period:           r.period,
        total_tokens:     Number(r.total_tokens),
        prompt_tokens:    Number(r.prompt_tokens),
        completion_tokens: Number(r.completion_tokens),
      })).reverse(),

      // Distributions
      hourly_distribution: hourlyDistribution,
      dow_distribution:    dowDistribution,

      // Per-agent
      agents: agentDetails,
    });
  } catch (err) {
    console.error("[GET /api/stats]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
