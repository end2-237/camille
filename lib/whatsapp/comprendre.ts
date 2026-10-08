// ─────────────────────────────────────────────────────────────────────────────
// Comprendre ce que le client veut — et non reconnaître des mots.
//
// L'escalier de regex qu'il y avait avant ne comprend rien : il suit une
// séquence de mots. « quest ce que vous avec comme produit a vendre » passait à
// travers parce qu'il manquait une apostrophe. Pour chaque faute rattrapée, il
// en reste mille — et surtout, il ne sait pas faire DEUX choses à la fois :
// « c'est combien la montre et vous livrez à Bonapriso ? » est une question de
// prix ET une question de livraison, et l'escalier n'en traite qu'une.
//
// Ici, le modèle fait une seule chose : lire la phrase et dire ce que le client
// veut, sous forme d'une LISTE d'actions. Il ne rédige pas la réponse
// commerciale, il ne choisit pas le format d'affichage, il n'invente aucun
// produit — il choisit parmi les identifiants qu'on lui donne.
//
// C'est CVA, inchangé : LE MODÈLE COMPREND, LE CODE VÉRIFIE ET EXÉCUTE.
//   • le modèle ne renvoie que des identifiants du catalogue qu'on lui a fourni,
//     et `valider()` jette ceux qu'il aurait inventés ;
//   • tout nombre d'une phrase libre est confronté aux faits connus par
//     `phraseAncree()` — un prix inventé ne sort jamais ;
//   • une certitude faible ou un modèle indisponible retombe sur l'escalier,
//     qui est dégradé mais ne mentira pas.
//
// Et sans clé configurée, tout continue de fonctionner. Ce n'est pas une
// précaution théorique : le compte Groq est à sec aujourd'hui.
// ─────────────────────────────────────────────────────────────────────────────

import { validerNotes } from "./memoire";

/** Ce que le code sait exécuter. Rien d'autre n'est acceptable en retour. */
export type Action =
  | { faire: "vitrine" }
  | { faire: "montrer"; produits: string[] }
  | { faire: "repondre"; texte: string }
  | { faire: "mode_emploi" }
  | { faire: "infos" }
  | { faire: "humain" }
  | { faire: "alerter"; sujet: string }
  | { faire: "position" }
  | { faire: "retrait" }
  | { faire: "accueil" };

export type Comprehension = {
  actions: Action[];
  /** 0 à 1. Sous le seuil, on préfère l'escalier déterministe. */
  certitude: number;
  /** Pourquoi — enregistré dans conversation_traces, jamais montré au client. */
  raisonnement: string;
  /** Les goûts du client à retenir pour la prochaine fois. Jamais des faits. */
  notes: string[];
  source: "modele" | "repli";
};

/** Le peu qu'il faut savoir d'un produit pour le reconnaître et en parler. */
export type ProduitConnu = {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  category: string | null;
  stock: number | null;
  /** Les variations proposées, lisibles : « Couleur : Noir, Bleu ». */
  options?: string | null;
};

/** Les faits vérifiables du commerce. Rien ici n'est négociable par le modèle. */
export type FaitsCommerce = {
  nom: string;
  adresse?: string | null;
  horaires?: string | null;
  fraisLivraison?: number | null;
  livraison: boolean;
  devise: string;
};

// ── L'ancrage : la règle qui empêche d'inventer ─────────────────────────────

/** Les groupes de chiffres d'un texte, espaces et séparateurs de milliers ôtés. */
export function nombresDe(texte: string): string[] {
  const t = String(texte || "").replace(/(\d)[\s.,](?=\d{3}\b)/g, "$1");
  return (t.match(/\d+/g) || []).map((n) => String(Number(n)));
}

/**
 * Tout nombre de cette phrase est-il ancré dans un fait connu ?
 *
 * C'est la pièce centrale de CVA, et elle était jusqu'ici décrite dans la
 * documentation sans exister en code. Un modèle qui écrit « ça fait 15 000 »
 * alors que le produit est à 12 000 fait perdre de l'argent au commerçant à
 * chaque message ; un modèle qui écrit « livré en 2 jours » prend un engagement
 * que personne n'a autorisé.
 *
 * Les nombres du message du CLIENT comptent comme connus : s'il demande trois
 * montres, la réponse a le droit de dire trois.
 *
 * Volontairement strict. Le coût d'un rejet est une réponse déterministe un peu
 * sèche ; le coût d'un chiffre inventé est un client qui se sent trompé.
 */
export function phraseAncree(texte: string, faitsConnus: string[]): boolean {
  const connus = new Set(faitsConnus.flatMap((f) => nombresDe(f)));
  return nombresDe(texte).every((n) => connus.has(n));
}

/**
 * Cette phrase promet-elle une action que l'agent ne sait pas faire ?
 *
 * Le second garde-fou, et il est né d'un cas observé. Sur « ça fait 3 jours
 * que j'attends ma commande, c'est inadmissible », le modèle a répondu « je
 * vérifie immédiatement et je reviens vers toi ». Tout était ancré, aucun
 * chiffre inventé — et c'était pourtant la pire réponse possible : l'agent ne
 * peut pas consulter une commande, et personne n'avait été alerté. Le client
 * attend un rappel qui ne viendra jamais.
 *
 * L'ancrage protège les CHIFFRES ; celui-ci protège les ENGAGEMENTS. Une
 * promesse n'est tenable que si un outil la réalise — donc, pour tout ce qui
 * relève du suivi, seul le passage à un humain est honnête.
 *
 * Oui, c'est une liste de mots, et c'est précisément ce que je dis vouloir
 * éviter ailleurs. La différence : ce n'est pas le chemin de compréhension,
 * c'est le filet en dessous. Il ne décide de rien, il refuse.
 */
export function promesseNonTenable(texte: string): boolean {
  const t = texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // L'apostrophe devient une espace : « je m'en occupe » et « je m en
    // occupe » sont la même promesse.
    .replace(/['’`´]/g, " ")
    .replace(/\s+/g, " ");
  return (
    /\bje (vais )?(verifi|regard|contact|appel|relanc|transmet|signal|renseign|confirm)/.test(t) ||
    /\bje (te )?(revien|reponds|rappelle|recontacte|tiens au courant|previens)/.test(t) ||
    /\b(on|nous) (te |vous )?(revient|rappelle|recontacte|reviendra|recontactera|contactons|contacte)\b/.test(t) ||
    /\b(on|nous) (va|allons) (te |vous )?(contacter|rappeler|revenir|recontacter)/.test(t) ||
    /\bje m en occupe\b|\bje regarde ca\b|\bje check\b|\bdes que possible\b/.test(t) ||
    // Le délai de livraison, qualifié sans chiffre. Observé en production :
    // « le délai exact dépend de la zone, mais la livraison est généralement
    // rapide ». Aucun chiffre, donc l'ancrage laisse passer — et c'est pourtant
    // un engagement sur un délai que personne ne nous a donné. Un client qui
    // lit « rapide » et reçoit sa commande trois jours plus tard a été trompé.
    /\b(rapide|rapidement|bientot|sous peu|incessamment|express|sans tarder|tres vite|dans la journee|brefs delais|en un rien de temps)\b/.test(t)
  );
}

/** Tout ce qui, dans cette conversation, autorise un nombre dans une réponse. */
export function faitsNumeriques(
  prods: ProduitConnu[], faits: FaitsCommerce, messageClient: string
): string[] {
  return [
    messageClient,
    faits.horaires || "",
    faits.adresse || "",
    faits.fraisLivraison != null ? String(faits.fraisLivraison) : "",
    ...prods.flatMap((p) => [
      p.price != null ? String(p.price) : "",
      p.stock != null ? String(p.stock) : "",
      p.name, // « Oraimo Watch 6 » autorise le 6
    ]),
  ].filter(Boolean);
}

// ── La validation du retour du modèle ──────────────────────────────────────

/**
 * Ne garder que ce qui est exécutable et vrai.
 *
 * Cette fonction est pure, et c'est délibéré : c'est elle qui protège le
 * client, donc c'est elle qu'il faut pouvoir éprouver sans appeler personne.
 */
export function valider(
  brut: unknown,
  prods: ProduitConnu[],
  faits: FaitsCommerce,
  messageClient: string,
  /** Les prix réellement payés par ce client : des faits, donc ils ancrent. */
  ancresEnPlus: string[] = []
): Comprehension | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;

  const connus = new Set(prods.map((p) => p.id));
  const ancres = [...faitsNumeriques(prods, faits, messageClient), ...ancresEnPlus];
  const actions: Action[] = [];
  const rejets: string[] = [];
  let promesse = false;

  for (const a of Array.isArray(o.actions) ? o.actions : []) {
    if (!a || typeof a !== "object") continue;
    const x = a as Record<string, unknown>;
    switch (x.faire) {
      case "vitrine":
      case "mode_emploi":
      case "infos":
      case "humain":
      case "position":
      case "retrait":
      case "accueil":
        actions.push({ faire: x.faire } as Action);
        break;

      case "alerter": {
        const sujet = String(x.sujet || "").trim().slice(0, 200);
        actions.push({ faire: "alerter", sujet: sujet || "Question du client" });
        break;
      }

      case "montrer": {
        // Le modèle choisit PARMI les identifiants fournis. Tout identifiant
        // inconnu est inventé : on le jette, on ne le cherche pas.
        const ids = (Array.isArray(x.produits) ? x.produits : [])
          .map((v) => String(v))
          .filter((v, i, t) => connus.has(v) && t.indexOf(v) === i);
        if (ids.length) actions.push({ faire: "montrer", produits: ids });
        else rejets.push("montrer sans produit connu");
        break;
      }

      case "repondre": {
        const texte = String(x.texte || "").trim();
        if (!texte) break;
        // L'ancrage. Un seul nombre non vérifiable disqualifie la phrase
        // entière : on ne sait pas lequel est faux, donc on ne garde rien.
        if (!phraseAncree(texte, ancres)) {
          rejets.push(`nombre non ancré : « ${texte.slice(0, 80)} »`);
          break;
        }
        // Un engagement de suivi est tenable SI un humain prend réellement le
        // relais. On ne peut pas le savoir ici — `humain` peut arriver après
        // dans la liste — donc on note et on tranche à la fin.
        if (promesseNonTenable(texte)) promesse = true;
        actions.push({ faire: "repondre", texte: texte.slice(0, 900) });
        break;
      }
    }
  }

  if (!actions.length) return null;

  // Une promesse de suivi sans humain au bout est un mensonge. On n'essaie pas
  // de la réécrire : on écarte toute la compréhension, et le repli
  // déterministe envoie la réclamation à un humain — ce qu'il fallait faire.
  if (promesse && !actions.some((a) => a.faire === "humain" || a.faire === "alerter")) return null;

  const c = Number(o.certitude);
  return {
    actions,
    certitude: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5,
    raisonnement:
      String(o.raisonnement || "").slice(0, 500) +
      (rejets.length ? ` | rejeté: ${rejets.join(" ; ")}` : ""),
    notes: validerNotes(o.memoire),
    source: "modele",
  };
}

// ── Le cache de réponses ───────────────────────────────────────────────────
//
// Le cache de Groq porte sur le PRÉFIXE : il économise du TEMPS, pas du quota.
// Mesuré — `prompt_tokens` reste identique, seul `prompt_time` s'effondre. La
// limite de 8000 jetons par minute compte donc le prompt entier à chaque fois,
// soit une cinquième de minute par message sur un catalogue de vingt articles.
//
// Pour économiser le QUOTA, il n'y a qu'un moyen : ne pas appeler. « Bonjour »,
// « vous avez quoi ? », « c'est combien la montre » sont écrits par des
// dizaines de clients, mot pour mot. La même entrée donne la même sortie
// (température 0), alors on la garde.
//
// Deux règles de prudence :
//   • la clé contient TOUT ce qui entre — catalogue, faits, mémoire, historique.
//     Deux clients avec une mémoire différente n'ont jamais la même clé, donc
//     personne ne reçoit la réponse destinée à un autre.
//   • un échec n'est JAMAIS mis en cache. Une saturation passagère deviendrait
//     sinon une panne de dix minutes.

type Entree = { valeur: Comprehension; expire: number };
const CACHE = new Map<string, Entree>();
const CACHE_TTL = Number(process.env.IA_CACHE_TTL_S || 600) * 1000;
const CACHE_MAX = 300;
let touches = 0;
let manques = 0;

/** FNV-1a, sur 32 bits. Pas d'import : ce fichier doit rester éprouvable seul. */
export function empreinte(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** La clé : tout ce qui change la réponse, et rien d'autre. */
export function cleCache(parties: {
  modeles: string[]; message: string; resto: boolean;
  prods: ProduitConnu[]; faits: FaitsCommerce;
  memoire: string; historique: { role: string; content: string }[];
}): string {
  const cat = parties.prods.map((p) => `${p.id}:${p.price}:${p.stock}`).join("|");
  const f = `${parties.faits.nom}|${parties.faits.adresse}|${parties.faits.horaires}|${parties.faits.fraisLivraison}|${parties.faits.livraison}`;
  const h = parties.historique.map((x) => `${x.role}:${x.content}`).join("|");
  const msg = parties.message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  return [
    parties.modeles.join(","), parties.resto ? "r" : "b", msg,
    empreinte(cat), empreinte(f), empreinte(parties.memoire), empreinte(h),
  ].join("~");
}

function lireCache(cle: string): Comprehension | null {
  const e = CACHE.get(cle);
  if (!e) { manques++; return null; }
  if (e.expire < Date.now()) { CACHE.delete(cle); manques++; return null; }
  // Remise en tête : une entrée utilisée ne doit pas être la première évincée.
  CACHE.delete(cle);
  CACHE.set(cle, e);
  touches++;
  return e.valeur;
}

function ecrireCache(cle: string, v: Comprehension) {
  if (CACHE.size >= CACHE_MAX) {
    const plusVieille = CACHE.keys().next().value;
    if (plusVieille) CACHE.delete(plusVieille);
  }
  CACHE.set(cle, { valeur: v, expire: Date.now() + CACHE_TTL });
}

/** Pour le diagnostic, et pour les tests. */
export function statsCache() {
  return { entrees: CACHE.size, touches, manques, ttl_s: CACHE_TTL / 1000 };
}
export function vidangerCache() {
  CACHE.clear();
  touches = 0;
  manques = 0;
}

// ── L'appel au modèle ──────────────────────────────────────────────────────

const BASE = (process.env.IA_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const CLE = process.env.IA_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";

/**
 * Les modèles, du meilleur au plus modeste.
 *
 * Chez Groq la limite de jetons par minute est comptée PAR MODÈLE : 8000 sur
 * l'offre gratuite, soit une douzaine de messages par minute. Basculer sur le
 * modèle suivant à la première saturation triple donc la capacité, sans un
 * centime — et c'est le genre de minute qui compte, puisque c'est précisément
 * quand ça afflue que ça sature.
 *
 * Le repli déterministe reste derrière, si les trois saturent ensemble.
 */
const MODELES = (process.env.IA_MODEL || "openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export function comprehensionDisponible(): boolean {
  return Boolean(CLE);
}

/**
 * Le message système — IDENTIQUE pour tous les clients du même commerce.
 *
 * C'est délibéré, et c'est ce qui fait tenir le cache de Groq : son cache
 * porte sur le PRÉFIXE de la requête. Tant que ce bloc ne bouge pas, il est
 * resservi — mesuré : 1792 jetons sur 1884 en cache, et le temps de traitement
 * du prompt passe de 116 ms à 11 ms.
 *
 * Donc rien de propre à un client ici. La mémoire, l'historique et le message
 * partent APRÈS, en tours utilisateur : ils changent à chaque appel, et les
 * mettre ici casserait le préfixe pour tout le monde.
 */
function consigne(prods: ProduitConnu[], faits: FaitsCommerce, resto: boolean): string {
  const liste = prods
    .slice(0, 60)
    .map(
      (p) =>
        `- ${p.id} | ${p.name}${p.category ? ` | ${p.category}` : ""}${
          p.price != null ? ` | ${p.price} ${p.currency}` : ""
        }${p.options ? ` | existe en ${p.options}` : ""}`
    )
    .join("\n");

  return `Tu es le vendeur de ${faits.nom}${resto ? " (restaurant)" : " (boutique)"} sur WhatsApp.

Tu as une boîte à outils. Chaque outil PRODUIT quelque chose chez le client — à toi de choisir le ou les bons, comme un technicien choisit sa clé.

{"faire":"montrer","produits":["id","id"]} → envoie la VRAIE fiche WhatsApp : photo, prix, et le bouton « Ajouter au panier ». C'est le SEUL outil avec lequel le client peut acheter. Dès qu'il parle d'un article qu'on a, utilise-le : décrire un produit par du texte au lieu d'envoyer sa fiche, c'est lui retirer le bouton d'achat.
{"faire":"vitrine"} → la même chose pour tout le catalogue. Quand il n'a rien visé de précis.
{"faire":"repondre","texte":"..."} → un simple message. Pour ce qui n'est PAS un produit : livraison, horaires, une confirmation. Une ou deux phrases, tutoiement.
{"faire":"infos"} → envoie l'adresse et notre position sur la carte.
{"faire":"position"} → affiche le bouton natif « Envoyer ma position ». Pour obtenir ou corriger une adresse de livraison.
{"faire":"retrait"} → il vient chercher sur place.
{"faire":"mode_emploi"} → la vidéo qui montre comment commander.
{"faire":"humain"} → passe la main à l'équipe, et tu te tais COMPLÈTEMENT après : ce client ne reçoit plus aucune réponse de toi, même s'il demande autre chose. N'utilise cet outil que si le client a vraiment besoin d'une personne.
{"faire":"alerter","sujet":"..."} → prévient le commerçant, et TU CONTINUES à parler. C'est l'outil des engagements : tu promets que l'équipe confirmera quelque chose, et quelqu'un est réellement averti. Préfère-le à humain partout où tu peux encore être utile.
{"faire":"accueil"} → une salutation, rien de plus à faire.

COMBINER est normal, et souvent meilleur : un prix se répond ET se montre (repondre + montrer), « des écouteurs, et vous livrez ? » c'est montrer + repondre. Mets les outils dans l'ordre utile.

LANGUE ET VARIATIONS
• Le client écrit en français ou en anglais, et les noms du catalogue sont souvent en anglais : rapproche par le SENS (tasse = cup/mug, montre = watch, écouteurs = earbuds/headphones, micro = microphone, noir = black, rouge = red…). Ne réponds jamais « on n'a pas ça » parce que les mots diffèrent.
• « existe en … » liste les couleurs, tailles ou versions d'un article. Le client demande une couleur ou une taille qui y figure → montre CET article : sa fiche WhatsApp porte le choix de la variante. Une couleur absente de toutes les listes → dis-le avec repondre, puis montre ce qui s'en rapproche.
• Réponds dans la langue du client.

INTERDITS
• Un identifiant hors catalogue. Ce qu'il cherche n'y est pas → dis-le avec repondre, puis vitrine.
• Un chiffre absent des faits : prix, stock, frais. Et JAMAIS de délai de livraison — personne ne te l'a autorisé.
• NE PROMETS JAMAIS une action que tes outils ne font pas. Tu ne peux pas consulter une commande, relancer un livreur, rappeler quelqu'un, ni « revenir vers lui ».
• LE DÉLAI DE LIVRAISON n'est pas un fait que tu possèdes. Pas de « rapide », pas de « bientôt », pas de « ça dépend de la zone » — c'est encore une estimation. On te demande un délai → donne les frais avec repondre, dis que l'équipe confirme le délai, et ajoute {"faire":"alerter","sujet":"délai de livraison"} — PAS humain : le client a encore des articles à voir, tu dois rester disponible.
• LA ZONE DE LIVRAISON n'est pas un fait que tu possèdes. Tu sais seulement d'OÙ part la marchandise. Un client qui demande si on livre chez lui, et surtout hors de cette ville ou hors du pays, ne reçoit PAS un oui : tu dis d'où on livre, et tu ajoutes {"faire":"alerter","sujet":"livraison vers <l'endroit qu'il a nommé>"}. Lui envoyer l'adresse de la boutique ne répond pas à sa question.
• LES POLITIQUES DU COMMERCE ne t'appartiennent pas et ne figurent pas dans les faits : garantie, retour, échange, remboursement, service après-vente, facture, paiement à la livraison. Tu ne réponds NI oui NI non — tu ne sais pas. Dis que tu transmets la question, et ajoute {"faire":"alerter","sujet":"<la question>"}. Inventer un « oui, nous avons un service après-vente » engage le commerçant sur ce qu'il n'a peut-être pas.
• NE PARLE JAMAIS DE « TA COMMANDE » si le client n'en a pas mentionné une : tu ne sais pas s'il a commandé. Dire « l'équipe va préparer ta commande » à quelqu'un qui n'a rien commandé le fait douter de tout le reste.
• UNE RÉDUCTION, UN PRIX NÉGOCIÉ, UN GESTE COMMERCIAL ne t'appartiennent pas : c'est le commerçant qui décide. Tu ne promets rien, tu n'inventes aucun pourcentage, et tu ne confonds pas « comment avoir une réduction » avec « comment commander ». Réponds que tu transmets, et ajoute {"faire":"alerter","sujet":"demande de réduction"}.
• {"faire":"mode_emploi"} sert UNIQUEMENT à « comment je commande ? », « je ne comprends pas comment ça marche ». Rien d'autre.
• {"faire":"humain"} quand le client a un PROBLÈME MAINTENANT : il attend, il n'a pas reçu, c'est cassé, il est mécontent, il veut parler à quelqu'un. Une question sur le fonctionnement — « qu'est-ce qui se passe si ma commande n'arrive pas ? », « vous remboursez ? », « c'est garanti ? » — n'est PAS un problème : c'est une question, et personne ne s'est encore plaint. Réponds avec repondre si tu sais, et ajoute humain seulement si la réponse engage le commerçant. Faire taire l'agent pour un client qui posait une simple question, c'est le perdre.
• Tu hésites → baisse certitude. En dessous de 0,55 c'est traité sans toi, ce n'est pas un échec.

FAITS — la seule vérité
${faits.nom}${faits.adresse ? ` · ${faits.adresse}` : ""}${faits.horaires ? ` · ouvert ${faits.horaires}` : ""}
On expédie depuis : ${faits.adresse || "(non renseigné)"} — aucune autre zone n'est connue
Livraison : ${
    faits.livraison
      ? faits.fraisLivraison != null
        ? `oui, ${faits.fraisLivraison} ${faits.devise}`
        : "oui, frais non renseignés"
      : "non, retrait sur place uniquement"
  }

CATALOGUE — id | nom | catégorie | prix | variations
${liste || "(vide)"}

SI ON TE DONNE « CE CLIENT » : la discrétion est une RÈGLE. Ne lui parle de son passé QUE si ça sert sa demande du moment — « la même chose que la dernière fois ? » quand il hésite, oui ; « je vois que tu as déjà commandé… » à chaque message, jamais. C'est étouffant, et un client étouffé s'en va. S'il ne demande rien, tu ne proposes rien.

MÉMOIRE — tu peux ajouter "memoire":["..."] : un ou deux GOÛTS DURABLES appris dans ce message (« préfère le noir », « achète pour sa fille », « petit budget »). Pas d'événement, rien sur la commande en cours. Rien à retenir → n'écris pas le champ.

Réponds en JSON seul : {"actions":[...],"certitude":0.0,"raisonnement":"...","memoire":[]}`;
}

/**
 * Comprendre le message. Renvoie `null` dès que le moindre doute subsiste —
 * l'appelant retombe alors sur l'escalier déterministe.
 *
 * Le délai est court (6 s) et volontaire : sur WhatsApp, une réponse juste qui
 * arrive après trente secondes a déjà perdu le client. Mieux vaut la réponse
 * déterministe tout de suite.
 */
export async function comprendre(
  message: string,
  prods: ProduitConnu[],
  faits: FaitsCommerce,
  resto: boolean,
  historique: { role: string; content: string }[] = [],
  /** Ce qu'on sait de ce client : le résumé pour le modèle, et ses ancres. */
  memoire: { resume: string; ancres: string[] } = { resume: "", ancres: [] }
): Promise<Comprehension | null> {
  if (!CLE || !message.trim()) return null;

  const cle = cleCache({
    modeles: MODELES, message, resto, prods, faits,
    memoire: memoire.resume, historique,
  });
  const dejaVu = lireCache(cle);
  if (dejaVu) {
    console.log(`[comprendre] cache (${CACHE.size} entrées, ${touches} touches / ${touches + manques})`);
    return dejaVu;
  }

  const corps = {
    temperature: 0,
    max_tokens: 500,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: consigne(prods, faits, resto) },
      ...historique.slice(-6).map((h) => ({
        role: h.role === "assistant" ? "assistant" : "user",
        content: String(h.content).slice(0, 500),
      })),
      // La mémoire arrive ici, APRÈS le préfixe stable, pour ne pas l'invalider.
      ...(memoire.resume
        ? [{ role: "user" as const, content: `CE CLIENT — ${memoire.resume}` }]
        : []),
      { role: "user", content: message.slice(0, 1000) },
    ],
  };

  for (const [i, modele] of MODELES.entries()) {
    const ctl = new AbortController();
    const minuteur = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        signal: ctl.signal,
        headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modele, ...corps }),
      });

      if (r.status === 429 || r.status === 503) {
        // Saturé : le modèle suivant a son propre compteur.
        console.warn(`[comprendre] ${modele} saturé (${r.status})`);
        continue;
      }
      if (!r.ok) {
        console.error(`[comprendre] ${modele} refuse :`, r.status, (await r.text()).slice(0, 200));
        continue;
      }

      const d = await r.json();
      const brut = d?.choices?.[0]?.message?.content;
      if (!brut) continue;
      const c = valider(JSON.parse(brut), prods, faits, message, memoire.ancres);
      // Un retour illisible ou entièrement rejeté : le modèle suivant peut
      // mieux faire. Mais on ne tente pas éternellement — le client attend.
      if (!c) continue;
      const sortie = i === 0 ? c : { ...c, raisonnement: `${c.raisonnement} | via ${modele}` };
      // Seuls les succès sont gardés : mettre un échec en cache transformerait
      // une saturation de quelques secondes en panne de dix minutes.
      ecrireCache(cle, sortie);
      return sortie;
    } catch (e) {
      // Un abandon au bout de 6 s n'est pas une anomalie : c'est la décision.
      console.error(`[comprendre] ${modele} abandonné :`, (e as Error).message);
    } finally {
      clearTimeout(minuteur);
    }
  }
  return null;
}
