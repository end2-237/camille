// ─────────────────────────────────────────────────────────────────────────────
// Une commande ne s'enregistre qu'une fois.
//
// Cas réel : deux commandes du même client à deux minutes d'écart (JJ9HZA puis
// LRBWL5), la seconde sans qu'aucun produit ait été montré entre-temps. Deux
// messages arrivés presque ensemble (la position, puis le quartier tapé à la
// main) lisaient le même panier avant qu'il soit effacé, et chacun créait sa
// commande. Module pur : testé dans tests/unit.mjs.
// ─────────────────────────────────────────────────────────────────────────────

export type LigneSignee = { productId?: string | null; name?: string | null; variant?: string | null; qty?: number | null };

/** Le contenu d'un panier, indépendant de l'ordre des lignes. */
export function signatureArticles(items: LigneSignee[]): string {
  return items
    .map((l) => `${l.productId || l.name || "?"}|${(l.variant || "").trim().toLowerCase()}|${Math.max(1, Number(l.qty) || 1)}`)
    .sort()
    .join(";");
}

/** Fenêtre pendant laquelle le même panier du même client est un doublon. */
export const FENETRE_DOUBLON_MS = 10 * 60_000;

/** Cette commande récente est-elle le même panier, renvoyé ou traité deux fois ? */
export function estDoublon(
  nouveaux: LigneSignee[],
  recente: { items: LigneSignee[]; creeLe: number } | null,
  maintenant: number
): boolean {
  if (!recente) return false;
  const age = maintenant - recente.creeLe;
  if (age < 0 || age > FENETRE_DOUBLON_MS) return false;
  return signatureArticles(nouveaux) === signatureArticles(recente.items);
}
