// ─────────────────────────────────────────────────────────────────────────────
// lib/plans.ts — Définition des plans et limites de tokens mensuels
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = {
  free:       { label: "Gratuit",    monthly_tokens:    50_000, price_eur: 0,   price_xaf: 0       },
  starter:    { label: "Starter",    monthly_tokens:   500_000, price_eur: 29,  price_xaf: 9_900   },
  pro:        { label: "Pro",        monthly_tokens: 2_000_000, price_eur: 79,  price_xaf: 24_900  },
  enterprise: { label: "Enterprise", monthly_tokens:        -1, price_eur: 199, price_xaf: -1      },
} as const;

export type PlanId = keyof typeof PLANS;

/** Plans that can be purchased directly (excludes free and enterprise). */
export const UPGRADEABLE_PLANS: PlanId[] = ["starter", "pro"];

export function getPlanLimit(plan: string): number {
  return PLANS[plan as PlanId]?.monthly_tokens ?? PLANS.free.monthly_tokens;
}

export function getPlanLabel(plan: string): string {
  return PLANS[plan as PlanId]?.label ?? "Gratuit";
}

export function getPlanPriceXAF(plan: string): number {
  return PLANS[plan as PlanId]?.price_xaf ?? 0;
}

export function getPlanPriceEUR(plan: string): number {
  return PLANS[plan as PlanId]?.price_eur ?? 0;
}

export function isPaidPlan(plan: string): boolean {
  return getPlanPriceXAF(plan) > 0;
}

export function isUnlimited(plan: string): boolean {
  return getPlanLimit(plan) === -1;
}

/** Période courante au format YYYY-MM */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
