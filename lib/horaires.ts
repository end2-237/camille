// ─────────────────────────────────────────────────────────────────────────────
// Les heures d'ouverture, telles que le commerçant les écrit.
//
// Aucun import : cette logique est éprouvable telle quelle, sans base de
// données ni réseau, et le tableau de bord s'en sert aussi pour montrer au
// commerçant ce que Camille a compris.
//
// Ce qu'elle protège : un accusé de commande qui promet « on te recontacte tout
// de suite » à 2 h du matin est un mensonge, et le client le constate le
// lendemain. Mais inventer un horaire à partir d'un texte qu'on n'a pas compris
// serait pire — alors on se tait plutôt que de promettre faux.
//
// Les jours comptent. « Lun-Ven 9h-18h, Sam 10h-17h » veut dire fermé le
// dimanche ; la première version ne lisait que « 9h-18h » et se croyait
// ouverte sept jours sur sept.
// ─────────────────────────────────────────────────────────────────────────────

/** Une plage [ouverture, fermeture] en heures décimales. `ouvre > ferme` : la plage passe minuit. */
export type Plage = [number, number];
/** Les plages de chaque jour, dimanche = 0 comme `getUTCDay()`. Un jour vide est un jour fermé. */
export type Semaine = Plage[][];

const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** `8h30` plutôt que `8.5`. */
export function libelle(x: number): string {
  const n = Math.floor(x) % 24;
  const mn = Math.round((x - Math.floor(x)) * 60);
  return `${n}h${mn ? String(mn).padStart(2, "0") : ""}`;
}

function simple(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Un jour, en français ou en anglais, en entier ou abrégé. L'ordre compte :
// « mar » ne doit pas manger « mardi » à moitié.
const MOT_JOUR: [RegExp, number][] = [
  [/^(dimanches?|dim|sun(day)?)$/, 0],
  [/^(lundis?|lun|monday)$/, 1], // pas « mon » : « mon magasin… »
  [/^(mardis?|mar|tue(s(day)?)?)$/, 2],
  [/^(mercredis?|mer|wed(nesday)?)$/, 3],
  [/^(jeudis?|jeu|thu(rs(day)?)?)$/, 4],
  [/^(vendredis?|ven|fri(day)?)$/, 5],
  [/^(samedis?|sam|sat(urday)?)$/, 6],
];

/**
 * La semaine lue dans un texte libre.
 *
 * `null` quand le texte n'est pas interprétable — « Sur rendez-vous »,
 * « quand on peut », une case vide. C'est fréquent, et ça doit rester
 * silencieux : le commerçant n'a aucune obligation d'écrire dans un format.
 *
 * Ce qui se lit : « 8h-18h », « 08:00 - 22:00 », « Lun-Ven 9h-18h, Sam
 * 10h-17h », « du lundi au samedi de 8h à 20h, dimanche fermé », « 7j/7
 * 11h-23h », « 8h-12h / 14h-18h », « 20h - 02h », « 24h/24 ».
 * Une plage sans jour vaut pour tous les jours qui n'en ont pas d'autre ; dès
 * qu'un jour est nommé, ceux qui ne le sont jamais sont fermés.
 */
export function lireSemaine(hours?: string | null): Semaine | null {
  const t = simple(hours || "");
  if (!t.trim()) return null;
  if (/24\s*h?\s*\/\s*24|24\s*h\s*sur\s*24|non.?stop|jour et nuit/.test(t)) {
    return Array.from({ length: 7 }, () => [[0, 24] as Plage]);
  }

  const explicite: (Plage[] | undefined)[] = Array(7).fill(undefined);
  const defaut: Plage[] = [];
  let unJourNomme = false;

  let jours: number[] = []; // les jours auxquels s'appliquent les plages qui suivent
  let applique = false; // une plage a déjà été posée sur `jours`
  let dernierJour: number | null = null;
  let lienJours = false; // « lun-ven », « du lundi au vendredi »
  let heures: number[] = [];

  const poser = (p: Plage | null) => {
    if (!jours.length) {
      if (p) defaut.push(p);
    } else {
      for (const j of jours) {
        explicite[j] = explicite[j] ?? [];
        if (p) explicite[j]!.push(p);
      }
    }
    applique = true;
  };

  const jetons = t.match(/\d{1,2}\s*(?:h|:)\s*\d{0,2}|\d{1,2}\s*heures?|midi|minuit|[a-z]+|[-–—/,;]|\d+/g) || [];
  for (let i = 0; i < jetons.length; i++) {
    const j = jetons[i];

    if (/^(tous|toute?s?|chaque|7j|everyday|daily)$/.test(j) && /^(les|la|jours?|semaine|7|7\/7)?$/.test(jetons[i + 1] || "")) {
      if (applique) { jours = []; applique = false; }
      jours = [0, 1, 2, 3, 4, 5, 6];
      unJourNomme = true;
      continue;
    }

    const jour = MOT_JOUR.find(([re]) => re.test(j))?.[1];
    if (jour !== undefined) {
      if (applique) { jours = []; applique = false; heures = []; }
      if (lienJours && dernierJour !== null) {
        for (let k: number = (dernierJour + 1) % 7; ; k = (k + 1) % 7) {
          if (!jours.includes(k)) jours.push(k);
          if (k === jour) break;
        }
      } else if (!jours.includes(jour)) {
        jours.push(jour);
      }
      dernierJour = jour;
      lienJours = false;
      unJourNomme = true;
      continue;
    }

    if (/^(au|a|-|–|—)$/.test(j) && dernierJour !== null && !heures.length) {
      // « lun - ven » : le jour suivant ferme l'intervalle. « lun 8h - 18h » : non.
      const suivant = jetons[i + 1] || "";
      if (MOT_JOUR.some(([re]) => re.test(suivant))) lienJours = true;
      continue;
    }

    if (/^(ferme|fermee|closed|repos)$/.test(j)) {
      poser(null);
      heures = [];
      continue;
    }

    let h: number | null = null;
    const hm = j.match(/^(\d{1,2})\s*(?:h|:|heures?)\s*(\d{0,2})$/);
    if (hm) h = Number(hm[1]) + Number(hm[2] || 0) / 60;
    else if (j === "midi") h = 12;
    else if (j === "minuit") h = 24;
    if (h === null || h > 24) continue;

    heures.push(h);
    if (heures.length === 2) {
      let [o, f] = heures;
      if (f === 0) f = 24;
      if (o === 24) o = 0;
      heures = [];
      if (o === f) continue;
      poser([o, f]);
    }
  }

  const semaine: Semaine = Array.from({ length: 7 }, (_, d) => explicite[d] ?? (unJourNomme && !defaut.length ? [] : [...defaut]));
  if (!semaine.some((p) => p.length)) return null;
  return semaine;
}

/**
 * La première plage lue — l'ancienne lecture, gardée pour ce qui n'a besoin
 * que d'un ordre de grandeur (l'heure du bilan du matin).
 */
export function lireHoraires(hours?: string | null): { ouvre: number; ferme: number } | null {
  const s = lireSemaine(hours);
  if (!s) return null;
  if (s.every((p) => p.length === 1 && p[0][0] === 0 && p[0][1] === 24)) return null; // toujours ouvert : rien à annoncer
  const p = s.flat()[0];
  return p ? { ouvre: p[0], ferme: p[1] } : null;
}

/**
 * Le commerce est-il ouvert à cette heure, sur une seule plage ?
 * `ouvre > ferme` : un commerce qui travaille la nuit — « 20h - 02h » —, courant
 * à Douala pour la restauration.
 */
export function estOuvert(ouvre: number, ferme: number, heure: number): boolean {
  return ouvre < ferme ? heure >= ouvre && heure < ferme : heure >= ouvre || heure < ferme;
}

/** L'heure locale décimale, à partir d'un décalage UTC. */
export function heureLocale(maintenant: Date, offset: number): number {
  return ((((maintenant.getUTCHours() + offset) % 24) + 24) % 24) + maintenant.getUTCMinutes() / 60;
}

/** Le jour (0 = dimanche) et l'heure décimale, à l'heure locale. */
export function momentLocal(d: Date, offset = 1): { jour: number; heure: number } {
  const x = new Date(d.getTime() + offset * 3600_000);
  return { jour: x.getUTCDay(), heure: x.getUTCHours() + x.getUTCMinutes() / 60 };
}

/** Ouvert à cet instant ? La plage de nuit de la veille compte encore après minuit. */
export function ouvertA(s: Semaine, d: Date, offset = 1): boolean {
  const { jour, heure } = momentLocal(d, offset);
  if (s[jour].some(([o, f]) => (o < f ? heure >= o && heure < f : heure >= o))) return true;
  return s[(jour + 6) % 7].some(([o, f]) => o > f && heure < f);
}

/**
 * La prochaine ouverture après `d` : l'instant, et sa forme parlée —
 * « à 8h », « demain à 8h », « lundi à 9h ». `null` si la semaine est vide.
 */
export function prochaineOuverture(s: Semaine, d: Date, offset = 1): { quand: Date; texte: string } | null {
  const x = new Date(d.getTime() + offset * 3600_000);
  const minuit = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) - offset * 3600_000;
  for (let k = 0; k <= 7; k++) {
    const jour = (x.getUTCDay() + k) % 7;
    const debuts = s[jour].map(([o]) => o).sort((a, b) => a - b);
    for (const o of debuts) {
      const quand = minuit + k * 86400_000 + o * 3600_000;
      if (quand <= d.getTime()) continue;
      const texte = k === 0 ? `à ${libelle(o)}` : k === 1 ? `demain à ${libelle(o)}` : `${JOURS_LONGS[jour]} à ${libelle(o)}`;
      return { quand: new Date(quand), texte };
    }
  }
  return null;
}

/** Les plages d'un jour en clair : « 9h-18h », « 8h-12h et 14h-18h », « fermé ». */
export function plagesDuJour(s: Semaine, jour: number): string {
  return s[jour].length ? s[jour].map(([o, f]) => `${libelle(o)}-${libelle(f)}`).join(" et ") : "fermé";
}

/**
 * La semaine résumée, jours identiques regroupés : « Lun-Ven 9h-18h · Sam
 * 10h-17h · Dim fermé ». C'est ce qu'on montre au commerçant pour qu'il
 * vérifie ce que Camille a compris.
 */
export function resumeSemaine(s: Semaine): string {
  if (s.every((p) => p.length === 1 && p[0][0] === 0 && p[0][1] === 24)) return "Ouvert 24h/24, 7j/7";
  const ordre = [1, 2, 3, 4, 5, 6, 0];
  const groupes: { de: number; a: number; txt: string }[] = [];
  for (const j of ordre) {
    const txt = plagesDuJour(s, j);
    const g = groupes[groupes.length - 1];
    if (g && g.txt === txt) g.a = j;
    else groupes.push({ de: j, a: j, txt });
  }
  if (groupes.length === 1) return `Tous les jours ${groupes[0].txt}`;
  return groupes.map((g) => `${JOURS_COURTS[g.de]}${g.de !== g.a ? `-${JOURS_COURTS[g.a]}` : ""} ${g.txt}`).join(" · ");
}

/**
 * Où en est le commerce maintenant, en une ligne pour le modèle :
 * « Nous sommes mardi, il est 21h40. Le commerce est fermé ; il rouvre demain à 8h. »
 * Chaîne vide quand les horaires ne se lisent pas : on ne fait pas semblant.
 */
export function etatMaintenant(hours?: string | null, offset = 1, maintenant: Date = new Date()): string {
  const s = lireSemaine(hours);
  if (!s) return "";
  const { jour, heure } = momentLocal(maintenant, offset);
  const il = `Nous sommes ${JOURS_LONGS[jour]}, il est ${libelle(Math.floor(heure * 60) / 60)}.`;
  if (ouvertA(s, maintenant, offset)) return `${il} Le commerce est OUVERT (aujourd'hui : ${plagesDuJour(s, jour)}).`;
  const p = prochaineOuverture(s, maintenant, offset);
  return `${il} Le commerce est FERMÉ${p ? ` ; il rouvre ${p.texte}` : ""}.`;
}

/**
 * La phrase à ajouter à l'accusé de commande quand le commerce est fermé.
 *
 * Chaîne vide dans tous les cas où l'on ne sait pas : horaires absents,
 * illisibles, ou commerce ouvert. Le silence est la bonne réponse — c'est
 * mieux qu'une promesse inventée.
 *
 * `maintenant` est injectable pour que le test ne dépende pas de l'horloge.
 */
export function closedNotice(
  hours?: string | null,
  offset = 1,
  maintenant: Date = new Date()
): string {
  const s = lireSemaine(hours);
  if (!s || ouvertA(s, maintenant, offset)) return "";
  const p = prochaineOuverture(s, maintenant, offset);
  if (!p) return "";
  return `\n\n😴 On est fermé pour le moment. Ta commande est bien enregistrée et sera prise en charge dès l'ouverture, ${p.texte}.`;
}

/**
 * Les horaires qu'on propose en un clic au commerçant. Le texte est celui
 * qu'il aurait pu écrire : il reste modifiable à la main.
 */
export const HORAIRES_RAPIDES: { nom: string; texte: string }[] = [
  { nom: "Boutique", texte: "Lun-Sam 8h-19h, Dim fermé" },
  { nom: "Bureau", texte: "Lun-Ven 8h-17h, Sam 9h-13h, Dim fermé" },
  { nom: "7j/7 journée", texte: "Tous les jours 8h-20h" },
  { nom: "Restaurant", texte: "Tous les jours 11h-23h" },
  { nom: "Midi et soir", texte: "Tous les jours 11h-15h et 18h-23h" },
  { nom: "Snack de nuit", texte: "Tous les jours 18h-03h" },
  { nom: "24h/24", texte: "24h/24, 7j/7" },
];
