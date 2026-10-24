// ─────────────────────────────────────────────────────────────────────────────
// Les parcours WhatsApp (forfait Entreprise) : le format, et ses règles.
//
// Un parcours est un fichier JSON que le commerçant dessine (éditeur visuel,
// façon n8n) ou écrit (JSON brut), puis publie. Camille l'exécute à la place
// du flux simple : accueil scripté, médias, boutons, transfert à un humain —
// et l'IA de l'agent seulement là où le parcours l'appelle (bloc « agent »).
//
// Aucun code exécutable : seulement des blocs prévus. Après l'intrusion
// d'octobre 2026, c'est la règle.
//
// Module pur (aucune dépendance). Le MÊME code décide du chemin pour le
// moteur (lib/whatsapp/parcours.ts) et pour le téléphone d'aperçu de
// l'éditeur : ce que l'on voit dans l'aperçu est ce que le client recevra.
// ─────────────────────────────────────────────────────────────────────────────

export type Choix = { id: string; titre: string; description?: string; vers?: string };

/** Des boutons de réponse posés sous un message (texte, image ou vidéo). */
type Interactif = { boutons?: Choix[]; sinon?: string };

export type Bloc = { id: string; suite?: string } & (
  | ({ type: "texte"; texte: string } & Interactif)
  | ({ type: "image"; url: string; legende?: string } & Interactif)
  | ({ type: "video"; url: string; legende?: string } & Interactif)
  | { type: "vocal"; url: string }
  | { type: "document"; url: string; nom?: string; legende?: string }
  | { type: "lien"; url: string; texte?: string }
  | { type: "bouton_lien"; texte: string; libelle: string; url: string }
  | { type: "boutons"; texte: string; pied?: string; boutons: Choix[]; sinon?: string }
  | { type: "liste"; texte: string; bouton: string; pied?: string; lignes: Choix[]; sinon?: string }
  | { type: "position"; texte: string; sinon?: string }
  | { type: "reaction"; emoji: string }
  | { type: "pause"; secondes: number }
  | { type: "agent" }
  | { type: "humain"; message?: string; attente?: string; alerte?: boolean }
  | { type: "silence" }
  | { type: "fin" }
  | { type: "aller"; vers: string }
);

export type TypeBloc = Bloc["type"];

export type Declencheur =
  | { type: "nouveau_contact"; vers: string }
  | { type: "mot_cle"; mots: string[]; mode?: "commence" | "contient" | "exact"; vers: string }
  | { type: "bouton"; id: string; vers: string };

export type Position = { x: number; y: number };

export type Parcours = {
  schema: 1;
  nom?: string;
  declencheurs: Declencheur[];
  /** Un message hors parcours : « silence », « agent », ou l'identifiant d'un bloc. */
  par_defaut?: string;
  /**
   * « explicites » : un bloc sans lien s'arrête là (éditeur visuel). Sinon,
   * un bloc sans lien enchaîne sur le bloc suivant de la liste.
   */
  liens?: "explicites";
  blocs: Bloc[];
  /** Ce qui ne sert qu'à l'éditeur : la place de chaque bloc sur le canevas. */
  ui?: { positions?: Record<string, Position> };
};

export type Probleme = { chemin: string; message: string };

export type Famille = "message" | "media" | "interaction" | "logique" | "sortie";

/** Les blocs proposés dans l'éditeur, dans l'ordre de la palette. */
export const TYPES: { type: TypeBloc; libelle: string; famille: Famille; aide: string }[] = [
  { type: "texte", libelle: "Texte", famille: "message", aide: "Variables : {prenom}, {nom}, {entreprise}, {telephone}. Valeur par défaut : {prenom|cher client}. Ajoutez des boutons pour rendre le message interactif." },
  { type: "image", libelle: "Image", famille: "media", aide: "Adresse publique (JPG, PNG). Avec des boutons, la légende devient le texte du message." },
  { type: "video", libelle: "Vidéo", famille: "media", aide: "MP4 de préférence. Au-delà de 16 Mo, Camille la compresse pour WhatsApp. Avec des boutons, la légende devient le texte du message." },
  { type: "vocal", libelle: "Vocal", famille: "media", aide: "OGG (note vocale) ou MP3. {audio_accueil} = le vocal réglé dans la configuration de l'agent." },
  { type: "document", libelle: "Document", famille: "media", aide: "PDF ou autre fichier, adresse publique." },
  { type: "lien", libelle: "Lien", famille: "message", aide: "Envoyé avec l'aperçu du site." },
  { type: "bouton_lien", libelle: "Bouton vers un site", famille: "interaction", aide: "Un bouton qui ouvre l'adresse (l'adresse ne s'affiche pas)." },
  { type: "boutons", libelle: "Boutons", famille: "interaction", aide: "3 boutons au plus. Chaque bouton mène à sa suite." },
  { type: "liste", libelle: "Liste de choix", famille: "interaction", aide: "10 choix au plus, derrière un bouton." },
  { type: "position", libelle: "Demander la position", famille: "interaction", aide: "Le bouton natif « Envoyer ma position ». La suite part quand le client l'envoie." },
  { type: "reaction", libelle: "Réaction emoji", famille: "interaction", aide: "Un emoji posé sur le message du client (👍, ❤️, 🙏…)." },
  { type: "pause", libelle: "Pause", famille: "logique", aide: "Entre 1 et 15 secondes." },
  { type: "aller", libelle: "Aller à un bloc", famille: "logique", aide: "Continue au bloc indiqué." },
  { type: "agent", libelle: "L'IA répond", famille: "sortie", aide: "L'agent de Camille (santé, boutique…) répond à ce message et aux suivants." },
  { type: "humain", libelle: "Transférer à un humain", famille: "sortie", aide: "Camille se tait ; le commerçant est prévenu." },
  { type: "silence", libelle: "Se taire", famille: "sortie", aide: "Camille ne répond plus ; les messages restent dans la boîte de réception." },
  { type: "fin", libelle: "Fin", famille: "sortie", aide: "Les messages suivants vont au comportement par défaut." },
];

export const TERMINAUX: TypeBloc[] = ["agent", "humain", "silence", "fin"];

/** Les choix d'un bloc (boutons ou lignes), quel qu'il soit. */
export function choixDe(b: Bloc): Choix[] {
  if (b.type === "liste") return b.lignes || [];
  if (b.type === "boutons" || b.type === "texte" || b.type === "image" || b.type === "video") return b.boutons || [];
  return [];
}

/** Le parcours s'arrête-t-il après ce bloc pour attendre la réponse du client ? */
export function attend(b: Bloc): boolean {
  return b.type === "boutons" || b.type === "liste" || b.type === "position" || choixDe(b).length > 0;
}

const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const URL_OK = /^https:\/\/[^\s]+$/i;
/** Les médias d'accueil réglés dans « Configuration de l'agent », par leur nom. */
export const MEDIA_AGENT = /^\{(audio|video)_accueil\}$/;
export const PAUSE_MAX = 15;
export const BLOCS_MAX = 100;

/** Un bloc vierge du type demandé, pour l'éditeur. */
export function blocVierge(type: TypeBloc, id: string): Bloc {
  switch (type) {
    case "texte": return { id, type, texte: "" };
    case "image": case "video": return { id, type, url: "" };
    case "vocal": return { id, type, url: "" };
    case "document": return { id, type, url: "", nom: "" };
    case "lien": return { id, type, url: "" };
    case "bouton_lien": return { id, type, texte: "", libelle: "Ouvrir", url: "" };
    case "boutons": return { id, type, texte: "", boutons: [{ id: `${id}_1`, titre: "" }] };
    case "liste": return { id, type, texte: "", bouton: "Voir", lignes: [{ id: `${id}_1`, titre: "" }] };
    case "position": return { id, type, texte: "Envoyez-nous votre position 📍" };
    case "reaction": return { id, type, emoji: "👍" };
    case "pause": return { id, type, secondes: 3 };
    case "humain": return { id, type, message: "", alerte: true };
    case "aller": return { id, type, vers: "" };
    default: return { id, type } as Bloc;
  }
}

/** Un identifiant libre, dérivé du type (« video_3 »). */
export function nouvelId(p: Pick<Parcours, "blocs">, type: TypeBloc): string {
  const pris = new Set(p.blocs.map((b) => b.id));
  for (let i = 1; ; i++) if (!pris.has(`${type}_${i}`)) return `${type}_${i}`;
}

// ── Les liens ───────────────────────────────────────────────────────────────

/** Où va le parcours après ce bloc, sans choix du client. */
export function suivant(p: Pick<Parcours, "blocs" | "liens">, b: Bloc): string | null {
  if (b.type === "aller") return b.vers || null;
  if (b.suite) return b.suite;
  if (p.liens === "explicites") return null;
  const i = p.blocs.findIndex((x) => x.id === b.id);
  return i >= 0 ? p.blocs[i + 1]?.id ?? null : null;
}

/** Où mène un choix (bouton, ligne) : sa cible, sinon la suite du bloc. */
export function cibleDuChoix(p: Pick<Parcours, "blocs" | "liens">, b: Bloc, c: Choix): string | null {
  return c.vers || suivant(p, b);
}

export type Lien = { de: string; sortie: string; vers: string; libelle?: string };

/**
 * Tous les liens du parcours, tels que l'éditeur les dessine. `de` vaut
 * « declencheur:<n> » pour un déclencheur ; `sortie` vaut « suite »,
 * « sinon » ou « choix:<id> ».
 */
export function liensDe(p: Parcours): Lien[] {
  const l: Lien[] = [];
  p.declencheurs.forEach((d, i) => d.vers && l.push({ de: `declencheur:${i}`, sortie: "suite", vers: d.vers }));
  for (const b of p.blocs) {
    if (TERMINAUX.includes(b.type)) continue;
    for (const c of choixDe(b)) {
      const v = c.vers || (p.liens === "explicites" ? null : suivant(p, b));
      if (v) l.push({ de: b.id, sortie: `choix:${c.id}`, vers: v, libelle: c.titre });
    }
    const sinon = (b as { sinon?: string }).sinon;
    if (sinon) l.push({ de: b.id, sortie: "sinon", vers: sinon, libelle: "sinon" });
    if (b.type === "position") {
      const v = suivant(p, b);
      if (v) l.push({ de: b.id, sortie: "suite", vers: v, libelle: "position reçue" });
    } else if (!attend(b)) {
      const v = suivant(p, b);
      if (v) l.push({ de: b.id, sortie: "suite", vers: v });
    }
  }
  return l;
}

/**
 * Le même parcours, mais chaque lien écrit noir sur blanc : l'éditeur
 * visuel ne connaît que les flèches qu'il voit.
 */
export function rendreExplicite(p: Parcours): Parcours {
  if (p.liens === "explicites") return p;
  const q: Parcours = JSON.parse(JSON.stringify(p));
  q.blocs.forEach((b, i) => {
    const prochain = p.blocs[i + 1]?.id;
    if (TERMINAUX.includes(b.type) || b.type === "aller") return;
    for (const c of choixDe(b)) if (!c.vers && prochain && !b.suite) c.vers = prochain;
    for (const c of choixDe(b)) if (!c.vers && b.suite) c.vers = b.suite;
    if (!b.suite && prochain && (!attend(b) || b.type === "position")) b.suite = prochain;
  });
  q.liens = "explicites";
  return q;
}

// ── Validation ──────────────────────────────────────────────────────────────

const txt = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Tout ce qui empêcherait le parcours de fonctionner (erreurs : publication
 * refusée) ou le rendrait douteux (avertissements : on publie quand même).
 * Les limites sont celles de Meta : un titre de bouton trop long fait refuser
 * TOUT le message, alors on le dit ici plutôt qu'au client.
 */
export function valider(entree: unknown): { ok: boolean; erreurs: Probleme[]; avertissements: Probleme[] } {
  const erreurs: Probleme[] = [];
  const avertissements: Probleme[] = [];
  const err = (chemin: string, message: string) => erreurs.push({ chemin, message });
  const avert = (chemin: string, message: string) => avertissements.push({ chemin, message });

  if (!entree || typeof entree !== "object" || Array.isArray(entree)) {
    err("", "Le parcours doit être un objet JSON.");
    return { ok: false, erreurs, avertissements };
  }
  const p = entree as Partial<Parcours>;
  if (p.schema !== 1) err("schema", "« schema » doit valoir 1.");
  if (p.liens !== undefined && p.liens !== "explicites") err("liens", "« liens » vaut « explicites » ou est absent.");
  const blocs = Array.isArray(p.blocs) ? p.blocs : [];
  if (!Array.isArray(p.blocs)) err("blocs", "« blocs » doit être une liste.");
  if (blocs.length > BLOCS_MAX) err("blocs", `${BLOCS_MAX} blocs au plus.`);

  const ids = new Set<string>();
  const existe = (id: unknown) => typeof id === "string" && ids.has(id);
  blocs.forEach((b, i) => {
    const id = txt((b as Bloc)?.id);
    if (!ID.test(id)) err(`blocs[${i}].id`, "Identifiant : minuscules, chiffres, - ou _ (40 au plus).");
    else if (ids.has(id)) err(`blocs[${i}].id`, `Identifiant « ${id} » utilisé deux fois.`);
    ids.add(id);
  });

  const cible = (chemin: string, vers: unknown, obligatoire = false) => {
    if (vers === undefined || vers === null || vers === "") {
      if (obligatoire) err(chemin, "Bloc de destination manquant.");
      return;
    }
    if (!existe(vers)) err(chemin, `Aucun bloc « ${String(vers)} ».`);
  };
  const longueur = (chemin: string, v: unknown, max: number, obligatoire = true) => {
    const s = txt(v);
    if (obligatoire && !s.trim()) err(chemin, "Champ vide.");
    else if (s.length > max) err(chemin, `${max} caractères au plus (${s.length}).`);
  };
  const url = (chemin: string, v: unknown) => {
    const s = txt(v).trim();
    if (!s) err(chemin, "Adresse vide.");
    else if (!URL_OK.test(s) && !MEDIA_AGENT.test(s)) err(chemin, "Adresse en https:// attendue (Meta refuse le reste), ou {audio_accueil} / {video_accueil}.");
  };
  const choix = (chemin: string, liste: unknown, max: number, maxTitre: number, obligatoire = true) => {
    const l = Array.isArray(liste) ? (liste as Choix[]) : [];
    if (obligatoire && !l.length) err(chemin, "Au moins un choix.");
    if (l.length > max) err(chemin, `${max} choix au plus (règle de Meta).`);
    const vus = new Set<string>();
    l.forEach((c, j) => {
      const cid = txt(c?.id);
      if (!ID.test(cid)) err(`${chemin}[${j}].id`, "Identifiant de choix invalide.");
      else if (vus.has(cid)) err(`${chemin}[${j}].id`, `Choix « ${cid} » en double.`);
      vus.add(cid);
      longueur(`${chemin}[${j}].titre`, c?.titre, maxTitre);
      if (c?.description) longueur(`${chemin}[${j}].description`, c.description, 72, false);
      cible(`${chemin}[${j}].vers`, c?.vers);
    });
  };

  blocs.forEach((b0, i) => {
    const b = b0 as Bloc;
    const c = `blocs[${i}]`;
    cible(`${c}.suite`, b?.suite);
    switch (b?.type) {
      case "texte":
        longueur(`${c}.texte`, b.texte, b.boutons?.length ? 1024 : 4096);
        choix(`${c}.boutons`, b.boutons, 3, 20, false);
        cible(`${c}.sinon`, b.sinon);
        break;
      case "image":
      case "video":
        url(`${c}.url`, b.url);
        if (b.boutons?.length) longueur(`${c}.legende`, b.legende, 1024);
        else if (b.legende) longueur(`${c}.legende`, b.legende, 1024, false);
        choix(`${c}.boutons`, b.boutons, 3, 20, false);
        cible(`${c}.sinon`, b.sinon);
        if (b.type === "video" && b.url && !MEDIA_AGENT.test(b.url) && !/\.(mp4|3gp)(\?|$)/i.test(b.url)) avert(`${c}.url`, "Meta n'accepte que les vidéos MP4 ou 3GP.");
        if (b.boutons?.length && MEDIA_AGENT.test(b.url || "")) err(`${c}.url`, "Un média de l'agent ne peut pas porter de boutons : mettez son adresse.");
        break;
      case "vocal":
        url(`${c}.url`, b.url);
        if (b.url && !MEDIA_AGENT.test(b.url) && !/\.(ogg|opus|mp3|m4a|aac|amr)(\?|$)/i.test(b.url)) avert(`${c}.url`, "Format audio inhabituel : préférez OGG (note vocale) ou MP3.");
        break;
      case "document": url(`${c}.url`, b.url); break;
      case "lien": url(`${c}.url`, b.url); if (b.texte) longueur(`${c}.texte`, b.texte, 3000, false); break;
      case "bouton_lien":
        longueur(`${c}.texte`, b.texte, 1024); longueur(`${c}.libelle`, b.libelle, 20); url(`${c}.url`, b.url); break;
      case "boutons":
        longueur(`${c}.texte`, b.texte, 1024);
        if (b.pied) longueur(`${c}.pied`, b.pied, 60, false);
        choix(`${c}.boutons`, b.boutons, 3, 20);
        cible(`${c}.sinon`, b.sinon);
        break;
      case "liste":
        longueur(`${c}.texte`, b.texte, 1024);
        longueur(`${c}.bouton`, b.bouton, 20);
        if (b.pied) longueur(`${c}.pied`, b.pied, 60, false);
        choix(`${c}.lignes`, b.lignes, 10, 24);
        cible(`${c}.sinon`, b.sinon);
        break;
      case "position":
        longueur(`${c}.texte`, b.texte, 1024);
        cible(`${c}.sinon`, b.sinon);
        break;
      case "reaction":
        if (!txt(b.emoji).trim() || txt(b.emoji).length > 8) err(`${c}.emoji`, "Un emoji.");
        break;
      case "pause": {
        const s = Number(b.secondes);
        if (!Number.isFinite(s) || s < 1 || s > PAUSE_MAX) err(`${c}.secondes`, `Entre 1 et ${PAUSE_MAX} secondes.`);
        break;
      }
      case "humain":
        if (b.message) longueur(`${c}.message`, b.message, 4096, false);
        if (b.attente) longueur(`${c}.attente`, b.attente, 4096, false);
        break;
      case "aller": cible(`${c}.vers`, b.vers, true); break;
      case "agent": case "silence": case "fin": break;
      default: err(`${c}.type`, `Type de bloc inconnu : « ${String((b as { type?: unknown })?.type)} ».`);
    }
  });

  const decl = Array.isArray(p.declencheurs) ? p.declencheurs : [];
  if (!Array.isArray(p.declencheurs)) err("declencheurs", "« declencheurs » doit être une liste.");
  decl.forEach((d, i) => {
    const c = `declencheurs[${i}]`;
    cible(`${c}.vers`, d?.vers, true);
    if (d?.type === "mot_cle") {
      const mots = Array.isArray(d.mots) ? d.mots.filter((m) => txt(m).trim()) : [];
      if (!mots.length) err(`${c}.mots`, "Au moins un mot-clé.");
      if (d.mode && !["commence", "contient", "exact"].includes(d.mode)) err(`${c}.mode`, "Mode : commence, contient ou exact.");
    } else if (d?.type === "bouton") {
      if (!ID.test(txt(d.id))) err(`${c}.id`, "Identifiant de bouton invalide.");
    } else if (d?.type !== "nouveau_contact") {
      err(`${c}.type`, "Déclencheur : nouveau_contact, mot_cle ou bouton.");
    }
  });
  if (!decl.some((d) => d?.type === "nouveau_contact")) avert("declencheurs", "Aucun accueil : un nouveau contact ira directement au comportement par défaut.");

  const defaut = p.par_defaut ?? "silence";
  if (defaut !== "silence" && defaut !== "agent" && !existe(defaut)) err("par_defaut", `« par_defaut » : silence, agent, ou un bloc existant (pas « ${defaut} »).`);

  // Une boucle sans attente enverrait des messages sans fin.
  if (!erreurs.length) {
    const typed = p as Parcours;
    for (const depart of typed.blocs) {
      const d = derouler(typed, depart.id);
      if (d.boucle) { err(`blocs[${typed.blocs.indexOf(depart)}]`, `Boucle sans fin à partir de « ${depart.id} » (ajoutez des boutons ou une fin).`); break; }
    }
  }

  return { ok: erreurs.length === 0, erreurs, avertissements };
}

// ── Le chemin : partagé par le moteur et l'aperçu ───────────────────────────

/** Minuscules, sans accents ni espaces superflus : « Docteur » = « docteur ». */
export function normaliser(s: string): string {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Le prénom tiré du nom de profil WhatsApp (« Jean-Paul K. » → « Jean-Paul »). */
export function prenomDe(nom: string | undefined | null): string {
  const n = String(nom || "").replace(/[^\p{L}\p{M}\s'-]/gu, " ").trim();
  return n.split(/\s+/)[0] || "";
}

/** Remplace {prenom}, {nom|défaut}… ; une variable vide sans défaut disparaît proprement. */
export function remplir(texte: string, vars: Record<string, string>): string {
  return String(texte || "")
    .replace(/\{(\w+)(?:\|([^}]*))?\}/g, (tout, cle: string, defaut?: string) => {
      const v = vars[cle.toLowerCase()];
      if (v) return v;
      return defaut !== undefined ? defaut : cle.toLowerCase() in vars ? "\u0000" : tout;
    })
    // Une variable vide ne laisse ni espace orphelin (« Bonjour , ») ni double espace.
    .replace(/ \u0000(?=[,.;:!?])/g, "")
    .replace(/ \u0000(?= )/g, "")
    .replace(/\u0000/g, "");
}

export type Message = { texte?: string; choixId?: string; position?: boolean };

/** Le déclencheur que ce message active, ou null. Les boutons passent avant les mots-clés. */
export function declencheurPour(p: Parcours, message: Message): Declencheur | null {
  if (message.choixId) {
    const b = p.declencheurs.find((d) => d.type === "bouton" && d.id === message.choixId);
    if (b) return b;
  }
  const t = normaliser(message.texte || "");
  if (!t) return null;
  for (const d of p.declencheurs) {
    if (d.type !== "mot_cle") continue;
    const mode = d.mode || "commence";
    for (const m of d.mots) {
      const mot = normaliser(m);
      if (!mot) continue;
      if (mode === "exact" ? t === mot : mode === "contient" ? t.includes(mot) : t.startsWith(mot)) return d;
    }
  }
  return null;
}

/**
 * Le choix du client sur un bloc à boutons : par identifiant (il a appuyé),
 * par le titre tapé à la main (« docteur » pour « Docteur »), ou par son numéro.
 */
export function choixPour(b: Bloc, message: Message): Choix | null {
  const liste = choixDe(b);
  if (!liste.length) return null;
  if (message.choixId) {
    const c = liste.find((x) => x.id === message.choixId);
    if (c) return c;
  }
  const t = normaliser(message.texte || "");
  if (!t) return null;
  return liste.find((x) => normaliser(x.titre) === t) || (/^\d+$/.test(t) ? liste[Number(t) - 1] || null : null);
}

export type EtatClient = { attente: string | null; mode: string | null };

/**
 * Où va ce message ? Dans l'ordre : la réponse aux boutons posés ; un
 * déclencheur (mot-clé, bouton) ; l'accueil d'un nouveau contact ; puis le
 * mode où il en était (l'IA, le silence) ou le comportement par défaut.
 */
export function aiguiller(p: Parcours, etat: EtatClient, message: Message, nouveau: boolean):
  { depart: string } | { mode: "agent" | "silence" } {
  const index = new Map(p.blocs.map((b) => [b.id, b]));
  if (etat.attente) {
    const b = index.get(etat.attente);
    if (b) {
      if (b.type === "position" && message.position) {
        const v = suivant(p, b);
        if (v) return { depart: v };
      }
      const c = choixPour(b, message);
      if (c) {
        const v = cibleDuChoix(p, b, c);
        if (v) return { depart: v };
      }
      const sinon = (b as { sinon?: string }).sinon;
      if (sinon && !declencheurPour(p, message)) return { depart: sinon };
    }
  }
  const d = declencheurPour(p, message);
  if (d) return { depart: d.vers };
  if (nouveau) {
    const accueil = p.declencheurs.find((x) => x.type === "nouveau_contact");
    if (accueil) return { depart: accueil.vers };
  }
  const mode = etat.mode || p.par_defaut || "silence";
  if (mode === "agent") return { mode: "agent" };
  if (mode === "silence" || mode === "fin") return { mode: "silence" };
  if (index.has(mode)) return { depart: mode };
  return { mode: "silence" };
}

export type Fin =
  | { type: "attente"; bloc: string }
  | { type: "agent" | "silence" | "fin" | "rien" }
  | { type: "humain"; bloc: string };

/**
 * Les blocs qui partent à la suite à partir de `depart`, jusqu'au premier qui
 * attend le client ou qui termine. Les pauses sont dans la liste : le moteur
 * les respecte, l'aperçu les affiche.
 */
export function derouler(p: Parcours, depart: string, max = 120): { blocs: Bloc[]; fin: Fin; boucle: boolean } {
  const index = new Map(p.blocs.map((b) => [b.id, b]));
  const blocs: Bloc[] = [];
  const vus = new Set<string>();
  let courant: string | null = depart;
  while (courant) {
    if (vus.has(courant) || blocs.length >= max) return { blocs, fin: { type: "rien" }, boucle: true };
    vus.add(courant);
    const b = index.get(courant);
    if (!b) break;
    if (b.type === "agent" || b.type === "silence" || b.type === "fin") return { blocs, fin: { type: b.type }, boucle: false };
    if (b.type === "humain") { blocs.push(b); return { blocs, fin: { type: "humain", bloc: b.id }, boucle: false }; }
    if (b.type !== "aller") blocs.push(b);
    if (attend(b)) return { blocs, fin: { type: "attente", bloc: b.id }, boucle: false };
    courant = suivant(p, b);
  }
  return { blocs, fin: { type: "rien" }, boucle: false };
}

// ── Modèles ─────────────────────────────────────────────────────────────────

export const MODELE_VIDE: Parcours = {
  schema: 1,
  nom: "Mon parcours",
  liens: "explicites",
  declencheurs: [{ type: "nouveau_contact", vers: "accueil" }],
  par_defaut: "agent",
  blocs: [
    { id: "accueil", type: "texte", texte: "Bonjour {prenom} 👋 Bienvenue chez {entreprise} !", suite: "ia" },
    { id: "ia", type: "agent" },
  ],
  ui: { positions: { "declencheur:0": { x: 0, y: 80 }, accueil: { x: 260, y: 60 }, ia: { x: 560, y: 60 } } },
};

const MEDIAS_NL = "https://storage.vps.buyticle.com/storage/v1/object/public/agent-media";

/**
 * L'accueil de No Limit, repris de son workflow n8n (v24) : mêmes textes,
 * mêmes vocaux, mêmes vidéos des centres, même mot-clé 2356 vers le docteur.
 * Ajouts : « Bonjour {prenom} » et un bouton « Parler au docteur ».
 */
export const MODELE_NOLIMIT: Parcours = {
  schema: 1,
  nom: "Accueil No Limit",
  declencheurs: [
    { type: "nouveau_contact", vers: "bienvenue" },
    { type: "mot_cle", mots: ["2356"], mode: "commence", vers: "docteur" },
    { type: "bouton", id: "docteur", vers: "docteur" },
  ],
  par_defaut: "silence",
  blocs: [
    {
      id: "bienvenue", type: "texte",
      texte:
        "Bonjour {prenom} 👋\n\n✨ *Bienvenue chez {entreprise}*\n\n" +
        "Vous êtes en relation avec notre *Service de Réception Client* de {entreprise}. " +
        "Nous sommes à votre entière disposition pour vous accompagner, centraliser vos demandes et faciliter l'ensemble de vos démarches.\n\n" +
        "👀 ÉCOUTEZ ATTENTIVEMENT CES DEUX VOCAUX EN DESSOUS ET CLIQUEZ SUR LE LIEN AVANT DE CONTINUER S'IL VOUS PLAÎT 👇🏽👇🏽",
    },
    { id: "pause_1", type: "pause", secondes: 3 },
    { id: "vocal_1", type: "vocal", url: "{audio_accueil}" },
    { id: "pause_2", type: "pause", secondes: 3 },
    { id: "vocal_2", type: "vocal", url: `${MEDIAS_NL}/voice/WhatsApp%20Audio%202026-07-03%20at%2017.37.51%20(1).ogg` },
    { id: "pause_3", type: "pause", secondes: 3 },
    { id: "video_pharmacie", type: "video", url: `${MEDIAS_NL}/video%20welcome/PHARMACIE.mp4`, legende: "UNE DE NOS PHARMACIES" },
    { id: "pause_4", type: "pause", secondes: 3 },
    { id: "lien_1", type: "lien", url: "https://nolimitcm.com/" },
    { id: "pause_5", type: "pause", secondes: 3 },
    { id: "video_douala", type: "video", url: `${MEDIAS_NL}/video%20welcome/Douala.mp4`, legende: "Centre de DOUALA\n🪀691808697 - 680393272" },
    { id: "pause_6", type: "pause", secondes: 3 },
    { id: "video_yaounde", type: "video", url: `${MEDIAS_NL}/video%20welcome/Yaounde.mp4`, legende: "Centre de YAOUNDE\nTéléphone : 652976259 - 🪀692276148" },
    { id: "pause_7", type: "pause", secondes: 3 },
    { id: "video_bafoussam", type: "video", url: `${MEDIAS_NL}/video%20welcome/Bafoussam1.mp4`, legende: "Centre de BAFOUSSAM\nTéléphone : 🪀696559987 - 681224693" },
    { id: "pause_8", type: "pause", secondes: 3 },
    {
      id: "menu", type: "boutons",
      texte: "Visitez notre site : https://nolimitcm.com/\n\nBesoin d'un avis médical ? Appuyez sur le bouton, ou écrivez 2356 suivi de votre question.",
      boutons: [{ id: "docteur", titre: "Parler au docteur", vers: "docteur" }],
      sinon: "silence",
    },
    {
      id: "docteur", type: "humain",
      message: "✅ Votre demande a bien été transmise à notre docteur.\n\nUn professionnel de santé va vous répondre directement ici sous peu. Merci de patienter. 🙏",
      attente: "✅ Votre message a bien été pris en charge par le docteur. Il vous répondra personnellement ici. 🙏",
      alerte: true,
    },
    { id: "silence", type: "silence" },
  ],
};
