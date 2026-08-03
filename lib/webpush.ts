// ─────────────────────────────────────────────────────────────────────────────
// Envoi Web Push (navigateurs), pendant de lib/fcm pour le mobile.
//
// Le mobile passe par FCM parce que c'est ce qu'Android et iOS attendent. Le
// navigateur, lui, n'a besoin que d'une paire VAPID : pas de SDK, pas de projet
// tiers à configurer, rien à charger depuis un autre domaine.
//
// Configuration :
//   VAPID_PUBLIC_KEY  / NEXT_PUBLIC_VAPID_PUBLIC_KEY  (la même valeur)
//   VAPID_PRIVATE_KEY (serveur uniquement — jamais NEXT_PUBLIC_)
//   VAPID_SUBJECT     (mailto: ou https://…, exigé par la spéc.)
// Sans ces variables, l'envoi web est simplement ignoré : rien d'existant ne
// doit tomber parce que le push n'est pas configuré.
// ─────────────────────────────────────────────────────────────────────────────
import webpush, { type PushSubscription } from "web-push";
import { query } from "@/lib/db";

const PUBLIC  = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@camille.local";

let pret = false;
function configurer(): boolean {
  if (pret) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  pret = true;
  return true;
}

export function webPushConfigure(): boolean {
  return Boolean(PUBLIC && PRIVATE);
}

/**
 * Une souscription web est stockée sous forme de JSON dans `push_tokens.token` ;
 * un jeton FCM est une chaîne opaque. La forme suffit donc à les distinguer,
 * sans colonne supplémentaire ni migration.
 */
export function estSouscriptionWeb(token: string): boolean {
  return token.trimStart().startsWith("{");
}

function parser(token: string): PushSubscription | null {
  try {
    const s = JSON.parse(token);
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return null;
    return s as PushSubscription;
  } catch {
    return null;
  }
}

export type EnvoiWeb = { sent: number; errors: string[] };

/**
 * Envoie à des souscriptions navigateur. Ne lève jamais.
 *
 * Le corps est le JSON que lit `public/push-sw.js` : titre, texte, et les
 * données qui portent le lien d'ouverture.
 */
export async function envoyerWebPush(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<EnvoiWeb> {
  if (!tokens.length) return { sent: 0, errors: [] };
  if (!configurer()) return { sent: 0, errors: ["VAPID_PRIVATE_KEY absente"] };

  const corps = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  });

  let sent = 0;
  const errors: string[] = [];

  await Promise.all(tokens.map(async (token) => {
    const sub = parser(token);
    if (!sub) {
      errors.push(`souscription illisible …${token.slice(-12)}`);
      return;
    }
    try {
      await webpush.sendNotification(sub, corps, { TTL: 24 * 3600 });
      sent++;
    } catch (e) {
      const st = (e as { statusCode?: number }).statusCode;
      // 404 / 410 : le navigateur a révoqué la souscription (cache vidé,
      // désinstallation, expiration). Elle ne reviendra pas — on la désactive.
      // Les autres codes disent que l'ENVOI a échoué, pas l'abonné : couper
      // l'abonné pour une panne passagère le rendrait muet pour toujours.
      if (st === 404 || st === 410) {
        await query(
          "UPDATE camille.push_tokens SET active = FALSE, last_error = $1, updated_at = NOW() WHERE token = $2",
          [`${st} souscription expirée`, token]
        ).catch(() => {});
      }
      errors.push(`${st ?? "?"} · web …${sub.endpoint.slice(-14)}`);
    }
  }));

  return { sent, errors };
}
