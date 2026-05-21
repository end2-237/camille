// GET /api/agents/[agentId]/owner-stats
// Retourne les métriques business agrégées pour le conseiller stratégique.
// Appelé par n8n — pas de JWT requis (le phone a déjà été authentifié via owner-session).

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;

  try {
    // ── Conversations ce mois ────────────────────────────────────────────────
    const convResult = await query(
      `SELECT
         COUNT(*)                                        AS total_messages,
         COUNT(DISTINCT contact_phone)                  AS unique_customers,
         COUNT(*) FILTER (WHERE role = 'user')          AS user_messages,
         COUNT(*) FILTER (WHERE role = 'assistant')     AS bot_messages,
         DATE_TRUNC('month', NOW())::DATE::TEXT          AS period_start
       FROM camille.agent_conversations
       WHERE session_name IN (
         SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1
       )
       AND created_at >= DATE_TRUNC('month', NOW())`,
      [agentId]
    );

    const conv = convResult.rows[0] ?? {};

    // ── Token usage ce mois ──────────────────────────────────────────────────
    let tokens: { total_tokens?: string; llm_calls?: string } = {};
    try {
      const tokenResult = await query(
        `SELECT
           COALESCE(SUM(tokens_used), 0) AS total_tokens,
           COUNT(*)                       AS llm_calls
         FROM camille.token_usage
         WHERE agent_id = $1
         AND recorded_at >= DATE_TRUNC('month', NOW())`,
        [agentId]
      );
      tokens = tokenResult.rows[0] ?? {};
    } catch {
      // Table token_usage peut ne pas exister encore
    }

    // ── Leads ce mois ─────────────────────────────────────────────────────────
    let leadsCount = 0;
    try {
      const leadResult = await query(
        `SELECT COUNT(*) AS leads_count
         FROM camille.leads
         WHERE agent_id = $1
         AND created_at >= DATE_TRUNC('month', NOW())`,
        [agentId]
      );
      leadsCount = parseInt(leadResult.rows[0]?.leads_count ?? "0", 10);
    } catch {
      // Table leads peut ne pas exister encore
    }

    // ── Rendez-vous ce mois (conversations avec "✅ Rendez-vous confirmé") ───
    let appointmentsCount = 0;
    try {
      const apptResult = await query(
        `SELECT COUNT(*) AS appt_count
         FROM camille.agent_conversations
         WHERE session_name IN (
           SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1
         )
         AND role = 'assistant'
         AND content LIKE '%Rendez-vous confirmé%'
         AND created_at >= DATE_TRUNC('month', NOW())`,
        [agentId]
      );
      appointmentsCount = parseInt(apptResult.rows[0]?.appt_count ?? "0", 10);
    } catch {
      // Ignore
    }

    // ── Heures de pointe (top 3 heures) ─────────────────────────────────────
    let peakHours: string[] = [];
    try {
      const peakResult = await query(
        `SELECT
           EXTRACT(HOUR FROM created_at)::INT AS hour,
           COUNT(*) AS msg_count
         FROM camille.agent_conversations
         WHERE session_name IN (
           SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1
         )
         AND role = 'user'
         AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY hour
         ORDER BY msg_count DESC
         LIMIT 3`,
        [agentId]
      );
      peakHours = peakResult.rows.map((r: { hour: number }) => `${r.hour}h-${r.hour + 1}h`);
    } catch {
      // Ignore
    }

    // ── Calcul taux de conversion lead → RDV ────────────────────────────────
    const totalMessages     = parseInt(conv.total_messages ?? "0", 10);
    const uniqueCustomers   = parseInt(conv.unique_customers ?? "0", 10);
    const conversionRate    = leadsCount > 0 && appointmentsCount > 0
      ? Math.round((appointmentsCount / leadsCount) * 100)
      : 0;

    const avgMsgPerCustomer = uniqueCustomers > 0
      ? Math.round(totalMessages / uniqueCustomers)
      : 0;

    return NextResponse.json({
      period: conv.period_start ?? new Date().toISOString().slice(0, 7),
      conversations: {
        total_messages:      totalMessages,
        unique_customers:    uniqueCustomers,
        user_messages:       parseInt(conv.user_messages ?? "0", 10),
        bot_messages:        parseInt(conv.bot_messages ?? "0", 10),
        avg_msg_per_customer: avgMsgPerCustomer,
      },
      leads: {
        captured:          leadsCount,
        appointments:      appointmentsCount,
        conversion_rate:   conversionRate,
      },
      tokens: {
        total:     parseInt(tokens.total_tokens ?? "0", 10),
        llm_calls: parseInt(tokens.llm_calls ?? "0", 10),
      },
      peak_hours: peakHours,
    });
  } catch (err) {
    console.error("[GET /api/agents/:id/owner-stats]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
