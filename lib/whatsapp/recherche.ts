// ─────────────────────────────────────────────────────────────────────────────
// Trouver le bon produit, et choisir comment le montrer.
//
// Ce module est VOLONTAIREMENT sans aucun import : ni base de données, ni API
// Meta, ni Next. C'est ce qui le rend éprouvable tel quel, sans démarrer
// l'application.
//
// Ce n'est pas de la coquetterie. La logique vivait dans `boutique.ts`, qui
// importe la base et l'API Meta — donc impossible à exécuter dans un test, donc
// testée par une imitation écrite à la main. Cette imitation a fini par
// diverger du vrai code : elle incluait un champ d'erreur que le code ne
// gardait pas, elle passait pendant que la production échouait. Un banc d'essai
// qui ne fait pas tourner le code qu'il prétend éprouver est pire que pas de
// banc d'essai.
// ─────────────────────────────────────────────────────────────────────────────

/** Ce dont la recherche a besoin — rien de plus. */
export type ProduitCherchable = {
  name: string;
  category?: string | null;
  /** Les options de variation (« Noir », « Bleu », « 42 »…) : on les cherche aussi. */
  options?: string[] | null;
};

export function sansAccent(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ponts français ↔ anglais pour les mots du commerce.
 *
 * Problème structurel, pas anecdotique : les commerçants d'Afrique francophone
 * vendent des produits importés dont le nom est en anglais — « Oraimo Watch »,
 * « FreePods » — à une clientèle qui écrit « montre » et « écouteurs ». Sans ce
 * pont, « t'as une montre ? » ne trouve rien dans un catalogue de quatre
 * montres. C'est arrivé en production.
 *
 * Volontairement court : seulement les familles réellement courantes ici. Ce
 * n'est pas un dictionnaire, c'est un cache-misère assumé en attendant que la
 * couche de compréhension fasse ce travail.
 */
export const PONTS: Record<string, string[]> = {
  montre: ["watch", "smartwatch"],
  montres: ["watch", "smartwatch"],
  ecouteur: ["earbud", "earphone", "headphone", "freepods", "airpods", "buds"],
  ecouteurs: ["earbud", "earphone", "headphone", "freepods", "airpods", "buds"],
  casque: ["headphone", "headset"],
  telephone: ["phone", "smartphone"],
  portable: ["phone", "smartphone", "laptop"],
  ordinateur: ["laptop", "computer", "pc"],
  enceinte: ["speaker", "soundbox"],
  chargeur: ["charger", "powerbank"],
  batterie: ["powerbank", "battery"],
  sac: ["bag", "backpack"],
  chaussure: ["shoe", "sneaker"],
  chaussures: ["shoe", "sneaker"],
  tasse: ["cup", "mug"],
  tasses: ["cup", "mug"],
  gobelet: ["cup", "tumbler"],
  bouteille: ["bottle", "flask"],
  gourde: ["bottle", "flask"],
  micro: ["microphone", "mic"],
  microphone: ["mic"],
  lunettes: ["glasses", "sunglasses"],
  // Les couleurs : les options sont souvent en français (« Noir ») et les
  // noms en anglais (« Black Edition ») — ou l'inverse. Le client, lui, écrit
  // dans la langue qui lui vient.
  noir: ["black"], noire: ["black", "noir"], noirs: ["black", "noir"],
  blanc: ["white"], blanche: ["white", "blanc"],
  rouge: ["red"], bleu: ["blue"], bleue: ["blue", "bleu"],
  vert: ["green"], verte: ["green", "vert"],
  jaune: ["yellow"], rose: ["pink"], violet: ["purple"], violette: ["purple", "violet"],
  gris: ["grey", "gray"], grise: ["grey", "gray", "gris"],
  marron: ["brown"], beige: ["beige"], orange: ["orange"],
  dore: ["gold", "golden"], doree: ["gold", "golden", "dore"],
  argent: ["silver"], argente: ["silver", "argent"],
};

/**
 * Le pont dans l'AUTRE sens : un client qui écrit « black » doit trouver une
 * option « Noir ». Construit une fois à partir de PONTS, pour qu'une
 * correspondance ajoutée là-haut serve dans les deux langues.
 */
const PONTS_INVERSES: Record<string, string[]> = (() => {
  const inv: Record<string, Set<string>> = {};
  for (const [fr, ens] of Object.entries(PONTS)) {
    for (const en of ens) (inv[en] ||= new Set()).add(fr);
  }
  return Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, [...v]]));
})();

/**
 * « montre-moi » (le verbe) ou « une montre » (l'objet) ?
 *
 * En français les deux s'écrivent pareil. Le détecteur de « montre-moi la
 * boutique » contenait `montre` nu : toute demande de montre était donc lue
 * comme une demande de catalogue. Pour une boutique qui VEND des montres,
 * chaque client recevait tout sauf ce qu'il demandait.
 *
 * On exige la forme verbale — « montre » suivi d'un complément de présentation
 * — et on la refuse derrière un déterminatif.
 */
export function veutToutVoir(message: string, resto = false): boolean {
  const t = sansAccent(message);
  if (resto) {
    return (
      /\bmenu\b|la carte|vos plats|vos menus/.test(t) ||
      (OFFRE_RESTO.test(t) && DEMANDE.test(t)) ||
      FORT.test(t)
    );
  }
  const verbeMontrer =
    /\bmontre[rz]?\s+(moi|nous|me|le|la|les|lui|ton|votre|vos|tes)\b/.test(t) &&
    !/\b(une|des|ma|ta|sa|cette|quelle|quelques?|deux|trois)\s+montre/.test(t);

  return verbeMontrer || FORT.test(t) || (OFFRE.test(t) && DEMANDE.test(t));
}

/**
 * Les formulations qui ne laissent aucun doute, même seules.
 *
 * `boutique` et `catalogue` sont ici, pas dans OFFRE : « c'est quoi votre
 * boutique » et « boutique » tout court méritent la même réponse.
 */
const FORT =
  /catalogue|boutique|vitrine|voir tout|tout voir|tout ce que vous|(liste|gamme) (des?|de vos) (produits|articles)|vos? prix|les prix/;

/**
 * L'offre nommée de façon GÉNÉRIQUE — « produit », « article », « vendre » —
 * par opposition à un produit précis comme « montre » ou « freepods ».
 *
 * C'est la distinction qui décide entre ouvrir la vitrine et chercher. Un
 * client qui dit « produit » ne désigne rien en particulier : il veut voir.
 */
const OFFRE =
  /\b(produits?|articles?|vendez|vends?|vente|stock|dispo|disponibles?|propose[rz]?|proposez)\b|\ba vendre\b|\ben vente\b/;

const OFFRE_RESTO = /\b(plats?|menus?|carte|manger|mangez|cuisine|servez|propose[rz]?|proposez|dispo)\b/;

/**
 * La tournure qui accompagne l'offre : une question, ou un souhait.
 *
 * `quest` sans apostrophe est volontaire : c'est ce qu'écrivent les clients, et
 * `sansAccent` ne peut pas deviner l'apostrophe absente. Le message réel qui a
 * révélé ce défaut était « quest ce que vous avec comme produit a vendre » —
 * « avec » pour « avez », sans apostrophe. La demande la plus explicite qu'un
 * client puisse faire, et il recevait « je n'ai pas trouvé ».
 */
const DEMANDE =
  /\b(quest|qu est|cest|c est|quoi|que|qu|quels?|quelles?|avez|avec|aves|as|avoir|voir|veux|cherche|vos|votre|tes|ton|y a|il y a|comme)\b/;

/**
 * Les produits dont le nom recoupe la demande.
 *
 * Comparaison par MOT ENTIER, en tolérant le préfixe pour les pluriels. La
 * comparaison par sous-chaîne faisait compter « est » à l'intérieur de « Montre
 * Test Buyticle » : ce mot outil marquait alors plus de points que les vrais
 * noms de produits, et « est-ce que t'as une montre » ne renvoyait qu'un
 * article au lieu des quatre montres du catalogue.
 */
export function chercher<T extends ProduitCherchable>(prods: T[], demande: string): T[] {
  // Découpage sur tout ce qui n'est pas lettre ou chiffre : « noir? » doit
  // donner « noir ». Couper sur les seuls espaces gardait la ponctuation, et
  // « t'as un article noir? » ne trouvait rien.
  const bruts = sansAccent(demande).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  // Chaque mot amène ses équivalents : « montre » cherche aussi « watch ».
  const mots = [...new Set(bruts.flatMap((w) => [w, ...(PONTS[w] || []), ...(PONTS_INVERSES[w] || [])]))];
  if (!mots.length) return [];

  const notes = prods.map((p) => {
    const jetons = new Set(
      sansAccent(`${p.name} ${p.category || ""} ${(p.options || []).join(" ")}`)
        .split(/[^a-z0-9]+/).filter(Boolean)
    );
    const n = mots.filter(
      (w) => jetons.has(w) || [...jetons].some((j) => j.length > 3 && j.startsWith(w))
    ).length;
    return { p, n };
  });

  const max = Math.max(...notes.map((x) => x.n), 0);
  return max > 0 ? notes.filter((x) => x.n === max).map((x) => x.p) : [];
}

/**
 * Quel format natif pour ce nombre de produits ?
 *
 * Les quatre formats ont été éprouvés en production sur le numéro Buyticle :
 *
 *   1            → `product`         la fiche, photo et prix du catalogue
 *   2 à 10       → `carousel`        les fiches défilent — le plus vendeur
 *   plus de 10   → `product_list`    une liste par catégories
 *   0            → rien à montrer
 *
 * La décision est ici, et non noyée dans une cascade de `if`, parce que c'est
 * la chose la plus visible pour le client.
 */
export function formatPour(n: number): "aucun" | "fiche" | "carrousel" | "liste" {
  if (n <= 0) return "aucun";
  if (n === 1) return "fiche";
  if (n <= 10) return "carrousel";
  return "liste";
}

/**
 * Ce message est-il une QUESTION, et non la recherche d'un article ?
 *
 * Sert uniquement au repli déterministe, quand le modèle n'a pas répondu. Il
 * répondait alors à toute phrase non reconnue par le catalogue : « vous avez un
 * service après-vente ? » recevait le carrousel et « je n'ai pas trouvé
 * exactement ça ». Montrer des montres à qui demande une garantie, c'est
 * avouer qu'on n'a pas lu.
 *
 * Une question sans réponse ne mérite pas des produits : elle mérite d'être
 * transmise à quelqu'un qui sait.
 */
export function estUneQuestion(message: string): boolean {
  const t = sansAccent(message);
  if (!t) return false;
  // Un nom de produit seul n'est pas une question, même suivi d'un « ? ».
  const interro =
    /\b(est ce que|qu est ce|quest ce|c est quoi|cest quoi|pourquoi|comment|quand|combien|est il|y a t il|avez vous|aves vous|peut on|puis je|faut il|y a|possible)\b/.test(t);
  // Les sujets qui ne sont jamais des articles : les politiques du commerce.
  const politique =
    // Pas de limite de mot à la FIN : « ventes », « remises », « retours »
    // sont les formes que les clients écrivent, et le pluriel faisait échouer
    // la détection sur le message réel « service apres ventes ? ».
    /\b(garanti|retour|rembours|echange|facture|apres[ -]?vente|reduction|remise|promo|credit|acompte|paiement|payer|caution|assurance|reclamation)/.test(t) ||
    /\bsav\b/.test(t);
  return politique || (interro && t.split(/\s+/).length >= 3);
}
