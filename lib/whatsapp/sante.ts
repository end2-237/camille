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
import { libelleCreneau } from "./restaurant";
import { dejaReserve, proposer, reserver } from "@/lib/rendezvous";
import { etatMaintenant, heureLocale } from "@/lib/horaires";
import { prevenirCommercant, repondreBoutique } from "./boutique";
import {
  ETAT_VIDE, consigneSante, consigneServices, consignesDuTour, controler, detecter, etatSuivant, langueDe, reparer, seulementMecanique,
  repliUrgence, vocalCompris, type Bloc, type EtatSante, type FaitsCentre, type Sortie,
} from "./sante-regles";

// ── L'état de la conversation ───────────────────────────────────────────────

const MEMOIRE = new Map<string, { etat: EtatSante; t: number }>();
let etatEnPanne = false;

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
  } catch (e) {
    // Table absente ou droits manquants (migration_droits_app.sql) : on le dit
    // une fois, sinon l'agent oublie tout à chaque redémarrage sans que personne le sache.
    if (!etatEnPanne) console.error("[conversation] état non enregistré :", (e as Error).message);
    etatEnPanne = true;
  }
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
  medias: Map<string, { url: string; type: "video" | "audio" | "image"; legende?: string }>;
  pages: Map<string, string>;
  chiffres: string[];
  /** id du modèle → la prestation (nom, durée) : sert à réserver la bonne durée. */
  prestations: Map<string, { productId: string; nom: string; duree: number | null; prix: string }>;
  /** Les flyers et prospectus, dans l'ordre de la médiathèque. */
  flyers: string[];
};

/** Santé, ou beauté & services : même ossature, consigne et accueil différents. */
export type Profil = "sante" | "services";

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

  const medias = new Map<string, { url: string; type: "video" | "audio" | "image"; legende?: string }>();
  const descriptions: { id: string; description: string }[] = [];
  if (caps.welcome_video_url) {
    medias.set("video_centre", { url: String(caps.welcome_video_url), type: "video" });
    descriptions.push({ id: "video_centre", description: "la vidéo de présentation du centre" });
  }
  if (caps.welcome_audio_url) {
    medias.set("vocal_praticien", { url: String(caps.welcome_audio_url), type: "audio" });
    descriptions.push({ id: "vocal_praticien", description: "le message vocal du praticien, qui accueille et rassure" });
  }
  const liste = (Array.isArray(a.media) ? a.media : []) as { kind?: string; url: string; caption?: string }[];
  liste.filter((m) => m?.kind === "gallery").slice(0, 6).forEach((m, i) => {
    medias.set(`photo_${i + 1}`, { url: m.url, type: "image", legende: m.caption });
    descriptions.push({ id: `photo_${i + 1}`, description: m.caption || "une photo du centre" });
  });
  // Flyers, prospectus et fiches de services : partagés en carrousel interactif.
  const flyers: string[] = [];
  liste.filter((m) => m?.kind === "flyers" || m?.kind === "services").slice(0, 10).forEach((m, i) => {
    const id = `flyer_${i + 1}`;
    flyers.push(id);
    medias.set(id, { url: m.url, type: "image", legende: m.caption });
    descriptions.push({ id, description: `flyer : ${m.caption || "offre du moment"}` });
  });

  const pages = new Map<string, string>();
  if (agent.website_url) pages.set("site", agent.website_url);

  const produits = new Map<string, string>();
  const prestations = new Map<string, { productId: string; nom: string; duree: number | null; prix: string }>();
  const lignes: string[] = [];
  const chiffres = new Set<string>(["30", "24"]);
  try {
    // Les prestations d'un salon ou d'un plombier ne sont pas forcément dans
    // le catalogue WhatsApp : on les prend toutes, la fiche native seulement
    // quand elle existe.
    const r = await query(
      `SELECT id, name, price, COALESCE(currency,'XAF') AS currency, to_jsonb(p)->>'meta_retailer_id' AS retailer,
              (to_jsonb(p)->>'duree_min')::int AS duree
         FROM camille.products p
        WHERE agent_id = $1 AND COALESCE(active, true) AND COALESCE(stock, 1) > 0
        ORDER BY sort_order ASC, created_at DESC LIMIT 40`,
      [agent.id]
    );
    r.rows.forEach((p: { id: string; name: string; price: number | null; retailer: string | null; duree: number | null }, i: number) => {
      const id = `p${i + 1}`;
      if (p.retailer) produits.set(id, p.retailer);
      const prix = p.price != null && Number(p.price) > 0 ? `${Math.round(Number(p.price)).toLocaleString("fr-FR")} F` : "sur devis";
      prestations.set(id, { productId: p.id, nom: p.name, duree: p.duree, prix });
      lignes.push(`${id} ${p.name} — ${prix}${p.duree ? ` (${p.duree} min)` : ""}`);
      if (p.duree) chiffres.add(String(p.duree));
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
    produits, medias, pages, chiffres: [...chiffres], prestations, flyers,
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
          {
            title: "Choix",
            // 24 caractères pour le titre (règle de WhatsApp) ; le libellé
            // complet passe en description plutôt que d'être tronqué.
            rows: b.options.map((t, i) => ([...t].length > 24
              ? { id: `${ID}l${i}`, title: `${[...t].slice(0, 23).join("")}…`, description: [...t].slice(0, 72).join("") }
              : { id: `${ID}l${i}`, title: t })),
          },
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
        // Uniquement des créneaux LIBRES : jamais deux rendez-vous qui se
        // chevauchent (et la base refuse de toute façon). La durée est celle
        // de la prestation quand elle est connue.
        const prest = b.prestation ? bib.prestations.get(b.prestation) : undefined;
        const libres = await proposer(agent.id, agent.business_hours, prest?.duree || undefined, 9);
        if (!libres.length) {
          await meta.sendText(phone, etat.langue === "en"
            ? "Our calendar is full for the next days 🙏 I've passed your request to the team, who will reply here."
            : "Notre agenda est complet pour les prochains jours 🙏 Je transmets votre demande à l'équipe, qui vous répond ici.");
          await prevenirCommercant(ctx, { titre: `📅 Agenda complet — ${msg.contactName || "+" + phone} voulait un rendez-vous`, corps: prest?.nom || "", contenu: { kind: "rendez_vous", contact: phone } });
          trace = "[agenda complet]";
          break;
        }
        await meta.sendList(phone, b.texte, etat.langue === "en" ? "Pick a time" : "Choisir l'heure", [
          { title: etat.langue === "en" ? "Free times" : "Créneaux libres", rows: libres.map((d) => ({ id: `${ID}rdv:${d.getTime()}:${b.prestation || ""}`, title: libelleCreneau(d) })) },
        ]);
        trace = `${b.texte} [créneaux libres${prest ? ` · ${prest.nom}` : ""}]`;
        break;
      }
      case "flyers": {
        // Le carrousel : chaque flyer est une carte avec son image, son texte
        // et deux boutons. Un seul flyer : l'image puis les boutons.
        const ids = b.ids.filter((i) => bib.medias.has(i)).slice(0, 10);
        const boutons = (i: string) => [
          { id: `${ID}f:${i}:rdv`, title: etat.langue === "en" ? "📅 Book" : "📅 Réserver" },
          { id: `${ID}f:${i}:info`, title: etat.langue === "en" ? "ℹ️ More info" : "ℹ️ En savoir plus" },
        ];
        if (ids.length >= 2) {
          const r = await meta.sendMediaCarousel(phone, b.texte, ids.map((i) => ({
            image: bib.medias.get(i)!.url, texte: bib.medias.get(i)!.legende || bib.faits.centre, boutons: boutons(i),
          })));
          if (!r.ok) {
            console.warn(`[conversation] carrousel refusé (${r.error}) — envoi des images une à une`);
            for (const i of ids) await meta.sendImage(phone, bib.medias.get(i)!.url, bib.medias.get(i)!.legende || undefined);
            await meta.sendButtons(phone, b.texte, [boutons(ids[0])[0], { id: `${ID}b-info`, title: etat.langue === "en" ? "💬 A question" : "💬 Une question" }]);
          }
        } else if (ids.length === 1) {
          await meta.sendButtonsMedia(phone, { type: "image", url: bib.medias.get(ids[0])!.url }, `${b.texte}${bib.medias.get(ids[0])!.legende ? `\n\n${bib.medias.get(ids[0])!.legende}` : ""}`, boutons(ids[0]));
        }
        trace = `${b.texte} [flyers ${ids.join(", ")}]`;
        break;
      }
      case "demande_devis":
        // Toujours transmis : un complément (le quartier, une photo) arrivé
        // après la première demande doit aussi parvenir à l'équipe.
        await prevenirCommercant(ctx, {
          titre: `📝 Demande de devis — ${msg.contactName || "+" + phone}`,
          corps: b.resume.slice(0, 160),
          contenu: { kind: "devis", resume: b.resume, contact: phone, nom: msg.contactName || "" },
        }, { toujours: true });
        await meta.sendText(phone, b.texte);
        trace = `[devis transmis] ${b.texte}`;
        break;
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
function accueilSante(ctx: Contexte, bib: Bibliotheque, langue: "fr" | "en" | null, profil: Profil): Sortie {
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
    texteSecteur: profil === "sante" ? "Bienvenue chez {b} 🌿" : "Bienvenue chez {b} ✨",
    personnalise: agent.welcome_message,
  });
  const services = profil === "services";
  const texte = en
    ? `Hello${prenom ? ` ${prenom}` : ""} 🙏 Welcome to ${centre}.${pub}\n\nI'm Camille, the assistant${services ? ": I can show you our services, book you a slot or pass on a quote request" : " of the centre"}, and I'm here to answer you at any time, day or night. ${services ? "What can I do for you?" : "What brings you here?"}`
    : services
      ? `${salut}${pub}\n\nJe suis Camille, l'assistante : je vous présente nos prestations, je vous réserve un créneau ou je transmets votre demande de devis, à toute heure, de jour comme de nuit. Que puis-je faire pour vous ?`
      : `${salut}${pub}\n\nJe suis Camille, l'assistante du centre, et je suis là pour vous répondre à toute heure, de jour comme de nuit. Qu'est-ce qui vous amène ?`;
  const boutons = services
    ? en ? ["📅 Book a slot", "✨ Our services", "📝 Get a quote"] : ["📅 Prendre RDV", "✨ Nos prestations", "📝 Demander un devis"]
    : en ? ["📅 Book a visit", "🌿 See products", "💬 Talk about me"] : ["📅 Prendre RDV", "🌿 Voir produits", "💬 Parler de moi"];
  return {
    phase: "accueil",
    blocs: [{ type: "boutons", entete: bib.medias.has("video_centre") ? "video_centre" : null, texte, boutons }],
  };
}

// ── Les gestes sans ambiguïté : le code répond, pas le modèle ──────────────
//
// « Réserver », « Nos prestations », un flyer touché : la réponse attendue est
// toujours la même (les créneaux, la liste, les affiches). Le modèle la
// ratait une fois sur trois — une phrase et trois boutons au lieu des
// créneaux. Ici elle part à coup sûr, et sans appel au modèle.

const norme = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const VEUT_RDV = /\b(rdv|rendez[- ]?vous|reserver|reservation|creneau|creneaux|book|booking|appointment)\b/;
const VEUT_OFFRES = /\b(prestations?|services?|offres?|promos?|promotions?|flyers?|affiches?|tarifs?|catalogue|nouveautes)\b/;

/** La prestation nommée dans un texte (« une coupe homme », la légende d'un flyer). */
function prestationNommee(bib: Bibliotheque, texte: string): string | null {
  const t = norme(texte);
  let meilleur: { id: string; score: number } | null = null;
  for (const [id, p] of bib.prestations) {
    const mots = norme(p.nom).split(/[^a-z0-9]+/).filter((m) => m.length >= 4);
    const score = mots.filter((m) => t.includes(m)).length;
    if (score && (!meilleur || score > meilleur.score)) meilleur = { id, score };
  }
  return meilleur?.id ?? null;
}

/** La liste des prestations, pour choisir celle à réserver (sa durée compte). */
async function listePrestations(ctx: Contexte, bib: Bibliotheque, en: boolean, intro: string) {
  const { agent, phone } = ctx;
  const toutes = [...bib.prestations.entries()];
  const lignes = toutes.slice(0, toutes.length > 10 ? 9 : 10).map(([id, p]) => ({
    id: `${ID}p:${id}`,
    title: [...p.nom].length > 24 ? `${[...p.nom].slice(0, 23).join("")}…` : p.nom,
    description: [p.prix, p.duree ? `${p.duree} min` : ""].filter(Boolean).join(" · ").slice(0, 72),
  }));
  if (toutes.length > 10) lignes.push({ id: `${ID}p:`, title: en ? "Something else" : "Autre prestation", description: "" });
  await meta.sendList(phone, intro, en ? "Choose" : "Choisir", [{ title: en ? "Our services" : "Nos prestations", rows: lignes }]);
  await tracer(agent.id, phone, "assistant", `${intro} [prestations ${toutes.slice(0, 10).map(([, p]) => p.nom).join(" | ")}]`);
}

/** true si le geste a été traité ici. */
async function gesteDirect(ctx: Contexte, bib: Bibliotheque, etat: EtatSante, profil: Profil, texte: string): Promise<boolean> {
  const { msg } = ctx;
  const en = etat.langue === "en";
  const services = profil === "services";
  const choix = msg.choiceId || "";
  const t = norme(texte);
  const court = t.length <= 60;

  const creneaux = async (pid: string | null, intro?: string) => {
    const nom = pid ? bib.prestations.get(pid)?.nom : null;
    const s: Sortie = { blocs: [{
      type: "formulaire_rdv", prestation: pid || undefined,
      texte: intro || (en ? `Pick the time that suits you${nom ? ` for ${nom}` : ""} 👇 The team confirms here.` : `Choisissez le moment qui vous arrange${nom ? ` pour ${nom}` : ""} 👇 L'équipe vous confirme ici.`),
    }] };
    await envoyer(ctx, s, bib, etat);
    await ecrireEtat(ctx.agent.id, ctx.phone, etatSuivant(etat, s, { alerte: false, humain: false, vocalRate: null }));
    return true;
  };
  const choisirPrestation = async () => {
    await listePrestations(ctx, bib, en, en ? "Which service would you like to book? 👇" : "Quelle prestation souhaitez-vous réserver ? 👇");
    await ecrireEtat(ctx.agent.id, ctx.phone, { ...etat, accueilli: true });
    return true;
  };

  // Une prestation choisie dans la liste : ses créneaux, à sa durée.
  if (choix.startsWith(`${ID}p:`)) return creneaux(choix.slice(`${ID}p:`.length) || null);

  // « Réserver » sur une carte de flyer : la prestation du flyer si on la reconnaît.
  if (choix.startsWith(`${ID}f:`) && choix.endsWith(":rdv")) {
    const id = choix.split(":")[2];
    const pid = prestationNommee(bib, bib.medias.get(id)?.legende || "");
    if (pid || !services || bib.prestations.size <= 1) return creneaux(pid);
    return choisirPrestation();
  }
  if (choix.startsWith(`${ID}rdv:`) || choix.startsWith(`${ID}f:`)) return false;

  // « Prendre RDV », « je veux un rendez-vous (pour une coupe) ».
  // Annuler ou déplacer un rendez-vous n'est pas en prendre un : au modèle (et à l'équipe).
  if (court && VEUT_RDV.test(t) && !/\b(annul|deplac|report|decal|change)/.test(t)) {
    const pid = prestationNommee(bib, texte);
    if (pid || !services || bib.prestations.size <= 1) return creneaux(pid);
    return choisirPrestation();
  }

  // « Nos prestations », « vos offres », « les promos » : les flyers, sinon la liste.
  if (services && ((court && VEUT_OFFRES.test(t)) || (msg.type === "interactive" && /prestations|services/.test(t)))) {
    if (bib.flyers.length) {
      const s: Sortie = { blocs: [{ type: "flyers", ids: bib.flyers, texte: en ? "Here's what we offer right now 👇" : "Voici ce qu'on vous propose en ce moment 👇" }] };
      await envoyer(ctx, s, bib, etat);
      await ecrireEtat(ctx.agent.id, ctx.phone, etatSuivant(etat, s, { alerte: false, humain: false, vocalRate: null }));
      return true;
    }
    if (bib.prestations.size) {
      await listePrestations(ctx, bib, en, en ? "Here are our services 👇 Pick one to book it." : "Voici nos prestations 👇 Touchez-en une pour la réserver.");
      await ecrireEtat(ctx.agent.id, ctx.phone, { ...etat, accueilli: true });
      return true;
    }
  }
  return false;
}

// ── Le tour complet ─────────────────────────────────────────────────────────

/** L'agent santé & bien-être. */
export async function repondreSante(ctx: Contexte): Promise<void> {
  return repondreConversation(ctx, "sante");
}

/** L'agent beauté & services : salon, institut, plombier, dépannage, conseil. */
export async function repondreServices(ctx: Contexte): Promise<void> {
  return repondreConversation(ctx, "services");
}

async function repondreConversation(ctx: Contexte, profil: Profil): Promise<void> {
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

  const bib = await bibliotheque(ctx);

  // Réserver, voir les offres, un flyer touché : réponse du code, à coup sûr.
  if (!etatTour.alerte && !etatTour.humain && !msg.vocal && (await gesteDirect(ctx, bib, etatTour, profil, texte))) return;

  // Un créneau choisi : il est RÉSERVÉ (sans chevauchement possible), et
  // l'équipe le confirme depuis la section Rendez-vous.
  let entree: string;
  if (msg.choiceId?.startsWith(`${ID}rdv:`)) {
    const [ts, pid] = msg.choiceId.slice(`${ID}rdv:`.length).split(":");
    const quand = new Date(Number(ts));
    const prest = pid ? bib.prestations.get(pid) : undefined;
    const libelle = libelleCreneau(quand);
    const r = await reserver({
      agentId: agent.id, phone, nom: prenomClient(ctx) || msg.contactName || null, debut: quand,
      duree: prest?.duree || undefined, prestation: prest?.nom || null, productId: prest?.productId || null,
    });
    if (r.ok) {
      etatTour.rdv = quand.toISOString();
      await prevenirCommercant(ctx, {
        titre: `📅 Rendez-vous à confirmer — ${msg.contactName || "+" + phone}`,
        corps: `${libelle}${prest ? ` · ${prest.nom}` : ""} · à confirmer dans Rendez-vous`,
        contenu: { kind: "rendez_vous", id: r.rdv.id, quand: quand.toISOString(), libelle, contact: phone, nom: msg.contactName || "" },
      }, { toujours: true });
      entree = `CRÉNEAU RÉSERVÉ : ${libelle}${prest ? ` (${prest.nom})` : ""}. C'est une DEMANDE enregistrée : l'équipe la confirme ici sur WhatsApp. Remercie chaleureusement, dis que le créneau est bien noté et que l'équipe confirme ici très vite ; ne dis PAS « c'est confirmé » ni « nous vous attendons ». Propose la carte s'il ne l'a pas encore.`;
    } else if (r.raison === "pris" && (await dejaReserve(agent.id, phone, quand))) {
      // Il a touché deux fois le même créneau : c'est déjà le sien.
      entree = `CE CRÉNEAU (${libelle}) EST DÉJÀ RÉSERVÉ POUR CETTE PERSONNE (elle a touché deux fois). Rassure-la simplement : c'est bien noté, l'équipe confirme ici. Ne propose pas d'autres créneaux.`;
    } else if (r.raison === "pris") {
      entree = `LE CRÉNEAU ${libelle} VIENT D'ÊTRE PRIS par quelqu'un d'autre. Excuse-toi simplement et repropose des créneaux libres avec un bloc formulaire_rdv${pid ? ` (prestation ${pid})` : ""}.`;
    } else {
      entree = `Le créneau ${libelle} n'a pas pu être enregistré (${r.raison === "passe" ? "déjà passé" : "erreur technique"}). Repropose des créneaux avec un bloc formulaire_rdv.`;
    }
  } else if (msg.choiceId?.startsWith(`${ID}f:`)) {
    const [, id, quoi] = msg.choiceId.split(":");
    const legende = bib.medias.get(id)?.legende || "ce flyer";
    entree = quoi === "rdv"
      ? `FLYER CHOISI (« ${legende} ») : la personne veut RÉSERVER. Propose les créneaux libres (formulaire_rdv), avec la prestation correspondante si tu la reconnais dans la liste.`
      : `FLYER CHOISI (« ${legende} ») : la personne veut EN SAVOIR PLUS. Présente l'offre d'après la légende et les prestations connues, sans rien inventer, puis propose de réserver.`;
  } else if (msg.type === "interactive") {
    entree = `BOUTON TOUCHÉ : ${texte}`;
  } else if (msg.vocal) {
    entree = vocalRate ? `VOCAL MAL COMPRIS : « ${texte || "(rien d'exploitable)"} »` : `VOCAL : « ${texte} »`;
  } else {
    entree = `TEXTE : ${texte}`;
  }

  const fil = await historique(agent.id, phone);
  const premier = !etat.accueilli && !fil.slice(0, -1).some((m) => m.role === "assistant");
  if (!bib.medias.has("video_centre")) console.log(`[${profil}] agent ${agent.id} : pas de vidéo d'accueil trouvée`);

  // Nouveau contact qui dit juste bonjour : l'accueil est celui du code.
  if (premier && !etatTour.alerte && msg.type === "text" && SIMPLE_SALUT.test(texte.trim())) {
    const s = accueilSante(ctx, bib, etatTour.langue, profil);
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
    {
      role: "system",
      content: `${profil === "services" ? consigneServices({ ...bib.faits, metier: sectorProfile(agent.sector).label }) : consigneSante(bib.faits)}\n\nCONTEXTE — ${contexte}`,
    },
    ...fil.slice(0, -1),
    { role: "user", content: entree + (consignes.length ? `\n[CODE — consignes obligatoires de ce tour]\n- ${consignes.join("\n- ")}` : "") },
  ];

  const autorise = {
    medias: [...bib.medias.keys()], pages: [...bib.pages.keys()], produits: [...bib.prestations.keys()],
    chiffres: [...bib.chiffres, ...(texte.match(/\d{2,}/g) || [])],
  };
  let sortie: Sortie | null = null;
  for (let essai = 0; essai < 3; essai++) {
    const s = await demander(messages);
    if (!s) break;
    sortie = s;
    const defauts = controler(s, etatTour, autorise);
    if (!defauts.length) break;
    // Un défaut de forme seulement : reparer() le corrige sans redemander.
    if (seulementMecanique(defauts)) {
      console.log(`[${profil}] forme corrigée par le code :`, defauts.join(" ; "));
      break;
    }
    console.log(`[${profil}] réponse refusée (${essai + 1}) :`, defauts.join(" ; "));
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
