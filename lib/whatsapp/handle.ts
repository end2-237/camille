// ─────────────────────────────────────────────────────────────────────────────
// L'entrée unique d'un message Meta, et l'aiguillage par secteur.
//
// C'est ici que se règle la demande « le workflow doit s'adapter selon que
// l'agent est en mode restaurant, boutique ou autre ». L'adaptation n'est pas
// réinventée : elle vient de `lib/sectorProfiles.ts`, qui est déjà la source
// unique du comportement par secteur dans Camille.
//
//   mode "catalogue" + sert des repas  → restaurant
//   mode "catalogue"                   → boutique
//   mode "services"                    → prestations (devis / rendez-vous)
//   mode "media"                       → prospection par visuels
//
// Rien de ce fichier ne tourne pour un client existant : on n'y arrive que par
// le webhook Meta, et seul le numéro de test y est abonné.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { sectorProfile, sertDesRepas } from "@/lib/sectorProfiles";
import * as meta from "./meta";
import { avecAgent } from "./identifiants";
import { etatQuota } from "@/lib/quota";
import { repondreBoutique } from "./boutique";
import { transcrire, VOCAL_MAX_OCTETS } from "./voix";

export type IncomingMessage = {
  messageId: string;
  from: string;
  phoneNumberId: string;
  contactName?: string;
  type: "text" | "interactive" | "order" | "location" | "image" | "audio" | "unsupported";
  text: string;
  /** Identifiant du bouton ou de la ligne de liste choisie. */
  choiceId?: string;
  /** Panier natif WhatsApp. */
  order?: {
    catalogId: string;
    items: { retailerId: string; quantity: number; price: number; currency: string }[];
    note?: string;
  };
  location?: { lat: number; lng: number };
  mediaId?: string;
  /** Format du média reçu (vocal : audio/ogg; codecs=opus). */
  mime?: string;
  /** Le message était un vocal : `text` est sa transcription. */
  vocal?: boolean;
  rawType?: string;
  timestamp?: number;
};

export type Agent = {
  id: string;
  user_id: string;
  business_name: string;
  sector: string | null;
  location: string | null;
  business_hours: string | null;
  delivery_fee: number | null;
  delivery_enabled: boolean;
  currency: string | null;
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Ce qu'une réponse sectorielle reçoit pour travailler. */
export type Contexte = {
  agent: Agent;
  msg: IncomingMessage;
  /** Numéro du client, chiffres seuls. */
  phone: string;
};

// ── Résolution de l'agent ───────────────────────────────────────────────────

/**
 * Quel agent est concerné par ce message ?
 *
 * À terme, la correspondance se fait par `phone_number_id` : chaque marchand a
 * le sien. Tant que la colonne n'existe pas, `META_TEST_AGENT_ID` permet de
 * tester sur son propre numéro sans imposer une migration — donc sans toucher
 * à la base que les clients utilisent.
 */
async function trouverAgent(phoneNumberId: string): Promise<Agent | null> {
  // Seules les colonnes garanties sont lues directement. Tout ce qui est arrivé
  // par une migration passe par to_jsonb : sur une base qui ne l'a pas, on
  // récupère NULL au lieu de perdre TOUTE la requête — donc l'agent, donc le
  // message. `currency` n'existe pas sur camille.agents : la lire en direct
  // faisait échouer la résolution de l'agent, et donc taire l'agent entier.
  const champs = `
    a.id, a.user_id, a.business_name, a.sector, a.location, a.website_url,
    a.latitude, a.longitude,
    COALESCE(to_jsonb(a)->>'currency', 'XAF')                   AS currency,
    to_jsonb(a)->>'business_hours'                              AS business_hours,
    (to_jsonb(a)->>'delivery_fee')::numeric                     AS delivery_fee,
    COALESCE((to_jsonb(a)->>'delivery_enabled')::boolean, true)  AS delivery_enabled`;

  // Un agent ne répond par Meta que s'il est ACTIF et marqué `transport='meta'`.
  // Sans ce second filtre, un agent resté sur camille-core mais qui garde un
  // meta_phone_number_id répondrait aussi par Meta — deux réponses au client.
  const eligible = `a.status = 'active' AND COALESCE(to_jsonb(a)->>'transport', 'core') = 'meta'`;

  // 1. Par le numéro Meta qui a reçu le message : le seul critère sûr dès
  //    qu'il y a plusieurs marchands.
  try {
    const r = await query(
      `SELECT ${champs} FROM camille.agents a
        WHERE to_jsonb(a)->>'meta_phone_number_id' = $1 AND ${eligible} LIMIT 1`,
      [phoneNumberId]
    );
    if (r.rows.length) return r.rows[0] as Agent;
  } catch { /* colonne absente : on passe au repli */ }

  // 2. Repli de test, explicite et temporaire. Il ne sert QUE le numéro de
  //    l'application (PHONE_NUMBER_ID) : un message arrivé sur le numéro d'un
  //    autre marchand ne doit jamais être répondu par l'agent de test.
  const test = process.env.META_TEST_AGENT_ID;
  if (!test) return null;
  if (phoneNumberId && process.env.PHONE_NUMBER_ID && phoneNumberId !== process.env.PHONE_NUMBER_ID) {
    return null;
  }
  try {
    const r = await query(
      `SELECT ${champs} FROM camille.agents a WHERE a.id = $1 AND ${eligible} LIMIT 1`,
      [test]
    );
    return (r.rows[0] as Agent) || null;
  } catch {
    return null;
  }
}

/**
 * Un humain a-t-il pris la main sur ce client ?
 *
 * Même règle que le nœud « Humain en cours ? » du workflow : quand le
 * commerçant répond lui-même, l'agent se tait. Répondre par-dessus un humain
 * est pire que ne pas répondre.
 */
async function humainEnCours(agentId: string, phone: string): Promise<boolean> {
  try {
    const r = await query(
      `SELECT COALESCE(human_takeover, false) AS h
         FROM camille.contacts WHERE agent_id = $1 AND phone = $2 LIMIT 1`,
      [agentId, phone]
    );
    return Boolean(r.rows[0]?.h);
  } catch {
    return false; // colonne ou table absente : on ne bâillonne pas l'agent
  }
}

/** Le nom de session sous lequel cet agent parle via Meta. */
export const sessionMeta = (agentId: string) => `meta:${agentId}`;

/**
 * La conversation, pour l'historique et les statistiques.
 *
 * `camille.agent_conversations` n'a PAS de colonne agent_id : tout est rattaché
 * par `session_name`, que les statistiques joignent à
 * `camille.whatsapp_sessions`. Écrire un agent_id ici faisait échouer
 * l'insertion en silence — et l'historique de la conversation disparaissait.
 */
async function tracer(agentId: string, phone: string, role: string, content: string) {
  try {
    await query(
      `INSERT INTO camille.agent_conversations (session_name, contact_phone, role, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [sessionMeta(agentId), phone, role, content.slice(0, 4000)]
    );
  } catch (e) {
    // La trace ne doit jamais empêcher la réponse — mais on dit pourquoi.
    console.error("[meta] trace non enregistrée :", (e as Error).message);
  }
}

/**
 * Rattache le nom de session Meta à l'agent, une fois.
 *
 * Sans ce lien, les conversations sont « orphelines » : le tableau de bord et
 * /api/stats les cherchent via whatsapp_sessions et ne les trouvent pas. Le
 * diagnostic des statistiques signale déjà ce cas — autant ne pas le créer.
 */
async function lierSession(agentId: string) {
  const nom = sessionMeta(agentId);
  try {
    const r = await query(
      "SELECT 1 FROM camille.whatsapp_sessions WHERE session_name = $1 LIMIT 1",
      [nom]
    );
    if (r.rows.length) return;
    await query(
      "INSERT INTO camille.whatsapp_sessions (agent_id, session_name) VALUES ($1, $2)",
      [agentId, nom]
    );
  } catch (e) {
    console.error("[meta] session non liée :", (e as Error).message);
  }
}

// ── L'aiguillage ────────────────────────────────────────────────────────────

/** Le mode de conversation effectif de cet agent. */
export function modeDeVente(agent: Agent): "restaurant" | "boutique" | "services" | "media" {
  const p = sectorProfile(agent.sector);
  if (p.mode === "services") return "services";
  if (p.mode === "media") return "media";
  return sertDesRepas(agent.sector) ? "restaurant" : "boutique";
}

// ── Anti-doublon ────────────────────────────────────────────────────────────
//
// Meta peut livrer deux fois le même message. Sans garde, un panier relivré
// produisait une seconde commande et décomptait le stock une seconde fois.
// L'identifiant du message (wamid) est réservé en base AVANT tout traitement :
// le second passage le trouve déjà pris et s'arrête. La base est la seule
// mémoire qui survit à un redéploiement ; la mémoire locale ne sert que de
// filet si la table n'existe pas encore (migration_meta_inbound.sql).

const VUS_LOCAL = new Map<string, number>();
const VUS_TTL_MS = 24 * 3600 * 1000;
let derniereRaz = 0;

function dejaVuLocal(wamid: string): boolean {
  const maintenant = Date.now();
  if (VUS_LOCAL.size > 5000) {
    for (const [k, t] of VUS_LOCAL) if (maintenant - t > VUS_TTL_MS) VUS_LOCAL.delete(k);
  }
  if (VUS_LOCAL.has(wamid)) return true;
  VUS_LOCAL.set(wamid, maintenant);
  return false;
}

/** true si ce message a DÉJÀ été pris en charge (et ne doit pas l'être à nouveau). */
export async function dejaTraite(wamid: string): Promise<boolean> {
  if (!wamid) return false;
  try {
    const r = await query(
      `INSERT INTO camille.meta_inbound (wamid) VALUES ($1)
       ON CONFLICT (wamid) DO NOTHING RETURNING wamid`,
      [wamid]
    );
    // Purge des anciens identifiants, une fois par heure au plus : Meta ne
    // relivre pas un message au-delà de quelques jours.
    if (Date.now() - derniereRaz > 3600 * 1000) {
      derniereRaz = Date.now();
      query(`DELETE FROM camille.meta_inbound WHERE received_at < now() - interval '7 days'`).catch(() => {});
    }
    return r.rows.length === 0;
  } catch (e) {
    console.warn("[meta] anti-doublon en mémoire seulement (table meta_inbound absente ?) :", (e as Error).message);
    return dejaVuLocal(wamid);
  }
}

/** Le texte d'un vocal, ou `null` s'il n'a pas pu être récupéré ou compris. */
async function ecouter(msg: IncomingMessage, agent: Agent): Promise<string | null> {
  if (!msg.mediaId) return null;
  const media = await meta.telechargerMedia(msg.mediaId, VOCAL_MAX_OCTETS);
  if (!media) return null;
  // Le nom du commerce oriente Whisper vers la bonne orthographe.
  const indice = agent.business_name ? `${agent.business_name}, boutique sur WhatsApp.` : "";
  const texte = await transcrire(media.octets, msg.mime || media.mime, indice);
  console.log(`[meta] vocal ${msg.messageId} →`, texte ? `« ${texte.slice(0, 80)} »` : "rien d'exploitable");
  return texte;
}

export async function handleIncoming(msg: IncomingMessage): Promise<void> {
  const phone = meta.normalizePhone(msg.from);
  if (!phone) return;

  if (await dejaTraite(msg.messageId)) {
    console.log("[meta] message déjà traité, ignoré :", msg.messageId);
    return;
  }

  const agent = await trouverAgent(msg.phoneNumberId);
  if (!agent) {
    console.error(
      "[meta] aucun agent pour phone_number_id",
      msg.phoneNumberId,
      "— renseigne META_TEST_AGENT_ID ou agents.meta_phone_number_id"
    );
    return;
  }

  // Tout ce qui suit parle à Meta au nom de CET agent : son numéro, son jeton,
  // son catalogue (ou ceux de l'application s'il n'a pas connecté le sien).
  return avecAgent(agent.id, () => traiterPourAgent(msg, agent, phone));
}

/** Clients déjà prévenus que l'agent est indisponible (agent:téléphone → instant). */
const PREVENUS = new Map<string, number>();

async function traiterPourAgent(msg: IncomingMessage, agent: Agent, phone: string): Promise<void> {
  if (await humainEnCours(agent.id, phone)) {
    console.log("[meta] humain en cours pour", phone, "— l'agent se tait");
    return;
  }

  // Abonnement et quota : la même règle que n8n (lib/quota.ts). Un agent
  // expiré ou à court de tokens se tait ; le client est prévenu une fois par
  // période de 6 h plutôt qu'à chaque message.
  const droit = await etatQuota(agent.id);
  if (!droit.allowed) {
    console.log(`[meta] agent ${agent.id} muet : ${droit.reason}`);
    const cle = `${agent.id}:${phone}`;
    const dernier = PREVENUS.get(cle) || 0;
    if (Date.now() - dernier > 6 * 3600_000 && droit.message) {
      PREVENUS.set(cle, Date.now());
      await meta.sendText(phone, droit.message).catch(() => {});
    }
    return;
  }

  // Accusé de lecture et indicateur de frappe : le client voit qu'on s'occupe
  // de lui avant même la réponse.
  if (msg.messageId) meta.markReadTyping(msg.messageId).catch(() => {});

  // Le rattachement de la session, pour que les statistiques voient ces
  // conversations. Idempotent, et sans effet sur les sessions camille-core.
  await lierSession(agent.id);

  // Un vocal devient un message écrit : tout ce qui suit — catalogue, couleurs,
  // panier, adresse — le traite comme si le client l'avait tapé.
  if (msg.type === "audio") {
    const texte = await ecouter(msg, agent);
    if (!texte) {
      await tracer(agent.id, phone, "user", "(vocal non compris)");
      await meta.sendText(
        phone,
        "Je n'ai pas réussi à écouter ton vocal 🙏 Tu peux me l'écrire ? / I couldn't play your voice note, could you type it?"
      );
      return;
    }
    msg = { ...msg, type: "text", text: texte, vocal: true };
  }

  await tracer(agent.id, phone, "user", msg.vocal ? `🎤 ${msg.text}` : msg.text || `(${msg.rawType || msg.type})`);

  const ctx: Contexte = { agent, msg, phone };
  const mode = modeDeVente(agent);

  try {
    switch (mode) {
      case "boutique":
      case "restaurant":
        // Le restaurant partage l'essentiel avec la boutique — catalogue,
        // panier, commande. Ce qui diffère (carte du menu, plats du jour,
        // heures de service) est porté DANS le flux, pas par un second flux :
        // dupliquer, c'est corriger deux fois.
        await repondreBoutique(ctx, mode);
        break;

      case "services":
      case "media":
        // Pas encore porté. On le dit plutôt que de laisser le client sans
        // réponse — un silence est le seul échec impardonnable.
        await meta.sendText(
          phone,
          `Bonjour 👋 Je suis l'assistant de ${agent.business_name || "la maison"}. ` +
            `Dites-moi ce dont vous avez besoin, un conseiller vous répond très vite.`
        );
        break;
    }
  } catch (e) {
    console.error("[meta] échec du traitement", msg.messageId, (e as Error).message);
    await meta.sendText(
      phone,
      "Désolé, j'ai eu un souci technique 🙏 Réécris-moi, ou dis-moi *conseiller* et quelqu'un prend le relais."
    );
  }
}

export { tracer };
