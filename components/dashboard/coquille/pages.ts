// ─────────────────────────────────────────────────────────────────────────────
// Le plan du tableau de bord : chaque page, sa famille dans le menu du haut,
// son titre, et si elle dépend d'un agent (puces « Agent » / « Statut » et
// bouton flottant pour passer à un autre agent).
// ─────────────────────────────────────────────────────────────────────────────

export type Famille = "accueil" | "ventes" | "chiffres" | "clients" | "catalogue" | "reglages";

export const FAMILLES: Record<Famille, string> = {
  accueil: "Accueil", ventes: "Ventes", chiffres: "Chiffres",
  clients: "Clients", catalogue: "Catalogue", reglages: "Réglages",
};

export type Page = {
  famille: Famille;
  titre: string;
  /** La page montre un agent : puces agent/statut et bouton de bascule. */
  parAgent: boolean;
  /** Le segment après /dashboard/<id>/ ; vide pour la page de l'agent. */
  segment?: string;
  /** Chemin global (/dashboard/orders…). */
  chemin?: string;
};

export const PAGES: Page[] = [
  { famille: "ventes", titre: "Commandes", chemin: "/dashboard/orders", parAgent: true },
  { famille: "ventes", titre: "Suivi des livraisons", segment: "suivi", parAgent: true },
  { famille: "ventes", titre: "Réclamations", chemin: "/dashboard/complaints", parAgent: false },
  { famille: "ventes", titre: "Modèles de message", chemin: "/dashboard/templates", parAgent: false },
  { famille: "chiffres", titre: "Statistiques", chemin: "/dashboard/stats", parAgent: true },
  { famille: "chiffres", titre: "Comptes entreprise", segment: "entreprises", parAgent: true },
  { famille: "chiffres", titre: "Abonnement et facturation", chemin: "/dashboard/billing", parAgent: false },
  { famille: "clients", titre: "Clientèle", segment: "clientele", parAgent: true },
  { famille: "clients", titre: "Livreurs", segment: "livreurs", parAgent: true },
  { famille: "catalogue", titre: "Catalogue", segment: "catalog", parAgent: true },
  { famille: "catalogue", titre: "Catalogue WhatsApp", segment: "catalog-sync", parAgent: true },
  { famille: "catalogue", titre: "WhatsApp officiel", segment: "whatsapp", parAgent: true },
  { famille: "catalogue", titre: "Médias", segment: "medias", parAgent: true },
  { famille: "reglages", titre: "Votre agent", segment: "", parAgent: true },
  { famille: "reglages", titre: "Configuration de l'agent", segment: "settings", parAgent: true },
  { famille: "reglages", titre: "Intégrations", segment: "integrations", parAgent: true },
  { famille: "reglages", titre: "Trafic du site", segment: "trafic", parAgent: true },
  { famille: "reglages", titre: "Mon profil", chemin: "/dashboard/profil", parAgent: false },
  { famille: "reglages", titre: "Notifications", chemin: "/dashboard/notifications", parAgent: false },
  { famille: "reglages", titre: "Exploitation", chemin: "/dashboard/admin", parAgent: false },
  { famille: "reglages", titre: "Qualité de l'agent", chemin: "/dashboard/insights", parAgent: false },
];

/** La page qui correspond à un chemin, ou null (accueil, page inconnue). */
export function pageDe(chemin: string): Page | null {
  const global = PAGES.find((p) => p.chemin && chemin === p.chemin);
  if (global) return global;
  const m = chemin.match(/^\/dashboard\/[0-9a-fA-F-]{8,}(?:\/([^/?#]+))?/);
  if (!m) return null;
  return PAGES.find((p) => p.segment !== undefined && p.segment === (m[1] || "")) || null;
}

/** L'adresse d'une page pour un agent donné. */
export function hrefDe(p: Page, agentId?: string): string | null {
  if (p.chemin) return p.chemin;
  if (!agentId) return null;
  return p.segment ? `/dashboard/${agentId}/${p.segment}` : `/dashboard/${agentId}`;
}
