// ─────────────────────────────────────────────────────────────────────────────
// Le moteur des parcours WhatsApp (forfait Entreprise).
//
// Un agent qui a un parcours PUBLIÉ et ACTIF ne passe plus par le flux simple :
// chaque message entre d'abord ici. Le parcours accueille, montre ses médias,
// pose ses boutons, transfère au docteur — et ne rend la parole à l'IA de
// l'agent (santé, boutique…) que là où un bloc « agent » le prévoit.
//
// L'état de chaque client (bloc où il est attendu, mode, version) vit en base :
// il survit aux redéploiements. Un client au milieu d'un parcours republié
// garde son bloc s'il existe encore, sinon repart du comportement par défaut.
//
// Les règles du format sont dans lib/parcours-regles.ts (module pur, testé).
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";
import * as meta from "./meta";
import { prevenirCommercant } from "./boutique";
import type { Contexte } from "./handle";
import {
  MEDIA_AGENT, PAUSE_MAX, aiguiller, derouler, prenomDe, remplir, valider,
  type Bloc, type Choix, type Parcours,
} from "@/lib/parcours-regles";

type Publie = { version: number; parcours: Parcours };
type Etat = { version: number; attente: string | null; mode: string | null; vars: Record<string, unknown> } | null;
type Tracer = (agentId: string, phone: string, role: string, content: string) => Promise<void>;

/** Ce que le parcours a fait de ce message. */
export type Issue = "traite" | "deleguer" | "absent";

// ── Le parcours publié, gardé quelques secondes ─────────────────────────────

const CACHE = new Map<string, { valeur: Publie | null; expire: number }>();
const CACHE_MS = 20_000;

export function oublierParcours(agentId: string) {
  CACHE.delete(agentId);
}

/** Le parcours publié et actif de l'agent, ou null (pas de parcours, désactivé, migration absente). */
export async function parcoursPublie(agentId: string): Promise<Publie | null> {
  const c = CACHE.get(agentId);
  if (c && c.expire > Date.now()) return c.valeur;
  let valeur: Publie | null = null;
  try {
    const r = await query(
      `SELECT version, publie FROM camille.parcours WHERE agent_id = $1 AND actif AND publie IS NOT NULL`,
      [agentId]
    );
    const row = r.rows[0];
    // Revalidé à la lecture : un parcours modifié à la main en base ne doit
    // jamais faire planter la conversation.
    if (row && valider(row.publie).ok) valeur = { version: Number(row.version), parcours: row.publie as Parcours };
  } catch {
    valeur = null; // migration_parcours.sql pas encore passée : le flux simple continue
  }
  CACHE.set(agentId, { valeur, expire: Date.now() + CACHE_MS });
  return valeur;
}

// ── L'état du client ────────────────────────────────────────────────────────

async function lireEtat(agentId: string, phone: string): Promise<Etat> {
  const r = await query(
    `SELECT version, attente, mode, vars FROM camille.parcours_etats WHERE agent_id = $1 AND phone = $2`,
    [agentId, phone]
  );
  const row = r.rows[0];
  return row ? { version: Number(row.version), attente: row.attente, mode: row.mode, vars: row.vars || {} } : null;
}

async function ecrireEtat(agentId: string, phone: string, e: NonNullable<Etat>) {
  await query(
    `INSERT INTO camille.parcours_etats (agent_id, phone, version, attente, mode, vars, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
     ON CONFLICT (agent_id, phone) DO UPDATE
       SET version = EXCLUDED.version, attente = EXCLUDED.attente, mode = EXCLUDED.mode,
           vars = EXCLUDED.vars, updated_at = NOW()`,
    [agentId, phone, e.version, e.attente, e.mode, JSON.stringify(e.vars || {})]
  );
}

/** Pour tester : le numéro redevient un nouveau contact. */
export async function reinitialiserContact(agentId: string, phone: string): Promise<void> {
  await query(`DELETE FROM camille.parcours_etats WHERE agent_id = $1 AND phone = $2`, [agentId, phone]);
}

// ── L'agent : ce que le parcours ne sait pas seul ───────────────────────────

async function infosAgent(agentId: string): Promise<{ medias: Record<string, string>; proprietaire: string }> {
  try {
    const r = await query(
      `SELECT to_jsonb(a)->'capabilities' AS caps, to_jsonb(a)->>'owner_phone' AS owner
         FROM camille.agents a WHERE a.id = $1`,
      [agentId]
    );
    let caps = r.rows[0]?.caps;
    if (typeof caps === "string") { try { caps = JSON.parse(caps); } catch { caps = {}; } }
    return {
      medias: {
        audio_accueil: String(caps?.welcome_audio_url || "").trim(),
        video_accueil: String(caps?.welcome_video_url || "").trim(),
      },
      proprietaire: String(r.rows[0]?.owner || "").replace(/[^0-9]/g, ""),
    };
  } catch {
    return { medias: {}, proprietaire: "" };
  }
}

// ── L'exécution ─────────────────────────────────────────────────────────────

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Dernière alerte « un client écrit pendant le silence » (agent:téléphone → instant). */
const ALERTES_SILENCE = new Map<string, number>();

/**
 * Le message passe par le parcours de l'agent.
 *  - « absent »   : pas de parcours actif, le flux simple répond ;
 *  - « deleguer » : le parcours confie ce message à l'IA de l'agent ;
 *  - « traite »   : le parcours a répondu (ou s'est tu, volontairement).
 */
export async function executerParcours(ctx: Contexte, tracer: Tracer): Promise<Issue> {
  const { agent, msg, phone } = ctx;
  const pub = await parcoursPublie(agent.id);
  if (!pub) return "absent";
  const p = pub.parcours;
  const ids = new Set(p.blocs.map((b) => b.id));

  let etat: Etat;
  try {
    etat = await lireEtat(agent.id, phone);
  } catch (e) {
    console.error("[parcours] état illisible :", (e as Error).message);
    return "absent";
  }
  const nouveau = !etat;
  const e: NonNullable<Etat> = etat ? { ...etat } : { version: pub.version, attente: null, mode: null, vars: {} };
  // Republié entre-temps : un bloc attendu qui n'existe plus est oublié.
  if (e.version !== pub.version) {
    e.version = pub.version;
    if (e.attente && !ids.has(e.attente)) e.attente = null;
  }

  // Le chemin est décidé par le même code que le téléphone d'aperçu.
  const route = aiguiller(p, e, { texte: msg.text, choixId: msg.choiceId, position: msg.type === "location" }, nouveau);
  e.attente = null;
  if ("mode" in route) {
    e.mode = route.mode;
    await ecrireEtat(agent.id, phone, e).catch(() => {});
    if (route.mode === "agent") return "deleguer";
    alerterSilence(ctx);
    return "traite";
  }

  const { blocs, fin } = derouler(p, route.depart);
  const infos = await infosAgent(agent.id);
  const vars: Record<string, string> = {
    prenom: prenomDe(msg.contactName),
    nom: String(msg.contactName || "").trim(),
    entreprise: agent.business_name || "",
    telephone: `+${phone}`,
  };

  let pauseTotale = 0;
  for (const b of blocs) {
    if (b.type === "pause") {
      const s = Math.min(Math.max(Number(b.secondes) || 0, 0), PAUSE_MAX);
      if (pauseTotale + s <= 90) { pauseTotale += s; await dormir(s * 1000); }
    } else if (b.type === "humain") {
      await transfererHumain(ctx, b, vars, infos.proprietaire, tracer);
      e.vars = { ...e.vars, attente_envoyee: false, attente_message: b.attente || "" };
    } else {
      await envoyerBloc(ctx, b, vars, infos.medias, tracer);
    }
  }

  // Tant qu'un humain a la main, handle.ts fait taire Camille ; une fois la
  // main rendue, le comportement par défaut du parcours reprend (mode null).
  e.mode = fin.type === "agent" ? "agent" : fin.type === "silence" ? "silence" : null;
  if (fin.type === "attente") e.attente = fin.bloc;

  await ecrireEtat(agent.id, phone, e).catch((err) => console.error("[parcours] état non enregistré :", (err as Error).message));
  // Le parcours se tait sur la réponse d'un client connu : l'équipe doit le savoir.
  if (e.mode === "silence" && !nouveau && blocs.length === 0) alerterSilence(ctx);
  return fin.type === "agent" ? "deleguer" : "traite";
}

const boutonsMeta = (l: Choix[]) => l.map((c) => ({ id: c.id, title: c.titre }));
const titres = (l?: Choix[]) => (l?.length ? ` [${l.map((c) => c.titre).join(" | ")}]` : "");

/** Un bloc qui parle : texte, média, lien, boutons, liste, interaction. */
async function envoyerBloc(ctx: Contexte, b: Bloc, vars: Record<string, string>, medias: Record<string, string>, tracer: Tracer) {
  const to = ctx.phone;
  const t = (s?: string) => remplir(s || "", vars);
  const adresse = (u: string) => {
    const m = u.match(MEDIA_AGENT);
    return m ? medias[`${m[1]}_accueil`] || "" : u;
  };
  let r: meta.MetaResult = { ok: true };
  let trace = "";
  switch (b.type) {
    case "texte":
      r = b.boutons?.length ? await meta.sendButtons(to, t(b.texte), boutonsMeta(b.boutons)) : await meta.sendText(to, t(b.texte));
      trace = t(b.texte) + titres(b.boutons); break;
    case "image":
      r = b.boutons?.length
        ? await meta.sendButtonsMedia(to, { type: "image", url: adresse(b.url) }, t(b.legende), boutonsMeta(b.boutons))
        : await meta.sendImage(to, adresse(b.url), t(b.legende) || undefined);
      trace = `[image] ${b.url}${titres(b.boutons)}`; break;
    case "video": {
      const u = adresse(b.url);
      if (!u) return; // {video_accueil} non réglé : on passe
      // Au-delà de 16 Mo, Meta refuse la vidéo et le client ne reçoit RIEN.
      // En document (100 Mo admis), elle arrive quand même, à télécharger.
      const poids = await meta.tailleMedia(u);
      if (poids && poids > meta.MEDIA_MAX_OCTETS) {
        console.warn(`[parcours] vidéo « ${b.id} » de ${Math.round(poids / 1048576)} Mo : envoyée comme document`);
        r = await meta.sendDocument(to, u, u.split("/").pop()?.split("?")[0] || "video.mp4", t(b.legende) || undefined);
        if (r.ok && b.boutons?.length) r = await meta.sendButtons(to, t(b.legende) || "👆", boutonsMeta(b.boutons));
        trace = `[vidéo en document, ${Math.round(poids / 1048576)} Mo] ${b.url}${titres(b.boutons)}`;
        break;
      }
      r = b.boutons?.length
        ? await meta.sendButtonsMedia(to, { type: "video", url: u }, t(b.legende), boutonsMeta(b.boutons))
        : await meta.sendVideoRapide(to, u, t(b.legende) || undefined);
      trace = `[vidéo] ${b.url}${titres(b.boutons)}`; break;
    }
    case "position": r = await meta.sendLocationRequest(to, t(b.texte)); trace = `${t(b.texte)} [position demandée]`; break;
    case "reaction":
      if (!ctx.msg.messageId) return;
      r = await meta.sendReaction(to, ctx.msg.messageId, b.emoji); trace = `[réaction ${b.emoji}]`; break;
    case "vocal": {
      const u = adresse(b.url);
      if (!u) return; // {audio_accueil} non réglé : on passe
      r = await meta.sendAudioRapide(to, u); trace = `[vocal] ${b.url}`; break;
    }
    case "document":
      r = await meta.sendDocument(to, b.url, b.nom || b.url.split("/").pop() || "document.pdf", t(b.legende) || undefined);
      trace = `[document] ${b.url}`; break;
    case "lien": {
      const corps = b.texte ? `${t(b.texte)}\n${b.url}` : b.url;
      r = await meta.sendText(to, corps, true); trace = corps; break;
    }
    case "bouton_lien": r = await meta.sendCtaUrl(to, t(b.texte), b.libelle, b.url); trace = `${t(b.texte)} [${b.libelle}]`; break;
    case "boutons":
      r = await meta.sendButtons(to, t(b.texte), b.boutons.map((c) => ({ id: c.id, title: c.titre })), b.pied);
      trace = `${t(b.texte)} [${b.boutons.map((c) => c.titre).join(" | ")}]`; break;
    case "liste":
      r = await meta.sendList(to, t(b.texte), b.bouton, [{ title: b.bouton, rows: b.lignes.map((c) => ({ id: c.id, title: c.titre, description: c.description })) }], b.pied);
      trace = `${t(b.texte)} [liste : ${b.lignes.map((c) => c.titre).join(" | ")}]`; break;
    default: return;
  }
  if (!r.ok) console.error(`[parcours] bloc « ${b.id} » non envoyé à ${to} : ${r.error}`);
  await tracer(ctx.agent.id, to, "assistant", `[parcours:${b.id}] ${trace}`);
}

/** Le bloc « humain » : Camille se tait pour ce client, le commerçant est prévenu. */
async function transfererHumain(
  ctx: Contexte, b: Extract<Bloc, { type: "humain" }>, vars: Record<string, string>, proprietaire: string, tracer: Tracer
) {
  const { agent, msg, phone } = ctx;
  try {
    await query(
      `INSERT INTO camille.contacts (agent_id, phone, human_takeover, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       ON CONFLICT (agent_id, phone) DO UPDATE SET human_takeover = true, updated_at = NOW()`,
      [agent.id, phone]
    );
  } catch (e) {
    console.error("[parcours] reprise en main non enregistrée :", (e as Error).message);
  }
  const qui = msg.contactName || `+${phone}`;
  if (b.alerte !== false) {
    await prevenirCommercant(ctx, {
      titre: `Demande d'un humain — ${qui}`,
      corps: msg.text || "Un client demande à parler à quelqu'un.",
      contenu: { kind: "service_request", message: msg.text || "", contact: phone, name: msg.contactName || "" },
    }, { toujours: true }).catch(() => {});
    // Sur le téléphone du responsable, s'il en a un distinct du numéro du commerce.
    if (proprietaire && proprietaire !== phone) {
      await meta.sendText(
        proprietaire,
        `🔔 *Demande de ${qui}*\n📱 +${phone}\n💬 ${msg.text || "(sans texte)"}\n\nRépondez-lui directement : Camille se tait pour ce client.`
      ).catch(() => {});
    }
  }
  if (b.message) {
    const texte = remplir(b.message, vars);
    await meta.sendText(phone, texte);
    await tracer(agent.id, phone, "assistant", `[parcours:${b.id}] ${texte}`);
  }
}

/** Le commerçant sait qu'un client écrit pendant le silence (une alerte toutes les 10 min au plus). */
function alerterSilence(ctx: Contexte) {
  const { agent, msg, phone } = ctx;
  const cle = `${agent.id}:${phone}`;
  if (!agent.user_id || Date.now() - (ALERTES_SILENCE.get(cle) || 0) < 10 * 60_000) return;
  ALERTES_SILENCE.set(cle, Date.now());
  notifyUser(agent.user_id, "alerte", {
    title: `Message de ${msg.contactName || "+" + phone}`.slice(0, 90),
    body: `${msg.text || "(média)"} — le parcours laisse répondre l'équipe.`.slice(0, 160),
    data: { type: "message", agentId: agent.id, phone },
    channel: "alertes",
  }).catch(() => {});
}

/**
 * Le client écrit alors qu'un humain a la main : le message d'attente du bloc
 * « humain » part une fois (« pris en charge par le docteur »), pas à chaque message.
 */
export async function pendantHumain(ctx: Contexte, tracer: Tracer): Promise<void> {
  const pub = await parcoursPublie(ctx.agent.id);
  if (!pub) return;
  try {
    const e = await lireEtat(ctx.agent.id, ctx.phone);
    const texte = String(e?.vars?.attente_message || "");
    if (!e || !texte || e.vars.attente_envoyee) return;
    await meta.sendText(ctx.phone, texte);
    await tracer(ctx.agent.id, ctx.phone, "assistant", `[parcours:attente] ${texte}`);
    await ecrireEtat(ctx.agent.id, ctx.phone, { ...e, vars: { ...e.vars, attente_envoyee: true } });
  } catch (err) {
    console.error("[parcours] message d'attente non envoyé :", (err as Error).message);
  }
}
