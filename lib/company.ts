// ─────────────────────────────────────────────────────────────────────────────
// lib/company.ts — Source unique de vérité pour les infos Buyticle / Camille
// Modifiez ce fichier pour mettre à jour toutes les pages en une fois.
// ─────────────────────────────────────────────────────────────────────────────

export const COMPANY = {
  // Identité légale
  name:           "Buyticle",
  legalName:      "Buyticle",
  legalForm:      "Établissement (ETS)",
  foundedYear:    2025,

  // Localisation
  city:           "Douala",
  country:        "Cameroun",
  address:        "Douala, Cameroun",

  // Contact
  emailPrimary:   "contact@buyticle.com",
  emailSecondary: "hello@buyticle.com",
  emailSupport:   "support@buyticle.com",
  emailLegal:     "legal@buyticle.com",
  emailPrivacy:   "privacy@buyticle.com",
  emailSecurity:  "security@buyticle.com",
  phone:          "+237 696 995 879",
  phoneRaw:       "+237696995879",

  // Web
  website:        "buyticle.com",
  websiteUrl:     "https://buyticle.com",
  productName:    "Camille",
  productUrl:     "https://camille.buyticle.com",

  // Réseaux sociaux
  twitter:        "@buyticle",

  // Textes récurrents
  tagline:        "Créez et déployez des agents IA personnalisés. No-code. En minutes.",
  madeIn:         "Douala, Cameroun",
} as const;

/** Retourne "© YYYY Buyticle. Tous droits réservés." */
export function copyright(year = new Date().getFullYear()) {
  return `© ${year} ${COMPANY.name}. Tous droits réservés.`;
}
