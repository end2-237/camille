// ─────────────────────────────────────────────────────────────────────────────
// L'agent santé & bien-être : les règles que le code tient, quoi que dise le
// modèle.
//
// Testé en simulation (8 clients, 3 versions) avant d'être écrit ici : des
// consignes seules, même excellentes, ne suffisent pas. Le modèle oublie une
// urgence au message suivant, répète ses formules, invente un numéro, un
// « certificat », fait semblant de remplir le panier. Tout ce qui ne doit
// JAMAIS rater est donc ici, en code :
//   - les détecteurs, AVANT le modèle (urgence, arrêt de traitement, demande
//     d'une personne, « robot ? ») ;
//   - les états verrouillés (urgence, relais humain), qui ne dépendent pas de
//     la mémoire du modèle ;
//   - le contrôle de chaque réponse, APRÈS le modèle, puis la réparation.
//
// Aucun import : éprouvé par npm test.
// ─────────────────────────────────────────────────────────────────────────────

export type Bloc =
  | { type: "reaction"; emoji: string }
  | { type: "texte"; texte: string }
  | { type: "boutons"; entete?: string | null; texte: string; boutons: string[] }
  | { type: "liste"; texte: string; bouton?: string; options: string[] }
  | { type: "media"; id: string; legende?: string }
  | { type: "lien_site"; id: string; texte: string; bouton: string }
  | { type: "formulaire_rdv"; texte: string; bouton?: string }
  | { type: "produits"; ids: string[]; texte: string }
  | { type: "position_centre" };

export type Sortie = {
  phase?: string;
  blocs: Bloc[];
  memoire?: { sujet?: string; tutoie?: boolean; langue?: string };
  humain?: boolean;
};

/** Ce que le code retient d'une conversation, d'un message à l'autre. */
export type EtatSante = {
  alerte: boolean;
  humain: boolean;
  echecsVocal: number;
  langue: "fr" | "en" | null;
  /** Débuts de phrase déjà servis, pour ne pas les resservir. */
  formules: string[];
  /** Tours restants sans réaction emoji. */
  pauseReaction: number;
  /** Médias déjà envoyés (vidéo du centre, vocaux) : jamais deux fois. */
  envoyes: string[];
  sujet?: string;
  tutoie?: boolean;
  rdv?: string;
};

export const ETAT_VIDE: EtatSante = {
  alerte: false, humain: false, echecsVocal: 0, langue: null, formules: [], pauseReaction: 0, envoyes: [],
};

const sans = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ── Détecteurs : avant le modèle ────────────────────────────────────────────

const ALERTE = /(poitrine|saign|enceinte.{0,40}(mal|douleur|perd|saign|contraction)|accouch|evanoui|perd connaissance|inconscient|suicid|me tuer|en finir avec la vie|convuls|ne respire|du mal a respirer|fievre tres|bebe.{0,30}(fievre|malade|convuls)|enfant.{0,30}(fievre forte|convuls|inconscient)|chest pain|bleeding|pregnan.{0,30}(pain|blood|bleed)|faint|can't breathe|cant breathe)/;
const ARRET_TRAITEMENT = /arreter? (mes |mon |ma |les |le |la )?(medoc|medicament|comprim|pilule|traitement|medecine|insuline|injection)|stop (my )?(medication|medicine|drugs|tablets)/;
const DEMANDE_HUMAIN = /(parler|appeler|joindre|discuter).{0,30}(personne|humain|quelqu|conseill|vrai|responsable|docteur|medecin|praticien)|une vraie personne|un humain|talk to (a )?(human|person|someone)/;
const ROBOT = /\b(robot|bot|ia|intelligence artificielle|machine|automatique|chatgpt)\b/;

export function detecter(texte: string): { alerte: boolean; arretTraitement: boolean; humain: boolean; robot: boolean } {
  const t = sans(texte);
  return { alerte: ALERTE.test(t), arretTraitement: ARRET_TRAITEMENT.test(t), humain: DEMANDE_HUMAIN.test(t), robot: ROBOT.test(t) };
}

/** Anglais ou pidgin ? Le code fixe la langue au premier message, le modèle ne la devine plus à chaque tour. */
export function langueDe(texte: string): "fr" | "en" {
  const t = ` ${sans(texte)} `;
  const en = (t.match(/\b(the|you|your|i|my|is|are|have|get|dey|di|una|wey|wetin|abeg|how|what|where|when|can|pain|good morning|hello|please|thanks?)\b/g) || []).length;
  const fr = (t.match(/\b(je|tu|vous|le|la|les|un|une|des|est|suis|bonjour|bonsoir|svp|merci|combien|ou|quoi|mal|pour|avec|c'est|ca)\b/g) || []).length;
  return en > fr ? "en" : "fr";
}

/**
 * Ce que le code impose au modèle pour CE tour. Le modèle oublie ; le code, non.
 * `praticien` : le nom et le titre exacts (« Mme Ngo, naturopathe »).
 */
export function consignesDuTour(
  texte: string, etat: EtatSante, praticien: string, vocal?: { compris: boolean }
): string[] {
  const d = detecter(texte);
  const c: string[] = [];
  if (etat.alerte) {
    c.push("MODE URGENCE (verrouillé par le code) : uniquement aller aux urgences de l'hôpital le plus proche, tout de suite ; l'équipe est prévenue ; ta présence (« écrivez-moi dès que vous pouvez, je suis là »). AUCUN produit, AUCUN rendez-vous, AUCUN bouton, AUCUNE réaction, AUCUN média. Un seul bloc texte, deux ou trois phrases, avec douceur et fermeté.");
  } else if (etat.humain) {
    c.push("RELAIS HUMAIN : l'équipe va écrire à cette personne ici, sur ce numéro WhatsApp. Ne promets ni heure ni appel. Reste disponible et chaleureuse, ne relance pas la vente.");
  }
  if (d.arretTraitement && !etat.alerte) {
    c.push(`SÉCURITÉ OBLIGATOIRE : dis avec douceur et assurance que ${praticien} travaille toujours en complément du traitement, et qu'il faut le garder tel quel tant que son médecin n'a rien dit d'autre.`);
  }
  if (d.robot) c.push("On te demande si tu es un robot ou une IA : confirme-le simplement et positivement (assistante digitale du centre, présente à toute heure ; l'équipe prend le relais pour ce qui demande une personne).");
  if (vocal && !vocal.compris) {
    c.push(etat.echecsVocal >= 2
      ? "2e VOCAL MAL COMPRIS DE SUITE : prends la faute sur toi (« le son coupe de mon côté ») et propose d'écrire, avec des boutons de sujets pour ne pas forcer à taper."
      : "VOCAL MAL COMPRIS : redis seulement les mots réellement compris (ou dis simplement que tu n'as pas bien entendu — jamais de citation vide), puis demande poliment de répéter un peu plus fort ; varie la formule.");
  }
  if (etat.langue === "en") c.push("LANGUE : anglais simple et chaleureux (quelques mots de pidgin bienvenus), TOUT en anglais, boutons compris.");
  if (etat.formules.length) c.push("Ne reprends pas tes formules récentes : " + etat.formules.slice(-4).join(" | "));
  if (etat.envoyes.length) c.push("Déjà envoyés, ne les renvoie pas : " + etat.envoyes.join(", "));
  if (etat.pauseReaction > 0) c.push("Pas de réaction emoji ce tour.");
  return c;
}

/** Un vocal transcrit est-il exploitable ? Vide, trop court, ou plein de trous : non. */
export function vocalCompris(transcription: string): boolean {
  const t = String(transcription || "").trim();
  if (!t) return false;
  if (/\[(inaudible|musique|bruit|music|noise)\]/i.test(t)) return false;
  const mots = t.split(/\s+/).filter((m) => /[\p{L}]{2,}/u.test(m));
  return mots.length >= 2;
}

// ── Contrôle : après le modèle ──────────────────────────────────────────────

const ACTIONS = new Set(["boutons", "liste", "formulaire_rdv", "produits"]);

const INTERDITS: [RegExp, string][] = [
  [/\b(guerit|guerir|guerison|soigne|soigner|traite (le|la|les|votre)|vient a bout|fait disparaitre|vous irez mieux|tu iras mieux|efficace a 100|resultat garanti|miracle)\b/, "promesse de résultat"],
  [/\b(aide|aider|soulage|soulager|calme|calmer|reduit|reduire|ameliore|ameliorer|apaise|apaiser|regule|reguler|nettoie|detoxifie)\b.{0,40}\b(douleur|tension|inflammation|digestion|glycemie|sucre|sommeil|articulation|foie|rein|ventre|regles|fibrome)/, "effet de santé attribué"],
  [/personne ne peut (vous |te )?promettre|chaque (corps|personne|organisme) (reagit|est different)|arnaque|aucune obligation|juste reflechir|je ne peux pas (vous |te )?repondre|ne pretend|aucun de nos produits|ne remplace pas/, "doute exprimé (contre-marketing)"],
  [/(vous |te )(enverra|appellera|rappellera|contactera) (a|vers|demain matin|avant)|\bcertificat|analyses? de laboratoire|rembours|echantillon gratuit|paiement en ligne|par sms|livraison (est )?(confirmee|gratuite)/, "engagement ou fait inventé"],
  [/(ajoute|ajoutee|ajoutes) (a|au|dans) (votre|ton|le) panier|commande (est |a ete |bien )?(transmise|enregistree|confirmee|validee|passee)|panier (est )?(confirme|valide)|finaliser (la|votre|ta) commande/, "simulation du panier (c'est le vrai panier WhatsApp qui commande)"],
  [/\b(quels? (sont )?(vos|tes) symptomes|prenez-vous|tu prends quel|depuis combien de temps (avez-vous|as-tu) (mal|ce)|quel traitement|vos analyses|votre glycemie|votre tension)\b/, "question médicale"],
];

export type Controle = { defauts: string[] };

/**
 * Les défauts d'une réponse. `identifiants` : ce que le modèle a le droit de
 * nommer (médias, pages, produits) ; `chiffres` : les nombres autorisés (prix
 * du catalogue, horaires, adresse) — tout autre nombre est inventé.
 */
export function controler(
  s: Sortie, etat: EtatSante, autorise: { medias: string[]; pages: string[]; produits: string[]; chiffres: string[] }
): string[] {
  const d: string[] = [];
  const blocs = Array.isArray(s?.blocs) ? s.blocs : [];
  if (!blocs.length) return ["aucun bloc"];
  const actions = blocs.filter((b) => ACTIONS.has(b.type));
  if (actions.length > 1) d.push("plus d'un bloc d'action (boutons, liste, formulaire, produits) : un seul, en dernier");
  if (actions.length && blocs[blocs.length - 1] !== actions[actions.length - 1]) d.push("le bloc d'action doit venir en dernier");
  if (blocs.length > 3) d.push("plus de 3 blocs");
  const chiffresOk = new Set(autorise.chiffres);

  for (const b of blocs) {
    if (b.type === "boutons") {
      if ((b.boutons || []).length > 3) d.push("plus de 3 boutons");
      for (const x of b.boutons || []) if ([...x].length > 20) d.push(`bouton de plus de 20 caractères : « ${x} »`);
      if (b.entete && (!autorise.medias.includes(b.entete) || etat.envoyes.includes(b.entete))) d.push(`en-tête ${b.entete} indisponible ou déjà envoyé`);
    }
    if (b.type === "liste") for (const x of b.options || []) if ([...x].length > 24) d.push(`option de plus de 24 caractères : « ${x} »`);
    if (b.type === "media") {
      if (!autorise.medias.includes(b.id)) d.push(`média inconnu : ${b.id}`);
      else if (etat.envoyes.includes(b.id)) d.push(`média déjà envoyé : ${b.id}`);
    }
    if (b.type === "lien_site" && !autorise.pages.includes(b.id)) d.push(`page inconnue : ${b.id}`);
    if (b.type === "produits" && !(b.ids || []).every((i) => autorise.produits.includes(i))) d.push("produit inconnu");
    if (etat.alerte && b.type !== "texte") d.push("en urgence : uniquement du texte");

    const texte = sans([("texte" in b ? b.texte : ""), ("legende" in b ? b.legende : "")].filter(Boolean).join(" "));
    for (const [re, nom] of INTERDITS) {
      const m = texte.match(re);
      if (m) d.push(`${nom} : « ${m[0]} »`);
    }
    for (const n of texte.replace(/(?<=\d)[\s  .](?=\d{3}\b)/g, "").match(/\d{2,}/g) || []) {
      if (!chiffresOk.has(n)) d.push(`chiffre non vérifiable : ${n}`);
    }
    for (const f of etat.formules.slice(-4)) if (f && texte.includes(sans(f))) d.push(`formule répétée : « ${f} »`);
  }
  if (etat.pauseReaction > 0 && blocs.some((b) => b.type === "reaction")) d.push("réaction emoji trop rapprochée");
  return d;
}

/**
 * Ce que le code corrige lui-même quand le modèle insiste à se tromper : un
 * seul bloc d'action, en dernier ; boutons et options coupés aux limites de
 * WhatsApp ; rien d'autre que du texte en urgence ; pas de média déjà envoyé.
 */
export function reparer(s: Sortie, etat: EtatSante, repliUrgence: string): Sortie {
  if (etat.alerte) {
    const t = (s.blocs || []).filter((b) => b.type === "texte").map((b) => (b as { texte: string }).texte).join(" ");
    const sur = t && !controler({ blocs: [{ type: "texte", texte: t }] }, etat, { medias: [], pages: [], produits: [], chiffres: [] }).some((x) => !x.startsWith("chiffre") && !x.startsWith("formule"));
    return { ...s, blocs: [{ type: "texte", texte: sur ? t : repliUrgence }], humain: true };
  }
  let action: Bloc | null = null;
  const reste: Bloc[] = [];
  for (const b of s.blocs || []) {
    if (b.type === "reaction" && etat.pauseReaction > 0) continue;
    if (b.type === "media" && etat.envoyes.includes(b.id)) continue;
    if (ACTIONS.has(b.type)) { action = b; continue; }
    reste.push(b);
  }
  if (action?.type === "boutons") {
    action = { ...action, boutons: action.boutons.slice(0, 3).map((x) => [...x].slice(0, 20).join("")), entete: action.entete && !etat.envoyes.includes(action.entete) ? action.entete : null };
  }
  if (action?.type === "liste") action = { ...action, options: action.options.slice(0, 10).map((x) => [...x].slice(0, 24).join("")) };
  const blocs = [...reste.slice(0, action ? 2 : 3), ...(action ? [action] : [])];
  return { ...s, blocs: blocs.length ? blocs : [{ type: "texte", texte: "Je suis là 🙏 Dites-moi ce qui vous ferait du bien." }] };
}

/** Les débuts de phrase (4 mots) d'une réponse : on ne les resservira pas. */
export function formulesDe(s: Sortie): string[] {
  const out: string[] = [];
  for (const b of s.blocs || []) {
    const t = "texte" in b ? String(b.texte || "") : "";
    for (const ph of t.split(/(?<=[.!?])\s+/)) {
      const mots = ph.trim().split(/\s+/);
      if (mots.length >= 5) out.push(mots.slice(0, 4).join(" "));
    }
  }
  return out;
}

/** L'état après ce tour. */
export function etatSuivant(etat: EtatSante, s: Sortie, vu: { alerte: boolean; humain: boolean; vocalRate: boolean | null }): EtatSante {
  const envoyes = new Set(etat.envoyes);
  for (const b of s.blocs || []) {
    if (b.type === "media") envoyes.add(b.id);
    if (b.type === "boutons" && b.entete) envoyes.add(b.entete);
  }
  return {
    ...etat,
    alerte: etat.alerte || vu.alerte,
    humain: etat.humain || vu.humain || s.humain === true,
    echecsVocal: vu.vocalRate === null ? etat.echecsVocal : vu.vocalRate ? etat.echecsVocal + 1 : 0,
    formules: [...etat.formules, ...formulesDe(s)].slice(-8),
    pauseReaction: (s.blocs || []).some((b) => b.type === "reaction") ? 2 : Math.max(0, etat.pauseReaction - 1),
    envoyes: [...envoyes],
    sujet: s.memoire?.sujet || etat.sujet,
    tutoie: s.memoire?.tutoie ?? etat.tutoie,
  };
}

// ── La consigne du modèle ───────────────────────────────────────────────────

export type FaitsCentre = {
  centre: string;
  adresse: string;
  horaires: string;
  praticien: string;
  /** « p1 Tisane Articulations 250 g — 6 000 F | … » */
  catalogue: string;
  medias: { id: string; description: string }[];
  pages: { id: string; description: string }[];
};

export function consigneSante(f: FaitsCentre): string {
  return `Tu es Camille, l'assistante WhatsApp de ${f.centre}. Les personnes qui t'écrivent sont souvent fatiguées, inquiètes, parfois déçues par d'autres solutions. Ton rôle : qu'elles se sentent accueillies, écoutées et en confiance, puis les guider vers le centre (rendez-vous) ou les produits. Tu n'es ni médecin ni conseillère médicale.

## Les faits : tu n'inventes RIEN
Tu ne cites que ces faits. Tout le reste (numéro de téléphone, tarif d'une consultation, paiement, délai, promotion, garantie, certificat, heure d'appel) tu ne le connais pas : « l'équipe vous le précise ici ».
- Centre : ${f.centre} — ${f.adresse}. Horaires : ${f.horaires}.
- Praticien : ${f.praticien}. Rendez-vous : on propose des créneaux, l'équipe confirme ici sur WhatsApp.
- Catalogue (prix exacts) : ${f.catalogue || "(vide)"}
- Contact : l'équipe écrit à la personne sur CE numéro WhatsApp. Aucun autre numéro.
- Urgences : les urgences de l'hôpital le plus proche. Aucun numéro d'urgence.
- Achats : tu montres les fiches produits ; la personne ajoute au panier WhatsApp et l'envoie ; le panier gère ensuite quartier, frais et confirmation. Tu ne dis JAMAIS qu'un produit est ajouté au panier ni qu'une commande est transmise ou confirmée.

## Ta posture
- Chaleur sincère, jamais mécanique. Phrases courtes, 1 à 3 par bloc. Emojis sobres (🙏🌿😊), un ou deux.
- Le prénom au premier message, puis de temps en temps. Vouvoiement par défaut, tutoiement si la personne tutoie.
- ÉCOUTE : tu reformules ce que la personne VIT (la durée, la fatigue, l'inquiétude) et tu valorises sa démarche une fois. Tu ne reformules jamais une promesse.
- PRÉSENCE : « je suis là pour vous répondre à toute heure » au premier message, puis seulement aux moments clés (inquiétude, nuit, après une réservation).
- AUCUNE question médicale (symptômes, traitement, médicaments, examens), aucun avis, diagnostic ni conseil de santé : c'est le rôle de ${f.praticien}.
- AUCUNE promesse ni description d'effet (« guérit », « soigne », « soulage », « aide à », « efficace ») : le nom, le format et le prix d'un produit suffisent. Ce sont les preuves qui rassurent : la vidéo du centre, la voix du praticien, les témoignages.
- PAS DE CONTRE-MARKETING : jamais de doute exprimé (« personne ne peut promettre », « arnaques », « aucune obligation », « je ne peux pas répondre »). À « ça marche vraiment ? » : « C'est la question que tout le monde se pose au début 😊 » puis une preuve, puis le rendez-vous.
- PAS DE PRESSION : ni fausse urgence ni rareté.
- HONNÊTETÉ : si on te demande si tu es un robot ou une IA, tu le confirmes, positivement.

## Les phases (au rythme de la personne)
ACCUEIL (premier message : tu te présentes — « Je suis Camille, l'assistante du centre » — ; boutons avec la vidéo du centre en en-tête s'il y en a une ; salutation avec le prénom du CONTEXTE ; le sujet de la pub d'origine s'il est connu ; ta présence à toute heure ; si elle a déjà posé une question précise, tu y réponds DANS ce message) → ÉCOUTE → PREUVES (vocal du praticien, témoignages, page du site) → ORIENTATION (boutons) → ACTION (rendez-vous ou fiches produits) → CONFIRMATION.

## Situations
- La personne insiste pour une promesse : ni promesse ni doute ; « c'est exactement ce que ${f.praticien} regardera avec vous » + une preuve ou le rendez-vous ; jamais deux fois la même phrase.
- Méfiance : sans te justifier, « venez voir le centre de vos propres yeux » + adresse + preuve.
- Prix : le prix exact du catalogue, puis la fiche produit.
- Nuit : tu es là quand même ; on peut choisir un créneau ; l'équipe confirme à l'ouverture.
- Demande d'une personne : accepté avec chaleur, humain=true ; l'équipe écrit ici.
- Réponses courtes (« ok », « info ») : une suite simple en boutons, sans te représenter.
Le code ajoute parfois des CONSIGNES OBLIGATOIRES DU TOUR : elles passent avant tout.

## Format
UNIQUEMENT un objet JSON : {"phase":"accueil|ecoute|preuves|orientation|action|confirmation|alerte|autre","blocs":[1 à 3 blocs],"memoire":{"sujet":"...","tutoie":false},"humain":false}
Blocs (des OBJETS) :
- {"type":"reaction","emoji":"🙏"} — parfois, jamais en urgence
- {"type":"texte","texte":"..."}
- {"type":"boutons","entete":"<id vidéo>"|null,"texte":"...","boutons":["≤20 caractères","…","…"]}
- {"type":"liste","texte":"...","bouton":"Choisir","options":["≤24 caractères", "…"]}
- {"type":"media","id":"<id>","legende":"..."}
- {"type":"lien_site","id":"<id page>","texte":"...","bouton":"≤20 caractères"}
- {"type":"formulaire_rdv","texte":"..."} — le code propose alors les créneaux libres
- {"type":"produits","ids":["<id>"],"texte":"..."}
- {"type":"position_centre"}
Règles : un SEUL bloc d'action (boutons, liste, formulaire_rdv, produits) par réponse, en dernier. Boutons : 3 au plus, 20 caractères au plus emoji compris (« 📅 Prendre RDV », « 🌿 Voir produits », « 💬 Une question »). Varie tes questions de fin.
Médias disponibles : ${f.medias.map((m) => `${m.id} (${m.description})`).join(" ; ") || "(aucun)"}.
Pages du site : ${f.pages.map((p) => `${p.id} (${p.description})`).join(" ; ") || "(aucune)"}.`;
}

/** Le message d'urgence quand le modèle n'arrive pas à rester dans les clous. */
export function repliUrgence(langue: "fr" | "en" | null): string {
  return langue === "en"
    ? "Please go to the emergency department of the nearest hospital right now — don't wait. I've alerted our team. Write to me as soon as you can, I'm here 🙏"
    : "Allez tout de suite aux urgences de l'hôpital le plus proche, sans attendre. J'ai prévenu l'équipe du centre. Écrivez-moi dès que vous pouvez, je suis là 🙏";
}
