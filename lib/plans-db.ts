// ─────────────────────────────────────────────────────────────────────────────
// lib/plans-db.ts — Accès serveur aux plans/capacités depuis la base de données.
// Cache mémoire 5 min + fallback sur valeurs hardcodées si DB indisponible.
// IMPORTANT : ce fichier ne s'importe QUE côté serveur (routes API).
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "@/lib/db";

// ── Types exportés ────────────────────────────────────────────────────────────

export interface DbPlan {
  id:             string;
  label:          string;
  monthly_tokens: number;   // -1 = illimité
  price_xaf:      number;   // -1 = sur devis
  price_eur:      number;
  description:    string;
  tokens_label:   string;
  conv_estimate:  string;
  highlight:      boolean;
  badge:          string | null;
  cta_label:      string;
  cta_href:       string;
  is_purchasable: boolean;
  sort_order:     number;
  is_active:      boolean;
  features:       Array<{ label: string; included: boolean }>;
}

export interface DbCapability {
  id:                   string;
  label:                string;
  description:          string;
  tokens_per_msg:       number;
  detail:               string;
  color:                string;
  icon:                 string;   // nom du composant lucide-react
  note:                 string | null;
  sort_order:           number;
  status:               string;   // 'active' | 'coming_soon' | 'disabled'
  badge:                string | null;  // 'Core' | 'Bientôt' | 'Nouveau' | null
  is_user_configurable: boolean;  // false = toujours actif, non-toggleable
  plans:                string[];  // plan IDs qui incluent cette capacité
}

// ── Valeurs de secours si DB indisponible ─────────────────────────────────────

const FALLBACK_PLANS: DbPlan[] = [
  {
    id: "free", label: "Gratuit", monthly_tokens: 50_000, price_xaf: 0, price_eur: 0,
    description: "Pour tester la plateforme.", tokens_label: "50 000 tokens / mois",
    conv_estimate: "~80 conversations", highlight: false, badge: null,
    cta_label: "Commencer gratuitement", cta_href: "/configure",
    is_purchasable: false, sort_order: 1, is_active: true, features: [],
  },
  {
    id: "starter", label: "Starter", monthly_tokens: 500_000, price_xaf: 9_900, price_eur: 29,
    description: "Bot professionnel.", tokens_label: "500 000 tokens / mois",
    conv_estimate: "~700 conversations", highlight: false, badge: null,
    cta_label: "Passer au Starter", cta_href: "/dashboard/billing",
    is_purchasable: true, sort_order: 2, is_active: true, features: [],
  },
  {
    id: "pro", label: "Pro", monthly_tokens: 2_000_000, price_xaf: 24_900, price_eur: 79,
    description: "Automatisation complète.", tokens_label: "2 000 000 tokens / mois",
    conv_estimate: "~3 000 conversations", highlight: true, badge: "Populaire",
    cta_label: "Passer au Pro", cta_href: "/dashboard/billing",
    is_purchasable: true, sort_order: 3, is_active: true, features: [],
  },
  {
    id: "enterprise", label: "Enterprise", monthly_tokens: -1, price_xaf: -1, price_eur: 199,
    description: "Fort volume.", tokens_label: "Tokens illimités",
    conv_estimate: "Illimité", highlight: false, badge: null,
    cta_label: "Contacter l'équipe", cta_href: "mailto:hello@buyticle.com",
    is_purchasable: false, sort_order: 4, is_active: true, features: [],
  },
];

// ── Cache interne ─────────────────────────────────────────────────────────────

interface Cache {
  plans:        DbPlan[];
  capabilities: DbCapability[];
  ts:           number;
}

let _cache: Cache | null = null;
const TTL = 5 * 60 * 1000; // 5 minutes

// Invalide le cache (appeler après une mise à jour en DB si besoin)
export function invalidatePlansCache(): void {
  _cache = null;
}

// ── Fetch depuis DB ───────────────────────────────────────────────────────────

export async function getPlansFromDB(): Promise<{ plans: DbPlan[]; capabilities: DbCapability[] }> {
  if (_cache && Date.now() - _cache.ts < TTL) {
    return { plans: _cache.plans, capabilities: _cache.capabilities };
  }

  const [plansRes, capsRes, pcRes] = await Promise.all([
    query("SELECT * FROM camille.plans   WHERE is_active = TRUE ORDER BY sort_order ASC"),
    query("SELECT * FROM camille.capabilities WHERE is_active = TRUE ORDER BY sort_order ASC"),
    query("SELECT plan_id, capability_id FROM camille.plan_capabilities"),
  ]);

  // Construire un map cap_id → [plan_ids]
  const capPlanMap: Record<string, string[]> = {};
  for (const row of pcRes.rows as { plan_id: string; capability_id: string }[]) {
    if (!capPlanMap[row.capability_id]) capPlanMap[row.capability_id] = [];
    capPlanMap[row.capability_id].push(row.plan_id);
  }

  const plans: DbPlan[] = plansRes.rows.map((r) => ({
    ...r,
    monthly_tokens: Number(r.monthly_tokens),
    price_xaf:      Number(r.price_xaf),
    price_eur:      Number(r.price_eur),
    features:       typeof r.features === "string" ? JSON.parse(r.features) : (r.features ?? []),
  }));

  const capabilities: DbCapability[] = capsRes.rows.map((r) => ({
    ...r,
    tokens_per_msg:       Number(r.tokens_per_msg),
    status:               r.status               ?? "active",
    badge:                r.badge                ?? null,
    is_user_configurable: r.is_user_configurable ?? true,
    plans:                capPlanMap[r.id]        ?? [],
  }));

  _cache = { plans, capabilities, ts: Date.now() };
  return { plans, capabilities };
}

// ── Helpers async ─────────────────────────────────────────────────────────────

export async function getPlanByIdDB(planId: string): Promise<DbPlan | null> {
  try {
    const { plans } = await getPlansFromDB();
    return plans.find((p) => p.id === planId) ?? null;
  } catch {
    return FALLBACK_PLANS.find((p) => p.id === planId) ?? null;
  }
}

export async function getPlanLimitDB(planId: string): Promise<number> {
  const plan = await getPlanByIdDB(planId);
  return plan?.monthly_tokens ?? 50_000;
}

export async function getPlanLabelDB(planId: string): Promise<string> {
  const plan = await getPlanByIdDB(planId);
  return plan?.label ?? planId;
}

export async function getPlanPriceXafDB(planId: string): Promise<number> {
  const plan = await getPlanByIdDB(planId);
  return plan?.price_xaf ?? 0;
}

export function isUnlimitedTokens(monthlyTokens: number): boolean {
  return monthlyTokens === -1;
}

export async function isPurchasableDB(planId: string): Promise<boolean> {
  const plan = await getPlanByIdDB(planId);
  return plan?.is_purchasable ?? false;
}
