// lib/sectorProfiles.ts — profil de comportement par secteur d'activité.
// Source unique qui pilote : le welcome par défaut, le MODE (catalogue produit /
// prestations de service / prospection par médias), les médias configurables, et
// si le secteur est validé en "auto" (comportement N2 éprouvé à 100%).
//
// Ce qui est COMMUN reste dans le N2 générique ; ici on ne met que ce qui DIFFÈRE
// d'une identité à l'autre. Le dashboard lit ce profil selon le secteur choisi.

import type { BusinessSector } from "@/types/agent";

/** Comment ce secteur "montre" ce qu'il vend. */
export type SectorMode =
  | "catalogue"   // produits (avec prix/stock/variantes) — ex. mode, électronique
  | "services"    // prestations (devis/RDV) — ex. plomberie, salon
  | "media";      // prospection par visuels (flyers, galeries) sans catalogue structuré

/** Un média configurable dans le dashboard pour la prospection WhatsApp. */
export type MediaKind = {
  key: string;         // identifiant stable
  label: string;       // libellé dashboard
  hint: string;        // aide
  multiple: boolean;   // plusieurs fichiers ?
};

export interface SectorProfile {
  mode: SectorMode;
  /** true = comportement N2 éprouvé (test 100%) → activable en auto sans réglage. */
  auto: boolean;
  /** Étiquette lisible du secteur. */
  label: string;
  /** Welcome par défaut (ton camerounais chaleureux). {b} = nom du business. */
  welcome: string;
  /** Suggestions de réponses rapides proposées au client. */
  quickReplies: string[];
  /** Exemples de "catégories" pour aider la config catalogue/prestations. */
  categoriesHint: string[];
  /** Médias de prospection configurables (surtout pour services/media). */
  media: MediaKind[];
}

// Médias communs réutilisables
const FLYERS: MediaKind   = { key: "flyers",   label: "Flyers / affiches",       hint: "Visuels promotionnels envoyés sur WhatsApp", multiple: true };
const GALLERY: MediaKind  = { key: "gallery",  label: "Galerie de réalisations", hint: "Photos de vos travaux / résultats",          multiple: true };
const SERVICES: MediaKind = { key: "services", label: "Fiches de services",      hint: "Chaque prestation : nom, description, prix indicatif, photo", multiple: true };
const MENU_IMG: MediaKind = { key: "menu",     label: "Carte / menu (images)",   hint: "Photos de la carte ou des plats",             multiple: true };
const LOGO: MediaKind     = { key: "logo",     label: "Logo",                    hint: "Utilisé en en-tête des envois",               multiple: false };

/** Profils détaillés pour les secteurs prioritaires ; les autres retombent sur DEFAULT. */
const PROFILES: Partial<Record<BusinessSector, SectorProfile>> = {
  // 👗 / 📱 — catalogue produit : validés 100% → AUTO
  ecommerce: {
    mode: "catalogue", auto: true, label: "Boutique / e-commerce",
    welcome: "Bonjour et bienvenue chez {b} 👋 Dites-moi ce que vous cherchez, je vous montre nos produits, prix et couleurs disponibles.",
    quickReplies: ["Voir le catalogue", "Les promos", "Nouveautés"],
    categoriesHint: ["Femme", "Homme", "Accessoires", "Électronique"],
    media: [LOGO, FLYERS],
  },
  tech_saas: {
    mode: "catalogue", auto: true, label: "Électronique / high-tech",
    welcome: "Bienvenue chez {b} 📱 Téléphones, ordinateurs, accessoires… dites-moi ce qu'il vous faut, je vous donne les specs, le prix et la dispo.",
    quickReplies: ["Voir les téléphones", "Les ordinateurs", "Les promos"],
    categoriesHint: ["Téléphones", "Ordinateurs", "Audio", "Accessoires"],
    media: [LOGO, FLYERS],
  },
  // 🍔 — catalogue = menu, mais welcome/flow orienté resto
  food_beverage: {
    mode: "catalogue", auto: false, label: "Restaurant / alimentation",
    welcome: "Bonjour et bienvenue chez {b} 🍽️ Voici ce qu'on vous propose aujourd'hui — dites-moi ce qui vous fait envie et je vous donne le prix et comment commander.",
    quickReplies: ["Voir le menu", "Les plats du jour", "Commander"],
    categoriesHint: ["Entrées", "Plats", "Accompagnements", "Desserts", "Boissons"],
    media: [LOGO, MENU_IMG, FLYERS],
  },
  // 💇 — prestations + galerie de réalisations
  beauty_wellness: {
    mode: "services", auto: false, label: "Beauté / bien-être",
    welcome: "Bonjour et bienvenue chez {b} 💇‍♀️ Coiffure, ongles, soins… dites-moi ce que vous souhaitez, je vous présente nos prestations et on fixe un rendez-vous.",
    quickReplies: ["Nos prestations", "Prendre RDV", "Voir nos réalisations"],
    categoriesHint: ["Coiffure", "Onglerie", "Soins", "Maquillage"],
    media: [LOGO, SERVICES, GALLERY, FLYERS],
  },
  // 🛠️ — services purs, pas de catalogue : prospection par médias
  consulting: {
    mode: "services", auto: false, label: "Entreprise de services",
    welcome: "Bonjour et bienvenue chez {b} 🛠️ Dites-moi votre besoin (dépannage, installation, entretien…) et je vous oriente : prestation, devis ou rendez-vous.",
    quickReplies: ["Nos services", "Demander un devis", "Prendre RDV"],
    categoriesHint: ["Dépannage", "Installation", "Entretien"],
    media: [LOGO, SERVICES, GALLERY, FLYERS],
  },
};

/** Profil par défaut pour les secteurs non spécialisés. */
const DEFAULT: SectorProfile = {
  mode: "catalogue", auto: false, label: "Général",
  welcome: "Bonjour et bienvenue chez {b} 👋 Comment puis-je vous aider aujourd'hui ?",
  quickReplies: ["En savoir plus", "Nous contacter"],
  categoriesHint: [],
  media: [LOGO, FLYERS],
};

/** Renvoie le profil d'un secteur (jamais null). */
export function sectorProfile(sector?: BusinessSector | string | null): SectorProfile {
  if (sector && (PROFILES as Record<string, SectorProfile>)[sector]) {
    return (PROFILES as Record<string, SectorProfile>)[sector];
  }
  return DEFAULT;
}

/** Welcome effectif : message personnalisé s'il existe, sinon le défaut du secteur. */
export function resolveWelcome(
  sector: BusinessSector | string | null | undefined,
  businessName: string | null | undefined,
  custom?: string | null
): string {
  const b = (businessName || "notre boutique").trim();
  if (custom && custom.trim()) return custom.trim().replace(/\{b\}/g, b);
  return sectorProfile(sector).welcome.replace(/\{b\}/g, b);
}
