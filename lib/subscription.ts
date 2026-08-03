// ─────────────────────────────────────────────────────────────────────────────
// Etat de l'abonnement d'un agent.
//
// Une seule regle, ecrite une seule fois : le garde-fou qui bloque les reponses
// et l'ecran qui l'annonce au vendeur doivent dire exactement la meme chose. Un
// agent muet dans les faits mais affiche « actif » est pire qu'une panne, parce
// que personne ne la cherche.
// ─────────────────────────────────────────────────────────────────────────────

/** Forfaits sans terme : rien a renouveler, jamais de coupure. */
const PLANS_SANS_TERME = new Set(["free", "enterprise"]);

/**
 * enterprise n'expire jamais, quelle que soit la date en base — c'est une regle
 * commerciale, pas un oubli : ces comptes ne doivent jamais pouvoir etre
 * desactives par un automatisme.
 */
export function planSansTerme(plan: string | null | undefined): boolean {
  return PLANS_SANS_TERME.has(String(plan ?? "free").toLowerCase());
}

export type SubscriptionState = {
  plan: string;
  /** true quand l'agent ne doit plus repondre faute de reabonnement. */
  expired: boolean;
  /** Fin d'abonnement, ou null pour un forfait sans terme. */
  expiresAt: string | null;
  /** Jours restants ; negatif si depasse, null si sans terme. */
  daysLeft: number | null;
};

export function subscriptionState(
  plan: string | null | undefined,
  planExpiresAt: string | Date | null | undefined,
  now: Date = new Date()
): SubscriptionState {
  const p = String(plan ?? "free").toLowerCase();

  if (planSansTerme(p) || !planExpiresAt) {
    return { plan: p, expired: false, expiresAt: null, daysLeft: null };
  }

  const end = planExpiresAt instanceof Date ? planExpiresAt : new Date(planExpiresAt);
  if (Number.isNaN(end.getTime())) {
    // Date illisible : on ne coupe pas sur une donnee qu'on ne comprend pas.
    return { plan: p, expired: false, expiresAt: null, daysLeft: null };
  }

  const msLeft = end.getTime() - now.getTime();
  return {
    plan: p,
    expired: msLeft <= 0,
    expiresAt: end.toISOString(),
    daysLeft: Math.ceil(msLeft / 86_400_000),
  };
}
