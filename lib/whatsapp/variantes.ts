// ─────────────────────────────────────────────────────────────────────────────
// Traduire les variations entre Camille et Meta.
//
// Les deux ne décrivent pas la même chose, et c'est tout le problème.
//
//   CAMILLE déclare des AXES et leurs options :
//       [{ name: "Couleur", options: ["Noir", { value: "Bleu", image: "…" }] }]
//     C'est une liste de choix possibles. Rien ne dit quelles COMBINAISONS
//     existent vraiment, ni le stock de chacune.
//
//   META veut un ARTICLE PAR VARIATION, reliés entre eux par `item_group_id` :
//       retailer_id "abc:noir" · item_group_id "abc" · color "Noir"
//       retailer_id "abc:bleu" · item_group_id "abc" · color "Bleu"
//     Le client voit alors une seule fiche avec un sélecteur de couleur.
//
// CE QUE JE REFUSE DE FAIRE, et c'est la décision importante de ce fichier :
// multiplier les axes entre eux. Un produit « Couleur × Taille » avec 4
// couleurs et 4 tailles donnerait 16 articles — dont le marchand n'a jamais
// dit qu'ils existaient, et dont il n'a sûrement pas le stock. Inventer des
// combinaisons, c'est inventer de la marchandise : le client en commande une
// qui n'existe pas, et c'est le commerçant qui porte le mensonge.
//
// Donc : UN seul axe est éclaté. Au-delà, on envoie le produit parent tel quel
// et on le dit au marchand, en lui expliquant pourquoi.
// ─────────────────────────────────────────────────────────────────────────────

import { PONTS, PONTS_INVERSES, sansAccent } from "./recherche";

export type OptionVariante = string | { value: string; image?: string | null };
export type AxeVariante = { name: string; options: OptionVariante[] };

export const valeurOption = (o: OptionVariante): string =>
  typeof o === "string" ? o : String(o?.value || "");
export const imageOption = (o: OptionVariante): string | null =>
  typeof o === "string" ? null : o?.image || null;

/** Un identifiant de variation lisible et stable : « noir », « 42 », « xl ». */
export function slug(v: string): string {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Le champ Meta qui porte cet axe.
 *
 * Meta n'a que quatre attributs nommés — couleur, taille, motif, matière — et
 * cinq étiquettes libres. Un axe qu'on ne reconnaît pas part en étiquette
 * libre : il reste affiché au client, et le groupement fonctionne quand même.
 */
export function champMeta(nomAxe: string): "color" | "size" | "pattern" | "material" | "custom_label_0" {
  const n = slug(nomAxe);
  if (/couleur|color|coloris|teinte/.test(n)) return "color";
  if (/taille|size|pointure|dimension/.test(n)) return "size";
  if (/motif|pattern|imprime/.test(n)) return "pattern";
  if (/matiere|material|tissu|cuir/.test(n)) return "material";
  return "custom_label_0";
}

/** Le retailer_id d'une variation. Le parent se relit par la partie avant « : ». */
export function idVariante(produitId: string, option: string): string {
  return `${produitId}:${slug(option)}`;
}

/**
 * L'identifiant du produit Camille derrière un retailer_id.
 *
 * Indispensable au décompte du stock : une commande porte le retailer_id de la
 * variation, et c'est le PARENT qui tient le stock. Sans ça, une commande de
 * variation ne décompterait rien — exactement le défaut d'origine, rouvert par
 * une porte différente.
 */
export function produitParent(retailerId: string): string {
  const i = String(retailerId || "").indexOf(":");
  return i === -1 ? String(retailerId || "") : retailerId.slice(0, i);
}

// ── Camille → Meta ──────────────────────────────────────────────────────────

export type ArticleMeta = {
  retailerId: string;
  titre: string;
  itemGroupId?: string;
  champ?: string;
  valeur?: string;
  image?: string | null;
};

/**
 * Les articles Meta à créer pour ce produit.
 *
 * Un seul article quand il n'y a pas de variation, ou quand il y a plusieurs
 * axes — avec, dans ce dernier cas, un avertissement qui dit au marchand quoi
 * faire. Jamais de combinaison inventée.
 */
export function articlesPour(
  produit: { id: string; name: string; image_url?: string | null },
  axes: AxeVariante[] | null | undefined
): { articles: ArticleMeta[]; avertissements: string[] } {
  const propres = (Array.isArray(axes) ? axes : []).filter(
    (a) => a && a.name && Array.isArray(a.options) && a.options.filter((o) => valeurOption(o)).length > 1
  );

  const seul: ArticleMeta[] = [
    { retailerId: produit.id, titre: produit.name, image: produit.image_url || null },
  ];

  if (!propres.length) return { articles: seul, avertissements: [] };

  if (propres.length > 1) {
    return {
      articles: seul,
      avertissements: [
        `${produit.name} : ${propres.length} axes de variation (${propres
          .map((a) => a.name)
          .join(", ")}). Un seul article est envoyé, sans variations. ` +
          `Multiplier les axes créerait des combinaisons que vous n'avez jamais déclarées et dont vous n'avez pas le stock. ` +
          `Pour des variations sur WhatsApp, créez un produit par combinaison réellement en vente.`,
      ],
    };
  }

  const axe = propres[0];
  const champ = champMeta(axe.name);
  const vues = new Set<string>();
  const articles: ArticleMeta[] = [];

  for (const o of axe.options) {
    const v = valeurOption(o);
    const s = slug(v);
    if (!v || !s || vues.has(s)) continue;
    vues.add(s);
    articles.push({
      retailerId: idVariante(produit.id, v),
      titre: `${produit.name} — ${v}`.slice(0, 200),
      itemGroupId: produit.id,
      champ,
      valeur: v.slice(0, 100),
      // L'image propre à l'option quand elle existe : c'est tout l'intérêt
      // d'un sélecteur de couleur, voir la couleur.
      image: imageOption(o) || produit.image_url || null,
    });
  }

  return articles.length > 1
    ? { articles, avertissements: [] }
    : { articles: seul, avertissements: [] };
}

// ── Meta → Camille ──────────────────────────────────────────────────────────

export type ItemMeta = {
  retailer_id: string;
  name?: string;
  item_group_id?: string | null;
  color?: string | null;
  size?: string | null;
  pattern?: string | null;
  material?: string | null;
  custom_label_0?: string | null;
};

export type Groupe = {
  /** L'article qui servira de produit Camille. */
  principal: ItemMeta;
  /** Les retailer_id de toutes les variations, principal inclus. */
  membres: string[];
  /** Les axes reconstruits, au format Camille. */
  axes: AxeVariante[];
};

const CHAMPS: [keyof ItemMeta, string][] = [
  ["color", "Couleur"],
  ["size", "Taille"],
  ["pattern", "Motif"],
  ["material", "Matière"],
  ["custom_label_0", "Variante"],
];

/**
 * Regrouper les articles Meta qui sont des variations d'un même produit.
 *
 * Sans ce regroupement, importer un produit décliné en quatre couleurs
 * créerait QUATRE produits Camille — le catalogue du marchand doublerait de
 * taille à chaque synchronisation, et il ne saurait plus lequel modifier.
 *
 * Le nom du produit perd le suffixe de variation quand tous les articles le
 * portent : « Watch 6 — Noir » et « Watch 6 — Bleu » donnent « Watch 6 ».
 */
export function grouperVariantes(items: ItemMeta[]): Groupe[] {
  const groupes = new Map<string, ItemMeta[]>();
  for (const it of items) {
    if (!it?.retailer_id) continue;
    // Pas de groupe déclaré : l'article est seul, et sa clé est unique.
    const k = it.item_group_id ? `g:${it.item_group_id}` : `s:${it.retailer_id}`;
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k)!.push(it);
  }

  const sortie: Groupe[] = [];
  for (const membres of groupes.values()) {
    const principal = membres[0];
    const axes: AxeVariante[] = [];

    if (membres.length > 1) {
      for (const [champ, nom] of CHAMPS) {
        const valeurs: string[] = [];
        for (const m of membres) {
          const v = String(m[champ] || "").trim();
          if (v && !valeurs.includes(v)) valeurs.push(v);
        }
        if (valeurs.length > 1) axes.push({ name: nom, options: valeurs });
      }
    }

    sortie.push({
      principal: { ...principal, name: nomCommun(membres) || principal.name },
      membres: membres.map((m) => m.retailer_id),
      axes,
    });
  }
  return sortie;
}

/** Le nom débarrassé du suffixe de variation, quand il y en a un. */
function nomCommun(membres: ItemMeta[]): string {
  const noms = membres.map((m) => String(m.name || "").trim()).filter(Boolean);
  if (noms.length < 2) return noms[0] || "";
  // On coupe au premier séparateur de variation présent dans TOUS les noms.
  for (const sep of [" — ", " - ", " / ", " | "]) {
    if (noms.every((n) => n.includes(sep))) {
      const tetes = noms.map((n) => n.slice(0, n.lastIndexOf(sep)).trim());
      if (new Set(tetes).size === 1 && tetes[0]) return tetes[0];
    }
  }
  return noms[0];
}

// ── Ce qui sert à l'envoi, à la commande et au ménage ───────────────────────

/**
 * Le retailer_id à MONTRER pour ce produit.
 *
 * Dès qu'un produit est éclaté en variations, Meta ne connaît plus l'article
 * « parent » : seulement « <id>:noir », « <id>:bleu »… Envoyer l'identifiant
 * du parent donnait « product not found ». On montre donc la première
 * variation — WhatsApp affiche alors la fiche avec son sélecteur de variantes.
 */
export function retailerAffiche(
  produit: { id: string; name: string; image_url?: string | null },
  axes: AxeVariante[] | null | undefined
): string {
  return articlesPour(produit, axes).articles[0]?.retailerId || produit.id;
}

/** Tous les retailer_id que ce produit doit avoir chez Meta. */
export function idsAttendus(
  produit: { id: string; name: string; image_url?: string | null },
  axes: AxeVariante[] | null | undefined
): string[] {
  return articlesPour(produit, axes).articles.map((a) => a.retailerId);
}

/**
 * Le libellé de la variation commandée (« Noir », « 42 »…), ou null.
 *
 * Une ligne de commande « Montre » sans « Noir » oblige le commerçant à
 * rappeler le client pour savoir laquelle préparer.
 */
export function libelleVariante(retailerId: string, axes: AxeVariante[] | null | undefined): string | null {
  const i = String(retailerId || "").indexOf(":");
  if (i === -1) return null;
  const s = retailerId.slice(i + 1);
  for (const axe of Array.isArray(axes) ? axes : []) {
    for (const o of axe?.options || []) {
      const v = valeurOption(o);
      if (v && slug(v) === s) return v;
    }
  }
  return null;
}

// ── La variante que le client demande ──────────────────────────────────────

/** Une variante envoyable : la valeur lisible et l'article Meta qui la porte. */
export type VarianteAffichable = { option: string; retailerId: string };

/**
 * Les variantes que ce texte désigne — « la rouge », « en vert ? »,
 * « do you have it in black » — dans l'ordre du catalogue, ou [] si rien.
 *
 * Sans ça, la fiche envoyée était toujours celle du premier article du groupe :
 * Camille annonçait « oui, il existe en rouge » en montrant la tasse noire.
 *
 * Le français et l'anglais se rejoignent par les ponts de la recherche, et un
 * accord se tolère (« noire », « vertes » désignent « Noir », « Vert »).
 */
export function varianteDemandee(variantes: VarianteAffichable[], texte: string): VarianteAffichable[] {
  if (!variantes.length || !texte) return [];
  const bruts = sansAccent(texte).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  const mots = new Set(bruts.flatMap((w) => [w, ...(PONTS[w] || []), ...(PONTS_INVERSES[w] || [])]));
  const designe = (option: string) =>
    sansAccent(option)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2)
      .some((t) => mots.has(t) || (t.length >= 4 && [...mots].some((m) => m.startsWith(t) && m.length - t.length <= 2)));
  return variantes.filter((v) => designe(v.option));
}

