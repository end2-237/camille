// ─────────────────────────────────────────────────────────────────────────────
// Envoi de notifications via Firebase Cloud Messaging (API HTTP v1).
//
// L'ancienne API "server key" est fermée depuis 2024 : v1 exige un jeton OAuth
// signé par un compte de service. On le fabrique ici avec `crypto` plutôt que
// d'ajouter google-auth-library — une trentaine de lignes, zéro dépendance.
//
// Configuration : FIREBASE_SERVICE_ACCOUNT_JSON (le JSON du compte de service,
// en une seule ligne). Sans cette variable, l'envoi est simplement ignoré :
// aucune fonctionnalité existante ne doit tomber parce que le push n'est pas
// configuré.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "crypto";
import { query } from "@/lib/db";

export type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Lit le compte de service depuis l'environnement.
 * Accepte le JSON brut OU sa version base64 : une variable d'environnement
 * multi-lignes casse facilement (Coolify, Docker, CI), le base64 supprime
 * le problème.
 */
export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  let text = raw.trim();
  // Base64 : ne commence pas par '{' et n'utilise que l'alphabet base64.
  if (!text.startsWith("{") && /^[A-Za-z0-9+/=\s]+$/.test(text)) {
    try { text = Buffer.from(text, "base64").toString("utf8").trim(); } catch { /* on tentera tel quel */ }
  }

  try {
    const j = JSON.parse(text);
    if (!j.client_email || !j.private_key || !j.project_id) return null;
    // La clé arrive avec des \n littéraux (c'est ainsi dans le fichier
    // téléchargé) alors que crypto exige de vrais sauts de ligne.
    j.private_key = String(j.private_key).replace(/\\n/g, "\n");
    return j as ServiceAccount;
  } catch {
    return null;
  }
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signature = b64url(
    crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key)
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j.access_token) return null;
  cachedToken = { value: j.access_token, expiresAt: now + (j.expires_in || 3600) };
  return j.access_token;
}

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  channel?: "commandes" | "alertes";
};

/**
 * Notifie tous les appareils actifs d'un utilisateur, et journalise la
 * notification pour le centre in-app.
 * Ne lève jamais : le push est un bonus, jamais un point de rupture.
 */
export async function notifyUser(
  userId: string,
  kind: "commande" | "alerte" | "systeme",
  p: PushPayload
): Promise<{ sent: number; skipped?: string }> {
  // Journal in-app d'abord : il doit exister même sans configuration FCM.
  try {
    await query(
      `INSERT INTO camille.notifications (user_id, kind, title, body, data)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [userId, kind, p.title, p.body, JSON.stringify(p.data || {})]
    );
  } catch {
    // table absente : on continue, l'envoi push reste possible
  }

  const sa = serviceAccount();
  if (!sa) return { sent: 0, skipped: "FIREBASE_SERVICE_ACCOUNT_JSON absent" };

  let tokens: string[] = [];
  try {
    const r = await query(
      "SELECT token FROM camille.push_tokens WHERE user_id = $1 AND active",
      [userId]
    );
    tokens = r.rows.map((x: { token: string }) => x.token);
  } catch {
    return { sent: 0, skipped: "table push_tokens absente" };
  }
  if (!tokens.length) return { sent: 0, skipped: "aucun appareil enregistré" };

  const bearer = await accessToken(sa);
  if (!bearer) return { sent: 0, skipped: "authentification Firebase refusée" };

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;

  await Promise.all(tokens.map(async (token) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: p.title, body: p.body },
            data: p.data || {},
            android: {
              priority: "HIGH",
              notification: {
                channel_id: p.channel || "commandes",
                sound: "default",
                color: "#101012",
              },
            },
            apns: { payload: { aps: { sound: "default", badge: 1 } } },
          },
        }),
      });
      if (res.ok) { sent++; return; }

      // 404 UNREGISTERED / 400 INVALID_ARGUMENT : l'appareil ne recevra plus
      // jamais rien, on désactive le jeton pour ne pas réessayer indéfiniment.
      if (res.status === 404 || res.status === 400) {
        const detail = await res.text().catch(() => "");
        await query(
          "UPDATE camille.push_tokens SET active = FALSE, last_error = $1, updated_at = NOW() WHERE token = $2",
          [detail.slice(0, 300), token]
        ).catch(() => {});
      }
    } catch {
      // réseau : on réessaiera à la prochaine notification
    }
  }));

  return { sent };
}
