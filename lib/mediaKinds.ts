/**
 * Natures de visuels d'un agent. Générique par construction : chaque surface
 * pioche ce qui la concerne, et un marchand n'utilise que ce qui lui parle.
 *
 * Ajouter une nature ici suffit — l'API, la page Médias et le catalogue public
 * la reprennent.
 */
export const MEDIA_KINDS = [
  "logo",
  "banner",
  "category",
  "gallery",
  "menu",
  "services",
  "flyers",
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];
