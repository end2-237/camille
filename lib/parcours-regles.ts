// ─────────────────────────────────────────────────────────────────────────────
// Les parcours WhatsApp (forfait Entreprise) : le format, et ses règles.
//
// Un parcours est un fichier JSON que le commerçant écrit (blocs à l'écran ou
// JSON brut) et publie. Camille l'exécute à la place du flux simple : accueil
// scripté, médias, boutons, transfert à un humain — et l'IA de l'agent
// seulement là où le parcours l'appelle (bloc « agent »).
//
// Aucun code exécutable : seulement des blocs prévus. Après l'intrusion
// d'octobre 2026, c'est la règle.
//
// Module pur (aucune dépendance) : la page le charge pour valider avant
// d'enregistrer, le serveur pour valider avant de publier, les tests pour
// tout le reste.
// ─────────────────────────────────────────────────────────────────────────────

export type Choix = { id: string; titre: string; description?: string; vers?: string };

export type Bloc = { id: string; suite?: string } & (
  | { type: "texte"; texte: string }
  | { type: "image"; url: string; legende?: string }
  | { type: "video"; url: string; legende?: string }
  | { type: "vocal"; url: string }
  | { type: "document"; url: string; nom?: string; legende?: string }
  | { type: "lien"; url: string; texte?: string }
  | { type: "bouton_lien"; texte: string; libelle: string; url: string }
  | { type: "boutons"; texte: string; pied?: string; boutons: Choix[]; sinon?: string }
  | { type: "liste"; texte: string; bouton: string; pied?: string; lignes: Choix[]; sinon?: string }
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

export type Parcours = {
  schema: 1;
  nom?: string;
  declencheurs: Declencheur[];
  /** Un message hors parcours : « silence », « agent », ou l'identifiant d'un bloc. */
  par_defaut?: string;
  blocs: Bloc[];
};

export type Probleme = { chemin: string; message: string };

/** Les blocs proposés dans l'éditeur, dans l'ordre du menu. */
export const TYPES: { type: TypeBloc; libelle: string; aide: string }[] = [
  { type: "texte", libelle: "Texte", aide: "Variables : {prenom}, {nom}, {entreprise}, {telephone}. Valeur par défaut : {prenom|cher client}." },
  { type: "image", libelle: "Image", aide: "Adresse publique d'une image (JPG, PNG)." },
  { type: "video", libelle: "Vidéo", aide: "MP4, 16 Mo au plus, adresse publique." },
  { type: "vocal", libelle: "Vocal", aide: "OGG (s'affiche comme une note vocale) ou MP3. {audio_accueil} = le vocal réglé dans la configuration de l'agent." },
  { type: "document", libelle: "Document", aide: "PDF ou autre fichier, adresse publique." },
  { type: "lien", libelle: "Lien", aide: "Envoyé avec l'aperçu du site." },
  { type: "bouton_lien", libelle: "Bouton vers un site", aide: "Un bouton qui ouvre l'adresse." },
  { type: "boutons", libelle: "Boutons (3 au plus)", aide: "Le parcours attend la réponse du client." },
  { type: "liste", libelle: "Liste (10 choix au plus)", aide: "Le parcours attend la réponse du client." },
  { type: "pause", libelle: "Pause", aide: "Entre 1 et 15 secondes." },
  { type: "agent", libelle: "Laisser l'IA répondre", aide: "L'agent de Camille (santé, boutique…) répond à ce message et aux suivants." },
  { type: "humain", libelle: "Transférer à un humain", aide: "Camille se tait ; le commerçant est prévenu." },
  { type: "silence", libelle: "Se taire", aide: "Camille ne répond plus ; les messages restent dans la boîte de réception." },
  { type: "fin", libelle: "Fin", aide: "Les messages suivants vont au comportement par défaut." },
  { type: "aller", libelle: "Aller à un bloc", aide: "Continue au bloc indiqué." },
];

/** Blocs après lesquels le parcours s'arrête pour ce message. */
export const ATTENTE: TypeBloc[] = ["boutons", "liste"];
export const TERMINAUX: TypeBloc[] = ["agent", "humain", "silence", "fin"];

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

/** Le bloc qui suit `index` quand rien d'autre n'est indiqué. */
export function suivantImplicite(p: Pick<Parcours, "blocs">, index: number): string | null {
  return p.blocs[index + 1]?.id ?? null;
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
  const choix = (chemin: string, liste: unknown, max: number, maxTitre: number) => {
    const l = Array.isArray(liste) ? (liste as Choix[]) : [];
    if (!l.length) err(chemin, "Au moins un choix.");
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
      case "texte": longueur(`${c}.texte`, b.texte, 4096); break;
      case "image":
      case "video":
        url(`${c}.url`, b.url);
        if (b.legende) longueur(`${c}.legende`, b.legende, 1024, false);
        if (b.type === "video" && b.url && !MEDIA_AGENT.test(b.url) && !/\.(mp4|3gp)(\?|$)/i.test(b.url)) avert(`${c}.url`, "Meta n'accepte que les vidéos MP4 ou 3GP.");
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
    const typed = blocs as Bloc[];
    const index = new Map(typed.map((b, i) => [b.id, i]));
    for (let depart = 0; depart < typed.length; depart++) {
      const vus = new Set<number>();
      let i: number | null = depart;
      while (i !== null && i < typed.length) {
        if (vus.has(i)) { err(`blocs[${depart}]`, `Boucle sans fin à partir de « ${typed[depart].id} » (ajoutez des boutons ou une fin).`); break; }
        vus.add(i);
        const b: Bloc = typed[i];
        if (ATTENTE.includes(b.type) || TERMINAUX.includes(b.type)) break;
        const vers: string | undefined = b.type === "aller" ? b.vers : b.suite;
        i = vers ? index.get(vers) ?? null : i + 1 < typed.length ? i + 1 : null;
      }
      if (erreurs.length) break;
    }
  }

  return { ok: erreurs.length === 0, erreurs, avertissements };
}

// ── Exécution : ce qui ne dépend pas de WhatsApp ────────────────────────────

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

/** Le déclencheur que ce message active, ou null. Les boutons passent avant les mots-clés. */
export function declencheurPour(p: Parcours, message: { texte?: string; choixId?: string }): Declencheur | null {
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
 * Le choix du client sur un bloc boutons/liste : par identifiant (il a
 * appuyé), ou par le titre tapé à la main (« docteur » pour « Docteur »).
 */
export function choixPour(b: Bloc, message: { texte?: string; choixId?: string }): Choix | null {
  if (b.type !== "boutons" && b.type !== "liste") return null;
  const liste = b.type === "boutons" ? b.boutons : b.lignes;
  if (message.choixId) {
    const c = liste.find((x) => x.id === message.choixId);
    if (c) return c;
  }
  const t = normaliser(message.texte || "");
  if (!t) return null;
  return liste.find((x) => normaliser(x.titre) === t) || (/^\d+$/.test(t) ? liste[Number(t) - 1] || null : null);
}

// ── Modèles ─────────────────────────────────────────────────────────────────

export const MODELE_VIDE: Parcours = {
  schema: 1,
  nom: "Mon parcours",
  declencheurs: [{ type: "nouveau_contact", vers: "accueil" }],
  par_defaut: "agent",
  blocs: [
    { id: "accueil", type: "texte", texte: "Bonjour {prenom} 👋 Bienvenue chez {entreprise} !" },
    { id: "ia", type: "agent" },
  ],
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
