// ─────────────────────────────────────────────────────────────────────────────
// L'agent santé & bien-être sur WhatsApp officiel.
//
// Le modèle parle, le code garantit (voir sante-regles.ts). Un message passe
// en cinq temps :
//   1. recevoir (texte, vocal transcrit, bouton, créneau choisi) ;
//   2. détecter, AVANT le modèle : urgence, arrêt de traitement, demande d'une
//      personne, « robot ? », vocal mal compris → l'état et les consignes du tour ;
//   3. composer : le modèle répond en « blocs » (texte, boutons, vidéo, vocal,
//      lien vers le site, créneaux, fiches produits, carte) ;
//   4. contrôler, APRÈS le modèle : un défaut → il réécrit (deux fois au plus),
//      sinon le code répare ;
//   5. envoyer dans l'ordre, et retenir l'état pour le message suivant.
//
// Le panier, la livraison et la commande restent ceux de la boutique : dès que
// le client envoie un panier, c'est le parcours de commande qui prend la main.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import * as meta from "./meta";
import { tracer, sessionMeta, type Contexte } from "./handle";
import { messageAccueil, prenomDe } from "./accueil";
import { sectorProfile } from "@/lib/sectorProfiles";
import { creneaux, libelleCreneau } from "./restaurant";
import { etatMaintenant, heureLocale } from "@/lib/horaires";
import { prevenirCommercant, repondreBoutique } from "./boutique";
import {
  ETAT_VIDE, consigneSante, consignesDuTour, controler, detecter, etatSuivant, langueDe, reparer,
  repliUrgence, vocalCompris, type Bloc, type EtatSante, type FaitsCentre, type Sortie,
} from "./sante-regles";

// ── L'état de la conversation ───────────────────────────────────────────────

const MEMOIRE = new Map<string, { etat: EtatSante; t: number }>();

async function lireEtat(agentId: string, phone: string): Promise<EtatSante> {
  try {
    const r = await query(
      `SELECT etat FROM camille.conversation_etats WHERE agent_id = $1 AND phone = $2 AND updated_at > NOW() - INTERVAL '7 days'`,
      [agentId, phone]
    );
    if (r.rows[0]?.etat) return { ...ETAT_VIDE, ...(r.rows[0].etat as EtatSante) };
  } catch { /* migration_agent_sante.sql absente : la mémoire du processus suffit */ }
  const m = MEMOIRE.get(`${agentId}:${phone}`);
  return m && Date.now() - m.t < 7 * 86400_000 ? m.etat : { ...ETAT_VIDE };
}

async function ecrireEtat(agentId: string, phone: string, etat: EtatSante) {
  MEMOIRE.set(`${agentId}:${phone}`, { etat, t: Date.now() });
  try {
    await query(
      `INSERT INTO camille.conversation_etats (agent_id, phone, etat, updated_at) VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (agent_id, phone) DO UPDATE SET etat = EXCLUDED.etat, updated_at = NOW()`,
      [agentId, phone, JSON.stringify(etat)]
    );
  } catch { /* idem */ }
}

/** Les derniers échanges, tels que tracés : le fil que le modèle relit. */
async function historique(agentId: string, phone: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  try {
    const r = await query(
      `SELECT role, content FROM camille.agent_conversations
        WHERE session_name = $1 AND contact_phone = $2 AND role IN ('user','assistant','humain')
        ORDER BY created_at DESC LIMIT 14`,
      [sessionMeta(agentId), phone]
    );
    return r.rows.reverse().map((x: { role: string; content: string }) => ({
      role: x.role === "user" ? "user" : "assistant",
      content: String(x.content).slice(0, 600),
    }));
  } catch {
    return [];
  }
}

// ── Ce que le centre peut montrer ───────────────────────────────────────────

type Bibliotheque = {
  faits: FaitsCentre;
  /** id du modèle → retailer id Meta. */
  produits: Map<string, string>;
  medias: Map<string, { url: string; type: "video" | "audio" | "image" }>;
  pages: Map<string, string>;
  chiffres: string[];
};

async function bibliotheque(ctx: Contexte): Promise<Bibliotheque> {
  const { agent } = ctx;
  // to_jsonb : la colonne capabilities peut être du texte JSON selon les bases ;
  // un COALESCE avec un jsonb y échouait — et l'agent se croyait sans média.
  const a = (await query(
    `SELECT to_jsonb(a)->'capabilities' AS caps, to_jsonb(a)->'media' AS media FROM camille.agents a WHERE id = $1`,
    [agent.id]
  ).catch((e: Error) => { console.error("[santé] médias illisibles :", e.message); return { rows: [] }; })).rows[0] || {};
  const lire = (v: unknown): unknown => {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return null; }
  };
  const caps = ((lire(a.caps) as Record<string, unknown>) || {}) as Record<string, unknown>;
  a.media = lire(a.media);

  const medias = new Map<string, { url: string; type: "video" | "audio" | "image" }>();
  const descriptions: { id: string; description: string }[] = [];
  if (caps.welcome_video_url) {
    medias.set("video_centre", { url: String(caps.welcome_video_url), type: "video" });
    descriptions.push({ id: "video_centre", description: "la vidéo de présentation du centre" });
  }
  if (caps.welcome_audio_url) {
    medias.set("vocal_praticien", { url: String(caps.welcome_audio_url), type: "audio" });
    descriptions.push({ id: "vocal_praticien", description: "le message vocal du praticien, qui accueille et rassure" });
  }
  (Array.isArray(a.media) ? a.media : []).filter((m: { kind?: string }) => m?.kind === "gallery").slice(0, 6)
    .forEach((m: { url: string; caption?: string }, i: number) => {
      medias.set(`photo_${i + 1}`, { url: m.url, type: "image" });
      descriptions.push({ id: `photo_${i + 1}`, description: m.caption || "une photo du centre" });
    });

  const pages = new Map<string, string>();
  if (agent.website_url) pages.set("site", agent.website_url);

  const produits = new Map<string, string>();
  const lignes: string[] = [];
  const chiffres = new Set<string>(["30", "24"]);
  try {
    const r = await query(
      `SELECT name, price, COALESCE(currency,'XAF') AS currency, to_jsonb(p)->>'meta_retailer_id' AS retailer
         FROM camille.products p
        WHERE agent_id = $1 AND COALESCE(active, true) AND COALESCE(stock, 1) > 0
          AND to_jsonb(p)->>'meta_retailer_id' IS NOT NULL
        ORDER BY sort_order ASC, created_at DESC LIMIT 40`,
      [agent.id]
    );
    r.rows.forEach((p: { name: string; price: number | null; retailer: string }, i: number) => {
      const id = `p${i + 1}`;
      produits.set(id, p.retailer);
      const prix = p.price != null ? `${Math.round(Number(p.price)).toLocaleString("fr-FR")} F` : "prix sur demande";
      lignes.push(`${id} ${p.name} — ${prix}`);
      if (p.price != null) chiffres.add(String(Math.round(Number(p.price))));
      for (const n of p.name.match(/\d{2,}/g) || []) chiffres.add(n);
    });
  } catch { /* catalogue indisponible : le centre reste joignable */ }

  const texteFaits = `${agent.location || ""} ${agent.business_hours || ""}`;
  for (const n of texteFaits.match(/\d{2,}/g) || []) chiffres.add(n);

  return {
    faits: {
      centre: agent.business_name || "notre centre",
      adresse: agent.location || "adresse communiquée par l'équipe",
      horaires: agent.business_hours || "communiqués par l'équipe",
      praticien: String(caps.praticien || "").trim() || "l'équipe du centre",
      catalogue: lignes.join(" | "),
      medias: descriptions,
      pages: [...pages.keys()].map((id) => ({ id, description: "le site du centre (témoignages, présentation)" })),
    },
    produits, medias, pages, chiffres: [...chiffres],
  };
}

// ── Le modèle ───────────────────────────────────────────────────────────────

/**
 * Les fournisseurs, dans l'ordre. Le premier est celui de Camille (Groq) ; le
 * second, facultatif, prend le relais quand le premier sature ou refuse —
 * n'importe quel service compatible OpenAI (IA2_BASE_URL, IA2_KEY, IA2_MODEL).
 * Essayé avec Gemini : IA2_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai,
 * IA2_MODEL=gemini-3.1-flash-lite (1 s, format respecté).
 */
function fournisseurs(): { base: string; cle: string; modele: string }[] {
  const base = (process.env.IA_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const cle = process.env.IA_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
  const modeles = (process.env.IA_MODEL_SANTE || process.env.IA_MODEL || "openai/gpt-oss-120b,openai/gpt-oss-20b")
    .split(",").map((m) => m.trim()).filter(Boolean);
  const liste = cle ? modeles.map((modele) => ({ base, cle, modele })) : [];
  if (process.env.IA2_BASE_URL && process.env.IA2_KEY) {
    for (const m of (process.env.IA2_MODEL || "gpt-oss-120b").split(",").map((x) => x.trim()).filter(Boolean)) {
      liste.push({ base: process.env.IA2_BASE_URL.replace(/\/$/, ""), cle: process.env.IA2_KEY, modele: m });
    }
  }
  return liste;
}

async function demander(messages: { role: string; content: string }[]): Promise<Sortie | null> {
  for (const f of fournisseurs()) {
    try {
      const r = await fetch(`${f.base}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${f.cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: f.modele, messages, temperature: 0.4, max_tokens: 1400,
          response_format: { type: "json_object" },
          ...(f.modele.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
      });
      if (!r.ok) {
        console.warn(`[santé] ${f.modele} : HTTP ${r.status}`);
        continue;
      }
      const d = await r.json();
      const brut = d?.choices?.[0]?.message?.content;
      if (!brut) continue;
      const s = JSON.parse(String(brut).match(/\{[\s\S]*\}/)?.[0] || "{}") as Sortie & { message?: unknown; texte?: unknown };
      // Un bloc mal formé (une phrase nue) devient un texte ; une réponse sans
      // blocs mais avec un message aussi — le contrôle juge ensuite le fond.
      s.blocs = (Array.isArray(s.blocs) ? s.blocs : []).map((b) => (typeof b === "string" ? { type: "texte", texte: b } : b)) as Bloc[];
      const seul = typeof s.message === "string" ? s.message : typeof s.texte === "string" ? s.texte : "";
      if (!s.blocs.length && seul) s.blocs = [{ type: "texte", texte: seul }];
      return s;
    } catch (e) {
      console.warn(`[santé] ${f.modele} :`, (e as Error).message);
    }
  }
  return null;
}

// ── L'envoi ─────────────────────────────────────────────────────────────────

const ID = "s:";

async function envoyer(ctx: Contexte, s: Sortie, bib: Bibliotheque, etat: EtatSante): Promise<void> {
  const { agent, msg, phone } = ctx;
  for (const b of s.blocs) {
    let trace = "";
    switch (b.type) {
      case "reaction":
        if (msg.messageId) await meta.sendReaction(phone, msg.messageId, b.emoji || "🙏");
        trace = `[réaction ${b.emoji}]`;
        break;
      case "texte":
        await meta.sendText(phone, b.texte);
        trace = b.texte;
        break;
      case "boutons": {
        const boutons = b.boutons.map((t, i) => ({ id: `${ID}b${i}`, title: t }));
        const video = b.entete ? bib.medias.get(b.entete) : undefined;
        const r = video && video.type !== "audio"
          ? await meta.sendButtonsMedia(phone, { type: video.type, url: video.url }, b.texte, boutons)
          : await meta.sendButtons(phone, b.texte, boutons);
        if (!r.ok && video) {
          // En-tête refusé (vidéo trop lourde, lien privé…) : la vidéo part seule, puis les boutons.
          console.warn(`[santé] vidéo en en-tête refusée (${r.error}) — envoi séparé`);
          await meta.sendVideoRapide(phone, video.url, "");
          await meta.sendButtons(phone, b.texte, boutons);
        }
        trace = `${b.entete ? `[🎬 ${b.entete}] ` : ""}${b.texte} [${b.boutons.join(" | ")}]`;
        break;
      }
      case "liste":
        await meta.sendList(phone, b.texte, b.bouton || "Choisir", [
          { title: "Choix", rows: b.options.map((t, i) => ({ id: `${ID}l${i}`, title: t })) },
        ]);
        trace = `${b.texte} [${b.options.join(" | ")}]`;
        break;
      case "media": {
        const m = bib.medias.get(b.id);
        if (!m) break;
        if (m.type === "video") await meta.sendVideoRapide(phone, m.url, b.legende || "");
        else if (m.type === "audio") await meta.sendAudio(phone, m.url);
        else await meta.sendImage(phone, m.url, b.legende || undefined);
        if (m.type === "audio" && b.legende) await meta.sendText(phone, b.legende);
        trace = `[${b.id}] ${b.legende || ""}`;
        break;
      }
      case "lien_site": {
        const url = bib.pages.get(b.id);
        if (url) await meta.sendCtaUrl(phone, b.texte, b.bouton || "Voir", url);
        trace = `${b.texte} [lien ${b.id}]`;
        break;
      }
      case "formulaire_rdv": {
        // Les créneaux libres d'après les horaires ; le formulaire WhatsApp
        // natif (Flows) viendra remplacer cette liste.
        const libres = creneaux(agent.business_hours, new Date(), 1, 9, 60, 60);
        await meta.sendList(phone, b.texte, etat.langue === "en" ? "Pick a time" : "Choisir l'heure", [
          { title: etat.langue === "en" ? "Times" : "Créneaux", rows: libres.map((d) => ({ id: `${ID}rdv:${d.getTime()}`, title: libelleCreneau(d) })) },
        ]);
        trace = `${b.texte} [créneaux]`;
        break;
      }
      case "produits": {
        const ids = b.ids.map((i) => bib.produits.get(i)).filter((x): x is string => Boolean(x));
        if (ids.length === 1) await meta.sendProduct(phone, ids[0], b.texte);
        else if (ids.length) await meta.sendProductList(phone, agent.business_name || "Nos produits", b.texte, [{ title: "Sélection", retailerIds: ids }]);
        trace = `${b.texte} [produits ${b.ids.join(", ")}]`;
        break;
      }
      case "position_centre":
        if (agent.latitude != null && agent.longitude != null) {
          await meta.sendLocation(phone, Number(agent.latitude), Number(agent.longitude), agent.business_name || "", agent.location || "");
        } else if (agent.location) {
          await meta.sendText(phone, `📍 ${agent.location}`);
        }
        trace = "[📍 carte du centre]";
        break;
    }
    if (trace) await tracer(agent.id, phone, "assistant", trace.slice(0, 1000));
  }
}

// ── Le premier message : tenu par le code ───────────────────────────────────

/**
 * Le prénom à dire : celui du profil WhatsApp, sauf si ce profil porte le nom
 * du commerce lui-même (le commerçant qui se teste, un compte d'entreprise).
 */
function prenomClient(ctx: Contexte): string {
  const p = prenomDe(ctx.msg.contactName);
  const commerce = String(ctx.agent.business_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return p && !commerce.split(/[^a-z0-9]+/).includes(p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? p : "";
}

const SIMPLE_SALUT = /^(bonjour|bonsoir|salut|slt|bjr|bsr|cc|coucou|hello|hi|hey|allo|info|infos|good (morning|afternoon|evening)|yo|svp|[?.!👋🙏]+)[\s!?.,👋🙏]*$/i;

/**
 * L'accueil d'un nouveau contact qui dit simplement bonjour : la vidéo du
 * centre au-dessus des boutons (si elle existe), son prénom, le centre,
 * Camille qui se présente et dit qu'elle est là à toute heure. Écrit par le
 * code : c'est la première impression, elle ne dépend pas de l'humeur du modèle.
 */
function accueilSante(ctx: Contexte, bib: Bibliotheque, langue: "fr" | "en" | null): Sortie {
  const { agent, msg } = ctx;
  const centre = agent.business_name || "notre centre";
  const prenom = prenomClient(ctx);
  const en = langue === "en";
  const pub = msg.referral?.headline
    ? en ? ` You saw our video « ${msg.referral.headline.slice(0, 80)} » — you're in the right place.`
         : ` Vous avez vu notre vidéo « ${msg.referral.headline.slice(0, 80)} » : vous êtes au bon endroit.`
    : "";
  const salut = messageAccueil({
    nomProfil: prenom,
    heure: heureLocale(new Date(), Number((agent as { utc_offset?: number }).utc_offset ?? 1)),
    commerce: centre,
    texteSecteur: "Bienvenue chez {b} 🌿",
    personnalise: agent.welcome_message,
  });
  const texte = en
    ? `Hello${prenom ? ` ${prenom}` : ""} 🙏 Welcome to ${centre}.${pub}\n\nI'm Camille, the centre's assistant, and I'm here to answer you at any time, day or night. What brings you here?`
    : `${salut}${pub}\n\nJe suis Camille, l'assistante du centre, et je suis là pour vous répondre à toute heure, de jour comme de nuit. Qu'est-ce qui vous amène ?`;
  return {
    phase: "accueil",
    blocs: [{
      type: "boutons",
      entete: bib.medias.has("video_centre") ? "video_centre" : null,
      texte,
      boutons: en ? ["📅 Book a visit", "🌿 See products", "💬 Talk about me"] : ["📅 Prendre RDV", "🌿 Voir produits", "💬 Parler de moi"],
    }],
  };
}

// ── Le tour complet ─────────────────────────────────────────────────────────

export async function repondreSante(ctx: Contexte): Promise<void> {
  const { agent, msg, phone } = ctx;

  // Le panier et tout ce qui le suit (quartier, heure, confirmation) : c'est la
  // boutique qui sait faire, on ne refait pas une commande « à la parole ».
  if (msg.type === "order" || msg.type === "location" || (msg.type === "interactive" && msg.choiceId && !msg.choiceId.startsWith(ID))) {
    return repondreBoutique(ctx, "boutique");
  }

  let etat = await lireEtat(agent.id, phone);
  const texte = msg.text || "";
  if (!etat.langue && texte.trim().length >= 3) etat = { ...etat, langue: langueDe(texte) };
  const vu = detecter(texte);
  const vocalRate = msg.vocal ? !vocalCompris(texte) : null;

  // Les états verrouillés passent AVANT le modèle, et l'équipe est prévenue une fois.
  if (vu.alerte && !etat.alerte) {
    await prevenirCommercant(ctx, {
      titre: `🚨 Urgence signalée — ${msg.contactName || "+" + phone}`,
      corps: texte.slice(0, 140) || "Message vocal",
      contenu: { kind: "urgence", message: texte, contact: phone },
    });
  }
  if (vu.humain && !etat.humain) {
    await prevenirCommercant(ctx, {
      titre: `${msg.contactName || "+" + phone} veut parler à quelqu'un`,
      corps: texte.slice(0, 140),
      contenu: { kind: "humain", message: texte, contact: phone },
    });
  }
  const etatTour: EtatSante = {
    ...etat,
    alerte: etat.alerte || vu.alerte,
    humain: etat.humain || vu.humain,
    echecsVocal: vocalRate ? etat.echecsVocal + 1 : etat.echecsVocal,
  };

  // Un créneau choisi : on note la demande, l'équipe confirme.
  let entree: string;
  if (msg.choiceId?.startsWith(`${ID}rdv:`)) {
    const quand = new Date(Number(msg.choiceId.slice(`${ID}rdv:`.length)));
    const libelle = libelleCreneau(quand);
    etatTour.rdv = quand.toISOString();
    await prevenirCommercant(ctx, {
      titre: `📅 Demande de rendez-vous — ${msg.contactName || "+" + phone}`,
      corps: `${libelle} · à confirmer au client sur WhatsApp`,
      contenu: { kind: "rendez_vous", quand: quand.toISOString(), libelle, contact: phone, nom: msg.contactName || "" },
    });
    entree = `CRÉNEAU CHOISI : ${libelle}. C'est une DEMANDE : l'équipe la confirme ici sur WhatsApp. Remercie chaleureusement, dis que la demande est bien notée pour ${libelle} et que l'équipe confirme ici très vite ; ne dis PAS « nous vous attendons » tant que ce n'est pas confirmé. Propose la carte du centre et le vocal s'ils n'ont pas encore été envoyés.`;
  } else if (msg.type === "interactive") {
    entree = `BOUTON TOUCHÉ : ${texte}`;
  } else if (msg.vocal) {
    entree = vocalRate ? `VOCAL MAL COMPRIS : « ${texte || "(rien d'exploitable)"} »` : `VOCAL : « ${texte} »`;
  } else {
    entree = `TEXTE : ${texte}`;
  }

  const bib = await bibliotheque(ctx);
  const fil = await historique(agent.id, phone);
  const premier = !etat.accueilli && !fil.slice(0, -1).some((m) => m.role === "assistant");
  if (!bib.medias.has("video_centre")) console.log(`[santé] agent ${agent.id} : pas de vidéo d'accueil trouvée`);

  // Nouveau contact qui dit juste bonjour : l'accueil est celui du code.
  if (premier && !etatTour.alerte && msg.type === "text" && SIMPLE_SALUT.test(texte.trim())) {
    const s = accueilSante(ctx, bib, etatTour.langue);
    await envoyer(ctx, s, bib, etatTour);
    await ecrireEtat(agent.id, phone, etatSuivant(etatTour, s, { alerte: false, humain: false, vocalRate }));
    return;
  }
  const contexte = [
    `Prénom (profil WhatsApp) : ${prenomClient(ctx) || "(aucun prénom lisible : ne nomme pas la personne)"}.`,
    msg.referral?.headline || msg.referral?.body
      ? `Vient de la publicité : « ${[msg.referral.headline, msg.referral.body].filter(Boolean).join(" — ").slice(0, 200)} ».`
      : "",
    etatMaintenant(agent.business_hours, Number((agent as { utc_offset?: number }).utc_offset ?? 1)) ||
      `Heure locale : ${new Date().toLocaleTimeString("fr-FR", { timeZone: "Africa/Douala", hour: "2-digit", minute: "2-digit" })}.`,
    etat.sujet ? `Sujet déjà évoqué : ${etat.sujet}.` : "",
    etat.rdv ? `Rendez-vous demandé : ${libelleCreneau(new Date(etat.rdv))}.` : "",
  ].filter(Boolean).join(" ");

  const consignes = consignesDuTour(texte, etatTour, bib.faits.praticien, msg.vocal ? { compris: !vocalRate } : undefined);
  // Un seul message système : certains fournisseurs (Gemini) ne lisent pas
  // correctement plusieurs consignes système et perdent alors le format.
  let messages = [
    { role: "system", content: `${consigneSante(bib.faits)}\n\nCONTEXTE — ${contexte}` },
    ...fil.slice(0, -1),
    { role: "user", content: entree + (consignes.length ? `\n[CODE — consignes obligatoires de ce tour]\n- ${consignes.join("\n- ")}` : "") },
  ];

  const autorise = {
    medias: [...bib.medias.keys()], pages: [...bib.pages.keys()], produits: [...bib.produits.keys()],
    chiffres: [...bib.chiffres, ...(texte.match(/\d{2,}/g) || [])],
  };
  let sortie: Sortie | null = null;
  for (let essai = 0; essai < 3; essai++) {
    const s = await demander(messages);
    if (!s) break;
    sortie = s;
    const defauts = controler(s, etatTour, autorise);
    if (!defauts.length) break;
    console.log(`[santé] réponse refusée (${essai + 1}) :`, defauts.join(" ; "));
    messages = [
      ...messages,
      { role: "assistant", content: JSON.stringify(s) },
      { role: "user", content: `[CODE] Réponse refusée. Corrige et renvoie le JSON complet : ${defauts.join(" ; ")}` },
    ];
  }

  // Aucun modèle joignable : une réponse sûre plutôt que le silence.
  if (!sortie) {
    sortie = etatTour.alerte
      ? { blocs: [{ type: "texte", texte: repliUrgence(etatTour.langue) }], humain: true }
      : {
          blocs: [{
            type: "boutons", entete: null,
            texte: etatTour.langue === "en"
              ? "I'm here 🙏 Tell me what brings you, or choose below."
              : "Je suis là 🙏 Dites-moi ce qui vous amène, ou choisissez ci-dessous.",
            boutons: etatTour.langue === "en" ? ["📅 Book a visit", "🌿 See products", "💬 Talk to someone"] : ["📅 Prendre RDV", "🌿 Voir produits", "💬 Une personne"],
          }],
        };
  }
  sortie = reparer(sortie, etatTour, repliUrgence(etatTour.langue));
  // Première réponse à une vraie question : la vidéo du centre vient quand même en tête.
  if (premier && !etatTour.alerte && bib.medias.has("video_centre")) {
    const b = sortie.blocs.find((x) => x.type === "boutons") as Extract<Bloc, { type: "boutons" }> | undefined;
    if (b) b.entete = "video_centre";
    else sortie.blocs = [{ type: "media", id: "video_centre", legende: "" } as Bloc, ...sortie.blocs].slice(0, 3);
  }
  if (sortie.humain && !etatTour.humain) {
    await prevenirCommercant(ctx, {
      titre: `${msg.contactName || "+" + phone} attend une personne`,
      corps: texte.slice(0, 140),
      contenu: { kind: "humain", message: texte, contact: phone },
    });
  }

  await envoyer(ctx, sortie, bib, etatTour);
  await ecrireEtat(agent.id, phone, etatSuivant(etatTour, sortie, { alerte: vu.alerte, humain: vu.humain, vocalRate }));
}
