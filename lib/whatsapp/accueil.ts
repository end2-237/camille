// ─────────────────────────────────────────────────────────────────────────────
// Le premier mot : appeler le client par son nom, dès le début.
//
// « Bonjour et bienvenue chez X 👋 » sonne comme un répondeur. Le vendeur du
// quartier dit « Bonsoir Paul ! ». WhatsApp nous donne le nom que le client
// s'est choisi sur son profil : on s'en sert, prudemment — un pseudo, un emoji
// ou un numéro ne sont pas des prénoms, et mal appeler quelqu'un est pire que
// ne pas l'appeler.
//
// Aucun import : éprouvé par npm test.
// ─────────────────────────────────────────────────────────────────────────────

const PAS_UN_PRENOM = /^(mr|mme|mlle|dr|pr|me|m|monsieur|madame|maman|papa|tonton|tata|boss|chef|client|cliente|user|admin|whatsapp|business|ets|sarl|sa|shop|store|boutique)$/i;

/**
 * Le prénom à dire, tiré du nom de profil WhatsApp ; vide si on n'est pas sûr.
 * « paul ndjock » → « Paul » ; « ~Lady B 💄 » → « Lady » ; « 237699… » → «  » ;
 * « Ets Kamga » → « Kamga ».
 */
export function prenomDe(nomProfil?: string | null): string {
  const mots = String(nomProfil || "")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .map((m) => m.replace(/^['-]+|['-]+$/g, ""))
    .filter((m) => m.length >= 2 && !PAS_UN_PRENOM.test(m));
  const p = mots[0];
  if (!p || p.length > 20) return "";
  return p.charAt(0).toLocaleUpperCase("fr") + p.slice(1).toLocaleLowerCase("fr");
}

/** « Bonjour » jusqu'à 18 h, « Bonsoir » ensuite ; heure locale décimale. */
export function salut(heure: number): string {
  return heure >= 18 || heure < 4 ? "Bonsoir" : "Bonjour";
}

/**
 * Le message d'accueil.
 *
 * - Le commerçant a écrit le sien : on le garde, avec {b} (le commerce) et
 *   {prenom} (le client). S'il ne nomme pas le client, on le salue avant.
 * - Sinon, le texte du secteur, dont on retire le « Bonjour et bienvenue » du
 *   début pour le remplacer par une salutation qui nomme le client.
 * - Un habitué n'est pas « bienvenu » : on est content de le revoir.
 */
export function messageAccueil(p: {
  nomProfil?: string | null;
  heure: number;
  commerce: string;
  /** Le texte du secteur, avec {b}. */
  texteSecteur: string;
  /** Le message écrit par le commerçant, s'il en a un. */
  personnalise?: string | null;
  habitue?: boolean;
}): string {
  const prenom = prenomDe(p.nomProfil);
  const b = p.commerce.trim() || "nous";
  const bonjour = `${salut(p.heure)}${prenom ? ` ${prenom}` : ""}`;

  if (p.habitue) {
    return `${bonjour} 😊 Content de te revoir chez ${b} ! Qu'est-ce qui te ferait plaisir aujourd'hui ?`;
  }

  const perso = String(p.personnalise || "").trim();
  if (perso) {
    const texte = perso.replace(/\{b\}/g, b).replace(/\{prenom\}/g, prenom || "").replace(/\s+([,.])/g, "$1").replace(/ {2,}/g, " ").trim();
    if (perso.includes("{prenom}") || !prenom) return texte;
    return `${bonjour} 👋\n${texte}`;
  }

  // « Bonjour et bienvenue chez X 🛍️ Dites-moi… » → « Bonsoir Paul ! Bienvenue chez X 🛍️ Dites-moi… »
  const corps = p.texteSecteur
    .replace(/\{b\}/g, b)
    .replace(/^(bonjour|bonsoir|bienvenue)\s*(et\s+)?/i, "")
    .replace(/^bienvenue/i, "Bienvenue")
    .trim();
  const suite = /^chez\b/i.test(corps) ? `Bienvenue ${corps}` : corps.charAt(0).toUpperCase() + corps.slice(1);
  return `${bonjour} ! ${suite}`;
}
