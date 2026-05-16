// ─────────────────────────────────────────────────────────────────────────────
// lib/plans.ts — Définition des plans et limites de tokens mensuels
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = {
  free:       { label: "Gratuit",    monthly_tokens:    50_000, price_eur: 0   },
  starter:    { label: "Starter",    monthly_tokens:   500_000, price_eur: 29  },
  pro:        { label: "Pro",        monthly_tokens: 2_000_000, price_eur: 79  },
  enterprise: { label: "Enterprise", monthly_tokens:        -1, price_eur: 199 },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlanLimit(plan: string): number {
  return PLANS[plan as PlanId]?.monthly_tokens ?? PLANS.free.monthly_tokens;
}

export function getPlanLabel(plan: string): string {
  return PLANS[plan as PlanId]?.label ?? "Gratuit";
}

export function isUnlimited(plan: string): boolean {
  return getPlanLimit(plan) === -1;
}

/** Période courante au format YYYY-MM */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
