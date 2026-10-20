// ─────────────────────────────────────────────────────────────────────────────
// Les demandes manquées, regroupées : « vous avez des sandales ? », « je
// cherche sandale noire », « sandales dispo ? » sont UNE demande — celle
// qui dit au commerçant quoi ajouter à son catalogue.
// Module pur, éprouvé par npm test.
// ─────────────────────────────────────────────────────────────────────────────
import { sansAccent } from "./recherche";

/** Les mots qui habillent la demande sans la porter. */
const VIDES = new Set(
  (
    "vous avez tu as vous aviez avez as je cherche cherche recherche est ce que estce il y a ya y a t il svp stp " +
    "s il vous plait bonjour bonsoir salut slt hello merci dispo disponible disponibles encore aussi " +
    "des de du la le les un une mon ma mes moi pour pas en avec sans quel quelle quels quelles combien prix " +
    "c est cest et ou au aux sur chez vos votre ton ta tes on peut avoir veux voudrais aimerais besoin " +
    "noir noire blanc blanche rouge bleu bleue vert verte"
  ).split(/\s+/)
);

/** Le cœur d'une demande : « vous avez des sandales noires ? » → « sandale ». */
export function coeurDemande(texte: string): string {
  const mots = sansAccent(texte)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    // Un pluriel simple ne fait pas une autre demande.
    .map((m) => (m.length > 4 && /[sx]$/.test(m) ? m.slice(0, -1) : m))
    .filter((m) => m.length > 2 && !VIDES.has(m) && !/^\d+$/.test(m));
  return mots.slice(0, 3).join(" ");
}

/** Regroupe et compte, la plus demandée d'abord. Un client compte une fois par demande. */
export function regrouperDemandes(
  lignes: { texte: string; phone?: string | null }[],
  max = 5
): { demande: string; clients: number }[] {
  const groupes = new Map<string, Set<string>>();
  lignes.forEach((l, i) => {
    const c = coeurDemande(l.texte);
    if (!c) return;
    const s = groupes.get(c) || new Set<string>();
    s.add(l.phone || `#${i}`);
    groupes.set(c, s);
  });
  return [...groupes.entries()]
    .map(([demande, s]) => ({ demande, clients: s.size }))
    .sort((a, b) => b.clients - a.clients || a.demande.localeCompare(b.demande))
    .slice(0, max);
}
