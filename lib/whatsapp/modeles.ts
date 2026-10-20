// ─────────────────────────────────────────────────────────────────────────────
// Écrire à un client au-delà des 24 h.
//
// WhatsApp n'autorise un message libre que dans les 24 h qui suivent le
// dernier message du client. Au-delà, seul un modèle approuvé passe — et Meta
// accepte l'envoi libre sans broncher, pour ne signaler l'échec que plus tard
// (code 131047). Le suivi de commande, la réponse à une réclamation, une
// commande passée par le site : tout ce qui partait « plus tard » se perdait.
//
// Camille installe donc SES modèles sur le compte WhatsApp de chaque
// commerçant à la connexion, et les utilise d'elle-même quand la fenêtre est
// fermée. Le commerçant n'a rien à faire.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import * as meta from "./meta";
import { avecAgent } from "./identifiants";

/** Le modèle de relais : le nom du commerce, puis le message tel quel. */
export const MODELE_INFO = "camille_info";

export const MODELES_CAMILLE: {
  name: string;
  category: "UTILITY";
  body: string;
  examples: string[];
  footer?: string;
}[] = [
  {
    name: MODELE_INFO,
    category: "UTILITY",
    body:
      "Bonjour, voici un message de {{1}} au sujet de votre commande ou de votre demande :\n\n{{2}}\n\n" +
      "Répondez à ce message pour poursuivre l'échange.",
    examples: ["Boutique Awa", "Votre commande CMD-1042 est en route, le livreur arrive dans 30 minutes."],
    footer: "Envoyé avec Camille",
  },
];

const FENETRE_MS = 24 * 3600_000;

/** Le client a-t-il écrit dans les dernières 24 h ? (transport Meta) */
export async function fenetreOuverte(agentId: string, phone: string): Promise<boolean> {
  try {
    const r = await query(
      `SELECT MAX(created_at) AS dernier FROM camille.agent_conversations
        WHERE session_name = $1 AND contact_phone = $2 AND role = 'user'`,
      [`meta:${agentId}`, phone]
    );
    const d = r.rows[0]?.dernier;
    return Boolean(d) && Date.now() - new Date(d).getTime() < FENETRE_MS;
  } catch {
    // Base injoignable : on tente le message libre, l'accusé dira s'il échoue.
    return true;
  }
}

/** Un paramètre de modèle : ni saut de ligne, ni tabulation, ni grands blancs. */
export function aplatir(texte: string, max = 900): string {
  return texte
    .replace(/[\r\n\t]+/g, " · ")
    .replace(/ {4,}/g, "   ")
    .replace(/( · )+/g, " · ")
    .trim()
    .slice(0, max);
}

/** Installe les modèles de Camille qui manquent sur le compte de l'agent. */
export async function installerModeles(agentId: string): Promise<{ crees: string[]; erreurs: string[] }> {
  const crees: string[] = [];
  const erreurs: string[] = [];
  await avecAgent(agentId, async () => {
    const l = await meta.listTemplates();
    if (!l.ok) {
      erreurs.push(l.error || "modèles illisibles");
      return;
    }
    const existants = new Set(l.templates.map((t) => t.name));
    for (const m of MODELES_CAMILLE) {
      if (existants.has(m.name)) continue;
      const r = await meta.createTemplate({ ...m, language: "fr" });
      if (r.ok) crees.push(m.name);
      else erreurs.push(`${m.name} : ${r.error}`);
    }
  });
  return { crees, erreurs };
}

async function nomDuCommerce(agentId: string): Promise<string> {
  try {
    const r = await query(
      `SELECT COALESCE(NULLIF(business_name, ''), NULLIF(name, ''), 'votre commerçant') AS nom
         FROM camille.agents WHERE id = $1`,
      [agentId]
    );
    return String(r.rows[0]?.nom || "votre commerçant");
  } catch {
    return "votre commerçant";
  }
}

/**
 * Envoie un texte à un client Meta : en libre si la fenêtre est ouverte,
 * sinon par le modèle de relais. `modele` dit lequel des deux est parti.
 */
export async function envoyerMeta(
  agentId: string,
  phone: string,
  texte: string
): Promise<meta.MetaResult & { modele?: boolean }> {
  if (await fenetreOuverte(agentId, phone)) {
    return avecAgent(agentId, () => meta.sendText(phone, texte));
  }
  const nom = await nomDuCommerce(agentId);
  const r = await avecAgent(agentId, () => meta.sendTemplate(phone, MODELE_INFO, "fr", [aplatir(nom, 60), aplatir(texte)]));
  if (!r.ok && /does not exist|132001|template name/i.test(String(r.error || ""))) {
    // Modèle absent (compte connecté avant cette version) : on l'installe
    // pour la prochaine fois, et on le dit.
    installerModeles(agentId).catch(() => {});
    return { ...r, modele: true, error: "Le modèle de message de Camille est en cours d'approbation par Meta. Réessayez dans quelques heures." };
  }
  return { ...r, modele: true };
}
