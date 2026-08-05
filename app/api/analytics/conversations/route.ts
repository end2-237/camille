// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/conversations?period=30d&agentId=UUID
//
// Analyse les conversations comme des BLOCS (une discussion = une session avec
// un contact, coupée après 12 h d'inactivité), et non message par message.
//
// Renvoie : l'entonnoir du parcours, les signatures d'échec regroupées,
// les causes de friction classées, et les questions restées sans réponse.
// Aucun appel LLM : tout est calculé, donc gratuit et déterministe.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

const GAP_MS = 12 * 3600 * 1000; // 12 h → nouvelle discussion

// Étapes du parcours d'achat, dans l'ordre
const STEPS = ["contact", "decouverte", "interet", "question", "panier", "commande"] as const;
type Step = (typeof STEPS)[number];

const STEP_OF: Record<string, Step> = {
  greet: "contact", smalltalk: "contact", company_info: "contact", thanks: "contact", goodbye: "contact",
  browse_all: "decouverte", browse_category: "decouverte", promotions: "decouverte",
  new_arrivals: "decouverte", best_sellers: "decouverte", gift_idea: "decouverte", more: "decouverte",
  show_product: "interet", product_details: "interet", list_variants: "interet",
  show_variant_image: "interet", color_availability: "interet", size_availability: "interet",
  recommend_similar: "interet", recommend_cheaper: "interet", compare_products: "interet",
  price_check: "question", stock_check: "question", delivery: "question",
  payment: "question", after_sales: "question",
  cart_add: "panier", cart_view: "panier", cart_from_pref: "panier", cart_remove: "panier",
  order_intent: "commande", cart_validate: "commande",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = {
  agent_id: string; session_name: string; contact_phone: string; user_msg: string;
  llm_intent: string; final_intent: string; corrected: boolean;
  reply_mode: string; items: number; cart_size: number; created_at: Date;
};

// Similarité grossière : sert à détecter qu'un client se répète.
function norm(s: string) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
}
function similar(a: string, b: string) {
  const A = new Set(norm(a).split(/\s+/).filter((w) => w.length >= 3));
  const B = new Set(norm(b).split(/\s+/).filter((w) => w.length >= 3));
  if (!A.size || !B.size) return false;
  let common = 0;
  A.forEach((w) => { if (B.has(w)) common++; });
  return common / Math.max(A.size, B.size) >= 0.6;
}

const NEGATIVE = /\bnon\b|c est pas (ca|cela)|pas (ca|cela)|je (ne )?comprends pas|tu comprends pas|je parle de|plutot|je veux pas/;

// Outil INTERNE : sert à mesurer la précision et la cohérence du modèle.
//
// L'accès suit maintenant `is_admin`, comme la console d'exploitation : une
// liste d'adresses en variable d'environnement se désynchronise du jour où on
// ajoute un administrateur en base, et personne ne s'en aperçoit avant le 403.
// INSIGHTS_ADMIN_EMAILS reste accepté pour ne casser aucun accès existant.
function isInternal(user: { email?: string; is_admin?: boolean }) {
  if (user.is_admin) return true;
  const list = (process.env.INSIGHTS_ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!user.email && list.includes(user.email.toLowerCase());
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isInternal(user)) {
    return NextResponse.json({ error: "Accès réservé" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const agentIdParam = params.get("agentId");
  const days = Number(String(params.get("period") ?? "30d").replace(/\D/g, "")) || 30;

  const agentsRes = await query(
    "SELECT id FROM camille.agents WHERE user_id = $1",
    [user.id]
  );
  let agentIds: string[] = agentsRes.rows.map((r: any) => r.id);
  if (agentIdParam) agentIds = agentIds.filter((id) => id === agentIdParam);
  if (!agentIds.length) return NextResponse.json({ empty: true, conversations: 0 });

  let rows: Row[] = [];
  try {
    const r = await query(
      `SELECT agent_id, session_name, contact_phone, user_msg,
              llm_intent, final_intent, corrected, reply_mode, items, cart_size, created_at
       FROM camille.conversation_traces
       WHERE agent_id = ANY($1::uuid[])
         AND created_at >= NOW() - ($2 || ' days')::INTERVAL
       ORDER BY session_name, contact_phone, created_at ASC`,
      [agentIds, String(days)]
    );
    rows = r.rows as Row[];
  } catch (e) {
    return NextResponse.json({
      empty: true, conversations: 0,
      error: "Table de traces absente — applique migration_conversation_traces.sql",
      detail: (e as Error).message,
    });
  }

  if (!rows.length) {
    return NextResponse.json({ empty: true, conversations: 0, note: "Aucune trace sur la période." });
  }

  // ── 1. Découpage en DISCUSSIONS (bloc = contact + inactivité < 12 h) ───────
  type Conv = { agent_id: string; contact: string; turns: Row[]; start: Date; end: Date };
  const convs: Conv[] = [];
  let cur: Conv | null = null;
  for (const t of rows) {
    const key = `${t.session_name}|${t.contact_phone}`;
    const ts = new Date(t.created_at).getTime();
    const sameBlock =
      cur && `${cur.turns[0].session_name}|${cur.contact}` === key &&
      ts - new Date(cur.end).getTime() < GAP_MS;
    if (!sameBlock) {
      cur = { agent_id: t.agent_id, contact: t.contact_phone, turns: [t], start: t.created_at, end: t.created_at };
      convs.push(cur);
    } else {
      cur!.turns.push(t);
      cur!.end = t.created_at;
    }
  }

  // ── 2. Analyse de CHAQUE discussion dans son ensemble ──────────────────────
  const funnel: Record<Step, number> = { contact: 0, decouverte: 0, interet: 0, question: 0, panier: 0, commande: 0 };
  const causes: Record<string, { conversations: number; exemples: string[] }> = {};
  const signatures: Record<string, { count: number; issue: string; exemple: string }> = {};
  const unanswered: Record<string, number> = {};
  let frictionCount = 0;

  const details = convs.map((c) => {
    const steps = new Set<Step>(["contact"]);
    const frictions: string[] = [];
    let corrections = 0, repetitions = 0, notFound = 0, handoff = false, ordered = false;
    const path: Step[] = [];

    c.turns.forEach((t, i) => {
      const st = STEP_OF[t.final_intent] || "contact";
      steps.add(st);
      if (path[path.length - 1] !== st) path.push(st);

      if (t.corrected) corrections++;
      if (t.final_intent === "not_found") {
        notFound++;
        const q = norm(t.user_msg).slice(0, 60);
        if (q) unanswered[q] = (unanswered[q] || 0) + 1;
      }
      if (t.final_intent === "talk_to_human") handoff = true;
      if (t.final_intent === "order_intent" || t.final_intent === "cart_validate") ordered = true;

      const prev = c.turns[i - 1];
      if (prev && similar(prev.user_msg, t.user_msg)) repetitions++;
      if (NEGATIVE.test(norm(t.user_msg))) frictions.push("correction_explicite");
    });

    if (corrections >= 2) frictions.push("intention_mal_comprise");
    if (repetitions >= 1) frictions.push("client_se_repete");
    if (notFound >= 1) frictions.push("produit_introuvable");
    if (handoff) frictions.push("passage_humain");

    // Abandon : le client était engagé (intérêt+) mais s'arrête sans commander
    const deepest = STEPS.filter((s) => steps.has(s)).pop() || "contact";
    const engaged = STEPS.indexOf(deepest) >= STEPS.indexOf("interet");
    if (engaged && !ordered) frictions.push("abandon_apres_interet");

    STEPS.forEach((s) => { if (steps.has(s)) funnel[s]++; });

    const issue = ordered ? "commande" : handoff ? "humain" : engaged ? "abandon" : "sans_suite";
    const signature = `${path.slice(0, 5).join(" → ")} · ${issue}`;

    if (frictions.length) {
      frictionCount++;
      const uniq = Array.from(new Set(frictions));
      uniq.forEach((f) => {
        if (!causes[f]) causes[f] = { conversations: 0, exemples: [] };
        causes[f].conversations++;
        const ex = c.turns.find((t) => t.user_msg)?.user_msg;
        if (ex && causes[f].exemples.length < 3) causes[f].exemples.push(ex.slice(0, 80));
      });
      if (!signatures[signature]) signatures[signature] = { count: 0, issue, exemple: c.contact };
      signatures[signature].count++;
    }

    return {
      contact: String(c.contact || "").slice(-4),
      agent_id: c.agent_id,
      debut: c.start,
      tours: c.turns.length,
      etape_max: deepest,
      issue,
      signature,
      frictions: Array.from(new Set(frictions)),
    };
  });

  // ── 2b. Précision du modèle : ce que le LLM propose vs ce qu'on retient ────
  const confusion: Record<string, number> = {};
  let corrigees = 0;
  rows.forEach((t) => {
    if (t.corrected && t.llm_intent && t.final_intent) {
      corrigees++;
      const k = `${t.llm_intent} → ${t.final_intent}`;
      confusion[k] = (confusion[k] || 0) + 1;
    }
  });
  const topConfusion = Object.entries(confusion)
    .map(([paire, count]) => ({ paire, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const precision = rows.length ? Math.round(((rows.length - corrigees) / rows.length) * 100) : 100;

  // ── 3. Agrégats ───────────────────────────────────────────────────────────
  const total = convs.length;
  const funnelPct = STEPS.map((s) => ({
    etape: s,
    conversations: funnel[s],
    pourcentage: total ? Math.round((funnel[s] / total) * 100) : 0,
  }));

  const topCauses = Object.entries(causes)
    .map(([cause, v]) => ({ cause, ...v }))
    .sort((a, b) => b.conversations - a.conversations);

  const topSignatures = Object.entries(signatures)
    .map(([signature, v]) => ({ signature, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const questionsSansReponse = Object.entries(unanswered)
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return NextResponse.json({
    periode_jours: days,
    // Précision du modèle : % de tours où l'intention du LLM n'a PAS eu besoin d'être corrigée
    precision_modele: precision,
    tours_analyses: rows.length,
    tours_corriges: corrigees,
    confusions: topConfusion,
    conversations: total,
    avec_friction: frictionCount,
    taux_friction: total ? Math.round((frictionCount / total) * 100) : 0,
    entonnoir: funnelPct,
    causes: topCauses,
    signatures: topSignatures,
    questions_sans_reponse: questionsSansReponse,
    discussions: details.slice(0, 100),
  });
}
