// ─────────────────────────────────────────────────────────────────────────────
// Les rôles d'équipe et ce qu'ils permettent. Sans dépendance serveur : le
// tableau de bord s'en sert aussi pour masquer ce qu'un rôle ne peut pas faire
// (le serveur, lui, refuse de toute façon — lib/equipe.ts).
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "proprietaire" | "gerant" | "vendeur";
export type Action = "voir" | "ventes" | "catalogue" | "reglages" | "facturation" | "equipe" | "supprimer";

const DROITS: Record<Role, ReadonlySet<Action>> = {
  proprietaire: new Set<Action>(["voir", "ventes", "catalogue", "reglages", "facturation", "equipe", "supprimer"]),
  gerant: new Set<Action>(["voir", "ventes", "catalogue", "reglages"]),
  vendeur: new Set<Action>(["voir", "ventes"]),
};

export const LIBELLE_ROLE: Record<Role, string> = {
  proprietaire: "Propriétaire",
  gerant: "Gérant",
  vendeur: "Vendeur",
};

export function permet(role: Role | null | undefined, action: Action): boolean {
  return !!role && DROITS[role].has(action);
}
