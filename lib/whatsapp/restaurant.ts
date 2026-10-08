// ─────────────────────────────────────────────────────────────────────────────
// Ce qui fait d'un restaurant autre chose qu'une boutique.
//
//   • Les OPTIONS d'un plat : accompagnement, sauce, piment, cuisson. Le panier
//     natif de WhatsApp ne les connaît pas — on les demande une fois le panier
//     reçu, une liste par groupe, et le supplément s'ajoute au prix de la ligne.
//   • L'HEURE : « pour 13 h », « ce soir à 20 h ». Des créneaux tirés des
//     horaires d'ouverture, et la lecture d'une heure écrite en toutes lettres.
//   • LA FERMETURE : un client qui commande à 23 h n'est pas éconduit, on lui
//     propose de programmer pour l'ouverture.
//
// Aucune dépendance réseau ni base : tout ici est éprouvé par les tests.
// ─────────────────────────────────────────────────────────────────────────────
import { lireHoraires, estOuvert } from "../horaires";

// ── Les options d'un plat ───────────────────────────────────────────────────

export type ChoixOption = { label: string; price: number };
export type GroupeOptions = { name: string; required: boolean; choices: ChoixOption[] };

/** WhatsApp : 10 lignes au plus dans une liste ; « Sans » en prend une. */
const MAX_CHOIX = 10;
const MAX_GROUPES = 5;

/**
 * Les options telles que le commerçant les a saisies, rendues sûres.
 * Accepte des choix écrits « Plantain », « Frites:500 » ou { label, price }.
 * Un groupe sans choix disparaît ; un doublon de choix aussi.
 */
export function normaliserOptions(brut: unknown): GroupeOptions[] {
  const groupes = Array.isArray(brut) ? brut : [];
  const sortie: GroupeOptions[] = [];
  for (const g of groupes) {
    if (!g || typeof g !== "object") continue;
    const o = g as Record<string, unknown>;
    const name = String(o.name || "").trim().slice(0, 40);
    if (!name) continue;
    const vus = new Set<string>();
    const choices: ChoixOption[] = [];
    for (const c of Array.isArray(o.choices) ? o.choices : []) {
      let label = "";
      let price = 0;
      if (typeof c === "string") {
        const [l, p] = c.split(":");
        label = String(l || "").trim();
        price = Number(String(p || "0").replace(/[^0-9.]/g, "")) || 0;
      } else if (c && typeof c === "object") {
        label = String((c as Record<string, unknown>).label || "").trim();
        price = Number((c as Record<string, unknown>).price) || 0;
      }
      label = label.slice(0, 60);
      const cle = label.toLowerCase();
      if (!label || vus.has(cle)) continue;
      vus.add(cle);
      choices.push({ label, price: Math.max(0, Math.round(price)) });
    }
    const required = o.required !== false;
    const max = required ? MAX_CHOIX : MAX_CHOIX - 1;
    if (choices.length) sortie.push({ name, required, choices: choices.slice(0, max) });
    if (sortie.length >= MAX_GROUPES) break;
  }
  return sortie;
}

/** Les questions à poser, dans l'ordre du panier : une par groupe d'options. */
export function questionsPour(lignes: { groupes?: GroupeOptions[] | null }[]): { ligne: number; groupe: number }[] {
  return lignes.flatMap((l, i) => (l.groupes || []).map((_, g) => ({ ligne: i, groupe: g })));
}

type LigneAvecOptions = {
  name: string; variant?: string; qty: number; price: number; currency?: string;
  groupes?: GroupeOptions[] | null; choix?: string[];
};

/**
 * La ligne après le choix du client. `choix` = index du choix, ou -1 pour
 * « Sans » (groupe facultatif seulement). Le supplément s'ajoute au prix
 * UNITAIRE : deux poulets frites, ce sont deux suppléments frites.
 */
export function appliquerChoix<T extends LigneAvecOptions>(l: T, groupe: number, choix: number): T {
  const g = (l.groupes || [])[groupe];
  if (!g) return l;
  // « Sans » n'est permis que sur un groupe facultatif, et il s'écrit : « sans
  // piment » sur le bon, c'est une consigne pour la cuisine.
  if (choix < 0) {
    if (g.required) return l;
    const sans = `Sans ${g.name.toLowerCase()}`;
    return { ...l, choix: [...(l.choix || []), sans], variant: [l.variant, sans].filter(Boolean).join(", ") };
  }
  const c = g.choices[choix];
  if (!c) return l;
  const choisis = [...(l.choix || []), c.label];
  return {
    ...l,
    price: (Number(l.price) || 0) + c.price,
    choix: choisis,
    variant: [l.variant, c.label].filter(Boolean).join(", "),
  };
}

/** Les lignes de la liste WhatsApp pour un groupe. */
export function lignesListe(g: GroupeOptions, cur = "XAF"): { id: string; title: string; description?: string }[] {
  const rows = g.choices.map((c, j) => ({
    id: `opt:${j}`,
    title: c.label.slice(0, 24),
    ...(c.price > 0 ? { description: `+ ${montant(c.price, cur)}` } : {}),
  }));
  if (!g.required) rows.push({ id: "opt:-1", title: "Sans" });
  return rows;
}

/** Un choix écrit au lieu d'être touché : « plantain », « sans », « 2 ». */
export function lireChoixTexte(g: GroupeOptions, texte: string): number | null {
  const t = simple(texte);
  if (!t) return null;
  if (!g.required && /^(sans|aucun|rien|non|pas besoin)\b/.test(t)) return -1;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= g.choices.length) return n - 1;
  const exact = g.choices.findIndex((c) => simple(c.label) === t);
  if (exact >= 0) return exact;
  const dedans = g.choices.findIndex((c) => t.includes(simple(c.label)) || simple(c.label).includes(t));
  return dedans >= 0 && t.length >= 3 ? dedans : null;
}

// ── L'heure ─────────────────────────────────────────────────────────────────

/** Une date vue à l'heure locale (décalage UTC en heures, Douala = 1). */
function local(d: Date, offset: number) {
  const x = new Date(d.getTime() + offset * 3600_000);
  return { jour: x.toISOString().slice(0, 10), heure: x.getUTCHours() + x.getUTCMinutes() / 60, h: x.getUTCHours(), m: x.getUTCMinutes() };
}

/** « Aujourd'hui 13:00 », « Demain 12:30 », sinon « sam. 14/10 12:30 ». */
export function libelleCreneau(d: Date, maintenant: Date = new Date(), offset = 1): string {
  const l = local(d, offset);
  const auj = local(maintenant, offset).jour;
  const dem = local(new Date(maintenant.getTime() + 86400_000), offset).jour;
  const hh = `${String(l.h).padStart(2, "0")}:${String(l.m).padStart(2, "0")}`;
  if (l.jour === auj) return `Aujourd'hui ${hh}`;
  if (l.jour === dem) return `Demain ${hh}`;
  const [, mo, j] = l.jour.split("-");
  return `${j}/${mo} ${hh}`;
}

/**
 * Les prochains créneaux de commande : tous les `pas` minutes, au moins
 * `delai` minutes après maintenant, pendant les heures d'ouverture.
 * Horaires inconnus → créneaux de 8 h à 22 h, plutôt que rien.
 */
export function creneaux(
  hours: string | null | undefined,
  maintenant: Date = new Date(),
  offset = 1,
  n = 9,
  pas = 30,
  delai = 30
): Date[] {
  const h = lireHoraires(hours) || { ouvre: 8, ferme: 22 };
  const sortie: Date[] = [];
  const debut = maintenant.getTime() + delai * 60_000;
  // Arrondi au pas suivant, en minutes locales.
  let t = Math.ceil(debut / (pas * 60_000)) * pas * 60_000;
  const fin = maintenant.getTime() + 48 * 3600_000;
  while (sortie.length < n && t <= fin) {
    const d = new Date(t);
    if (estOuvert(h.ouvre, h.ferme, local(d, offset).heure)) sortie.push(d);
    t += pas * 60_000;
  }
  return sortie;
}

/** Ouvert en ce moment ? `null` si les horaires ne se lisent pas. */
export function ouvertMaintenant(hours: string | null | undefined, maintenant: Date = new Date(), offset = 1): boolean | null {
  const h = lireHoraires(hours);
  if (!h) return null;
  return estOuvert(h.ouvre, h.ferme, local(maintenant, offset).heure);
}

/**
 * L'heure demandée en toutes lettres : « pour 13h », « à 20h30 », « midi »,
 * « demain 12h », « ce soir 8h ». Aujourd'hui si c'est encore à venir (avec
 * 20 min de marge), sinon demain. `hors` quand c'est en dehors des horaires.
 */
export function lireHeureDemandee(
  texte: string,
  hours: string | null | undefined,
  maintenant: Date = new Date(),
  offset = 1
): { quand: Date; hors: boolean } | null {
  const t = simple(texte);
  let h: number | null = null;
  let m = 0;
  const hm = t.match(/\b(\d{1,2})\s*(?:h|:|heures?)\s*(\d{2})?\b/);
  if (hm) {
    h = Number(hm[1]);
    m = Number(hm[2] || 0);
  } else if (/\bmidi\b/.test(t)) {
    h = 12;
  } else if (/\bminuit\b/.test(t)) {
    h = 0;
  }
  if (h == null || h > 23 || m > 59) return null;
  if (h < 12 && /\b(soir|apres midi|aprem)\b/.test(t)) h += 12;

  const l = local(maintenant, offset);
  // Minuit local d'aujourd'hui, en UTC.
  const minuitLocal = Date.parse(`${l.jour}T00:00:00Z`) - offset * 3600_000;
  let quand = minuitLocal + (h * 60 + m) * 60_000;
  if (/\bdemain\b/.test(t) || quand < maintenant.getTime() + 20 * 60_000) quand += 86400_000;

  const ho = lireHoraires(hours);
  const hors = ho ? !estOuvert(ho.ouvre, ho.ferme, h + m / 60) : false;
  return { quand: new Date(quand), hors };
}

// ── Utilitaires ─────────────────────────────────────────────────────────────

function simple(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9: ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function montant(n: number, cur = "XAF"): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${cur === "XAF" ? "FCFA" : cur}`;
}
