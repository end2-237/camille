"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Notifications web en arrière-plan.
//
// Le dashboard ne recevait ses alertes que dans l'onglet ouvert : fermé le soir,
// on découvrait au matin une commande de la veille. Le mobile, lui, sonnait.
//
// On passe par FCM plutôt que par le Web Push nu : le serveur envoie déjà à des
// jetons FCM (lib/fcm.ts) et `push_tokens` accepte déjà `platform = 'web'`. Un
// jeton web s'y range sans second chemin d'envoi à maintenir.
// ─────────────────────────────────────────────────────────────────────────────

import { authHeaders } from "@/lib/auth-client";

const CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};
const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export type EtatPush =
  | "non-configure"   // clés Firebase absentes du déploiement
  | "non-supporte"    // navigateur sans service worker ou sans push
  | "refuse"          // l'utilisateur a dit non (ou le navigateur bloque)
  | "a-activer"       // possible, pas encore demandé
  | "actif";

/** Clé de dernier jeton envoyé, pour ne pas réenregistrer à chaque visite. */
const CLE_JETON = "camille.push.token";

export function pushConfigure(): boolean {
  return Boolean(CONFIG.projectId && CONFIG.apiKey && CONFIG.appId && VAPID);
}

export function pushSupporte(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

export function etatPush(): EtatPush {
  if (!pushConfigure()) return "non-configure";
  if (!pushSupporte()) return "non-supporte";
  if (Notification.permission === "denied") return "refuse";
  if (Notification.permission === "granted") return "actif";
  return "a-activer";
}

/**
 * Enregistre le service worker en lui passant la configuration Firebase.
 *
 * La query string fait partie de l'identité du worker : changer une clé
 * enregistre un nouveau worker au lieu de laisser tourner l'ancien avec une
 * configuration périmée.
 */
async function enregistrerWorker(): Promise<ServiceWorkerRegistration> {
  const q = new URLSearchParams({
    apiKey: CONFIG.apiKey,
    authDomain: CONFIG.authDomain,
    projectId: CONFIG.projectId,
    messagingSenderId: CONFIG.messagingSenderId,
    appId: CONFIG.appId,
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${q}`, { scope: "/" });
}

/**
 * Demande l'autorisation si besoin, récupère le jeton et l'enregistre côté
 * serveur. Ne lève pas : l'échec du push ne doit jamais casser la page.
 *
 * @param demander false pour ne rien demander à l'utilisateur — sert au
 *   rattachement silencieux quand l'autorisation est déjà accordée.
 */
export async function activerPushWeb(demander = true): Promise<EtatPush> {
  if (!pushConfigure()) return "non-configure";
  if (!pushSupporte()) return "non-supporte";

  try {
    if (Notification.permission === "default") {
      if (!demander) return "a-activer";
      const rep = await Notification.requestPermission();
      if (rep !== "granted") return rep === "denied" ? "refuse" : "a-activer";
    }
    if (Notification.permission !== "granted") return "refuse";

    // Import dynamique : le SDK ne pèse sur le chargement que des visiteurs qui
    // activent réellement les notifications.
    const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
      import("firebase/app"),
      import("firebase/messaging"),
    ]);
    if (!(await isSupported())) return "non-supporte";

    const app = getApps().length ? getApps()[0] : initializeApp(CONFIG);
    const registration = await enregistrerWorker();
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID,
      serviceWorkerRegistration: registration,
    });
    if (!token) return "a-activer";

    // Réenregistrer un jeton inchangé à chaque visite ferait un appel inutile
    // par chargement de page ; le serveur, lui, reste idempotent.
    if (localStorage.getItem(CLE_JETON) !== token) {
      const r = await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ token, platform: "web" }),
      });
      if (r.ok) localStorage.setItem(CLE_JETON, token);
    }
    return "actif";
  } catch {
    return "a-activer";
  }
}

/** Désactive le jeton de ce navigateur. L'autorisation, elle, reste au navigateur. */
export async function desactiverPushWeb(): Promise<void> {
  const token = localStorage.getItem(CLE_JETON);
  if (!token) return;
  try {
    await fetch("/api/push/register", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
  } catch { /* le jeton restera actif au pire ; sans conséquence visible */ }
  localStorage.removeItem(CLE_JETON);
}
