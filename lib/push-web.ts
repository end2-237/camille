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
  | "refuse"          // l'utilisateur a dit non (ou le navigateur bloque)
  | "a-activer"       // possible, pas encore demandé
  | "actif";

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

export function etatPush(): EtatPush {
  if (!pushConfigure()) return "non-configure";
  if (!pushSupporte()) return "non-supporte";
  if (Notification.permission === "denied") return "refuse";
  if (Notification.permission === "granted") return "actif";
  return "a-activer";
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
