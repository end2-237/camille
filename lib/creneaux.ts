// ─────────────────────────────────────────────────────────────────────────────
// Les créneaux libres d'un agent — jamais deux rendez-vous qui se chevauchent.
//
// Aucun import hors horaires : éprouvé par npm test. La base garantit aussi
// la règle (contrainte d'exclusion) ; ici, on ne PROPOSE que ce qui est
// réellement libre, pour que le client n'ait pas à se faire refuser.
// ─────────────────────────────────────────────────────────────────────────────
import { lireSemaine, ouvertA, type Semaine } from "./horaires";

export type Occupe = { debut: Date; fin: Date };

/** Deux intervalles [a, b) et [c, d) se touchent-ils ? Bout à bout n'est pas un chevauchement. */
export function chevauche(a: Occupe, b: Occupe): boolean {
  return a.debut.getTime() < b.fin.getTime() && b.debut.getTime() < a.fin.getTime();
}

/**
 * Le rendez-vous tient-il dans les horaires ? Le début ET la dernière minute
 * doivent être dans une plage ouverte : une coupe de 18 h 30 à 19 h 30 dans un
 * salon qui ferme à 19 h n'est pas proposable.
 */
export function dansLesHoraires(s: Semaine, debut: Date, fin: Date, offset = 1): boolean {
  for (let t = debut.getTime(); t < fin.getTime(); t += 15 * 60_000) {
    if (!ouvertA(s, new Date(t), offset)) return false;
  }
  return ouvertA(s, new Date(fin.getTime() - 60_000), offset);
}

/**
 * Les prochains créneaux libres.
 * - `duree` : la durée du rendez-vous, en minutes ;
 * - `pas` : l'espacement des débuts proposés (par défaut, la durée elle-même,
 *   arrondie à 15 min — 30, 45, 60…) ;
 * - `delai` : pas de rendez-vous avant maintenant + delai minutes ;
 * - `occupes` : les rendez-vous actifs (demandés ou confirmés).
 * Horaires illisibles : 8 h-19 h du lundi au samedi, plutôt que rien.
 */
export function creneauxLibres(p: {
  horaires?: string | null;
  occupes: Occupe[];
  duree: number;
  maintenant?: Date;
  n?: number;
  pas?: number;
  delai?: number;
  jours?: number;
  offset?: number;
}): Date[] {
  const maintenant = p.maintenant ?? new Date();
  const offset = p.offset ?? 1;
  const duree = Math.max(15, Math.round(p.duree || 30));
  const pas = Math.max(15, Math.round((p.pas ?? Math.ceil(duree / 15) * 15) / 15) * 15);
  const s: Semaine = lireSemaine(p.horaires) || [[], [[8, 19]], [[8, 19]], [[8, 19]], [[8, 19]], [[8, 19]], [[8, 19]]];
  const sortie: Date[] = [];
  // Premier départ : maintenant + délai, arrondi au quart d'heure suivant.
  const q = 15 * 60_000;
  let t = Math.ceil((maintenant.getTime() + (p.delai ?? 60) * 60_000) / q) * q;
  const fin = maintenant.getTime() + (p.jours ?? 14) * 86400_000;
  while (sortie.length < (p.n ?? 9) && t <= fin) {
    const d = new Date(t);
    const f = new Date(t + duree * 60_000);
    // Aligné sur le pas, à l'heure locale (9 h, 9 h 30… plutôt que 9 h 15 au hasard).
    const minutesLocales = Math.round(((t + offset * 3600_000) % 86400_000) / 60_000);
    if (minutesLocales % pas === 0 && dansLesHoraires(s, d, f, offset) && !p.occupes.some((o) => chevauche(o, { debut: d, fin: f }))) {
      sortie.push(d);
    }
    t += q;
  }
  return sortie;
}

/**
 * Quand rappeler un rendez-vous, à l'heure de Douala : trois heures avant,
 * jamais avant 7 h ; un rendez-vous du matin (avant 10 h) se rappelle la
 * veille à 19 h. Personne n'aime un WhatsApp à 6 h pour un rendez-vous à 9 h.
 */
export function heureDuRappel(debut: Date, offset = 1): Date {
  const local = new Date(debut.getTime() + offset * 3600_000);
  const jour = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset * 3600_000;
  if (local.getUTCHours() < 10) return new Date(jour - 5 * 3600_000); // la veille, 19 h locale
  return new Date(Math.max(debut.getTime() - 3 * 3600_000, jour + 7 * 3600_000));
}
