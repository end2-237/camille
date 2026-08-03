// ─────────────────────────────────────────────────────────────────────────────
// Alertes de consommation : prévenir avant la coupure, pas après.
//
// Un agent qui se tait parce que le quota est épuisé ressemble, vu du vendeur, à
// une panne technique. L'avertir à l'approche du plafond lui laisse le choix ;
// le découvrir par un client mécontent ne lui en laisse aucun.
//
// Tout est best-effort : une alerte est un service rendu, jamais une raison de
// faire échouer l'enregistrement de la consommation.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";

/** Seuils de consommation, du plus haut au plus bas (on ne notifie que le plus haut atteint). */
const SEUILS = [100, 80] as const;

/**
 * Marque un seuil comme notifié. Renvoie false s'il l'était déjà.
 * L'unicité de (agent, période, nature, seuil) fait le verrou : deux réponses
 * simultanées ne peuvent pas produire deux notifications.
 */
async function reserverAlerte(
  agentId: string,
  period: string,
  kind: string,
  threshold: number
): Promise<boolean> {
  try {
    const r = await query(
      `INSERT INTO camille.usage_alerts (agent_id, period, kind, threshold)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, period, kind, threshold) DO NOTHING`,
      [agentId, period, kind, threshold]
    );
    return (r as { rowCount?: number }).rowCount === 1;
  } catch {
    // Table absente : on préfère ne pas notifier plutôt que de risquer le spam.
    return false;
  }
}

/**
 * Prévient le propriétaire quand la consommation franchit un seuil.
 * Ne lève jamais.
 *
 * @param limit  plafond du plan ; -1 (illimité) n'alerte jamais.
 */
export async function alerterQuota(opts: {
  agentId: string;
  userId: string;
  agentName: string;
  period: string;
  used: number;
  limit: number;
}): Promise<void> {
  const { agentId, userId, agentName, period, used, limit } = opts;
  if (!userId || !limit || limit < 0) return; // illimité ou plan inconnu : rien à annoncer

  const percent = Math.round((used / limit) * 100);
  const atteint = SEUILS.find((s) => percent >= s);
  if (atteint === undefined) return;

  if (!(await reserverAlerte(agentId, period, "tokens", atteint))) return;

  const epuise = atteint >= 100;
  await notifyUser(userId, "alerte", {
    title: epuise
      ? `${agentName} a épuisé son forfait`
      : `${agentName} a consommé ${percent}% de son forfait`,
    body: epuise
      ? "Il ne répond plus à tes clients jusqu'au renouvellement. Passe à un forfait supérieur pour le relancer tout de suite."
      : "À ce rythme, il s'arrêtera avant la fin du mois. Tu peux passer à un forfait supérieur dès maintenant.",
    channel: "alertes",
    data: { type: "quota", agentId, percent: String(percent) },
  });
}

/**
 * Prévient le propriétaire à l'approche de la fin d'abonnement, puis le jour où
 * l'agent s'arrête. Une coupure sans préavis se vit comme une panne.
 * Ne lève jamais.
 */
export async function alerterEcheance(opts: {
  agentId: string;
  userId: string;
  agentName: string;
  daysLeft: number | null;
}): Promise<void> {
  const { agentId, userId, agentName, daysLeft } = opts;
  if (!userId || daysLeft === null) return; // forfait sans terme : rien à annoncer

  // 7 jours puis 1 jour avant, et 0 le jour de l'arrêt.
  const seuil = daysLeft <= 0 ? 0 : daysLeft <= 1 ? 1 : daysLeft <= 7 ? 7 : null;
  if (seuil === null) return;

  // La période porte le seuil au mois près : un réabonnement rouvre le droit
  // d'alerter au cycle suivant sans qu'on ait à effacer quoi que ce soit.
  const period = new Date().toISOString().slice(0, 7);
  if (!(await reserverAlerte(agentId, period, "abonnement", seuil))) return;

  const arrete = seuil === 0;
  await notifyUser(userId, arrete ? "alerte" : "systeme", {
    title: arrete
      ? `${agentName} est à l'arrêt`
      : `L'abonnement de ${agentName} se termine ${seuil === 1 ? "demain" : "dans une semaine"}`,
    body: arrete
      ? "L'abonnement est terminé : plus aucune réponse n'est envoyée à tes clients. Réabonne-toi pour le remettre en service."
      : "Passé cette date, il cessera de répondre à tes clients. Réabonne-toi pour éviter la coupure.",
    channel: "alertes",
    data: { type: "subscription", agentId, daysLeft: String(daysLeft) },
  });
}
