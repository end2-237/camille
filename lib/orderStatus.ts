// ─────────────────────────────────────────────────────────────────────────────
// Le cycle de vie d'une commande, en un seul endroit.
//
// Il vivait en dur dans la route PATCH ; le site public en a besoin aussi, et
// deux listes qui divergent, c'est un suivi qui ment. "traitee" est conservé :
// les commandes antérieures au cycle actuel l'utilisent encore.
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "nouvelle",
  "en_traitement",
  "en_livraison",
  "livree",
  "traitee",
  "annulee",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Étapes affichables, dans l'ordre. "traitee" (ancien) se lit comme "en_traitement". */
export const ORDER_STEPS = ["nouvelle", "en_traitement", "en_livraison", "livree"] as const;

const LABELS: Record<string, string> = {
  nouvelle: "Commande confirmée",
  en_traitement: "En préparation",
  traitee: "En préparation",
  en_livraison: "En livraison",
  livree: "Livrée",
  annulee: "Annulée",
};

export const statusLabel = (s: string) => LABELS[s] ?? s;

/**
 * Rang de l'étape courante (0-3), -1 pour une commande annulée.
 * Le site en tire directement sa barre de progression.
 */
export function statusStep(s: string): number {
  if (s === "annulee") return -1;
  if (s === "traitee") return 1;
  const i = (ORDER_STEPS as readonly string[]).indexOf(s);
  return i < 0 ? 0 : i;
}
