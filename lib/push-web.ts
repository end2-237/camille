"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Notifications web en arrière-plan.
//
// Le dashboard ne recevait ses alertes que dans l'onglet ouvert : fermé le soir,
// on découvrait au matin une commande de la veille. Le mobile, lui, sonnait.
//
// Web Push standard plutôt que le SDK Firebase : une paire VAPID suffit, aucune
// dépendance côté navigateur, aucun script chargé depuis un domaine tiers. Le
// mobile continue de passer par FCM — les deux cohabitent dans push_tokens,
// l'envoi choisit le bon chemin selon la forme du jeton.
// ─────────────────────────────────────────────────────────────────────────────

import { authHeaders } from "@/lib/auth-client";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type EtatPush =
  | "non-configure"   // clé VAPID absente du déploiement
  | "non-supporte"    // navigateur sans service worker ou sans push
  | "a-installer"     // iPhone : possible, mais depuis l'écran d'accueil
  | "refuse"          // l'utilisateur a dit non (ou le navigateur bloque)
  | "a-activer"       // possible, pas encore demandé
  | "actif";

/** Marque un refus explicite : sans elle, le rattachement silencieux rallumait
 *  ce que le commerçant venait d'éteindre. */
const REFUS = "camille_push_off";

function refuseIci(): boolean {
  try { return localStorage.getItem(REFUS) === "1"; } catch { return false; }
}

function noterRefus(oui: boolean) {
  try { oui ? localStorage.setItem(REFUS, "1") : localStorage.removeItem(REFUS); } catch { /* sans stockage */ }
}

/** Un iPhone ou un iPad — y compris l'iPad qui se fait passer pour un Mac. */
export function estIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** L'application est ouverte depuis l'écran d'accueil, pas dans un onglet. */
export function estInstalle(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export function pushConfigure(): boolean {
  return VAPID.length > 20;
}

export function pushSupporte(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

/**
 * L'état réel, lu du navigateur ET de la souscription.
 *
 * Se fier à `Notification.permission` seule ne marchait pas : l'autorisation ne
 * se retire pas depuis la page, si bien que « Désactiver ici » revenait à
 * « activé » au rechargement suivant — et le rattachement silencieux
 * re-souscrivait dans la foulée. C'est la souscription qui dit la vérité.
 *
 * Sur iPhone, Safari ne donne le push qu'à une application ajoutée à l'écran
 * d'accueil : dans un onglet, ce n'est pas « navigateur incompatible », c'est
 * « pas encore installée ».
 */
export async function lireEtatPush(): Promise<EtatPush> {
  if (!pushConfigure()) return "non-configure";
  if (!pushSupporte()) return estIOS() && !estInstalle() ? "a-installer" : "non-supporte";
  if (Notification.permission === "denied") return "refuse";
  if (Notification.permission !== "granted") return "a-activer";
  return (await souscriptionCourante()) ? "actif" : "a-activer";
}

/** La souscription enregistrée sur cet appareil, si elle existe. */
async function souscriptionCourante(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Ce navigateur a-t-il été éteint volontairement ? */
export function pushRefuseIci(): boolean {
  return refuseIci();
}

/**
 * La clé VAPID voyage en base64url ; `subscribe` attend des octets bruts.
 * Sans cette conversion, le navigateur rejette la souscription avec une erreur
 * qui ne dit rien de la vraie cause.
 */
function base64UrlVersOctets(base64: string): Uint8Array<ArrayBuffer> {
  const bourrage = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + bourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(normal);
  // Tampon alloué explicitement : `Uint8Array.from` renvoie un ArrayBufferLike,
  // que la signature de subscribe() refuse.
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

/**
 * Demande l'autorisation si besoin, souscrit au push et enregistre la
 * souscription côté serveur. Ne lève pas : l'échec du push ne doit jamais
 * casser la page.
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

    const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Une souscription existante est réutilisée : re-souscrire à chaque visite
    // ferait tourner l'endpoint et laisserait des entrées mortes en base.
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlVersOctets(VAPID),
      }));

    noterRefus(false);

    const r = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      // Le serveur reconnaît une souscription web à sa forme JSON et l'envoie
      // par Web Push ; un jeton FCM du mobile reste une chaîne opaque.
      body: JSON.stringify({ token: JSON.stringify(sub), platform: "web" }),
    });
    if (!r.ok) return "a-activer";
    return "actif";
  } catch {
    return "a-activer";
  }
}

/** Désactive ce navigateur. L'autorisation, elle, reste au navigateur. */
export async function desactiverPushWeb(): Promise<void> {
  // On note le refus avant tout : même si la désinscription échoue, ce
  // navigateur ne doit pas être rallumé au prochain chargement.
  noterRefus(true);
  try {
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/register", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ token: JSON.stringify(sub) }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch { /* rien à désinscrire */ }
}
