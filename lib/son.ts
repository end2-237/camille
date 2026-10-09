"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le « ka-ching » d'une nouvelle commande, dans le tableau de bord ouvert.
//
// Les navigateurs (Safari d'iPhone surtout) refusent de jouer un son tant que
// l'utilisateur n'a pas touché la page : on « débloque » le lecteur au premier
// toucher, en silence, pour que la commande suivante sonne vraiment.
//
// Application fermée, c'est la notification système qui sonne : son propre
// son dans l'application mobile, le son par défaut du téléphone pour le web
// (les navigateurs ne permettent pas d'en choisir un autre).
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE = "/sons/caisse.mp3";
const COUPE = "camille_son_off";

let lecteur: HTMLAudioElement | null = null;
let pret = false;

function obtenir(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!lecteur) {
    lecteur = new Audio(SOURCE);
    lecteur.preload = "auto";
  }
  return lecteur;
}

/** À appeler une fois au montage du tableau de bord. */
export function preparerSon() {
  if (typeof window === "undefined" || pret) return;
  const debloquer = () => {
    const a = obtenir();
    if (!a) return;
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; pret = true; }).catch(() => { a.muted = false; });
    window.removeEventListener("pointerdown", debloquer);
    window.removeEventListener("keydown", debloquer);
  };
  window.addEventListener("pointerdown", debloquer, { once: false, passive: true });
  window.addEventListener("keydown", debloquer);
}

export function sonActive(): boolean {
  try { return localStorage.getItem(COUPE) !== "1"; } catch { return true; }
}

export function activerSon(oui: boolean) {
  try { oui ? localStorage.removeItem(COUPE) : localStorage.setItem(COUPE, "1"); } catch { /* sans stockage */ }
}

/** Joue le son de caisse (si l'utilisateur ne l'a pas coupé). */
export function jouerCaisse(force = false) {
  if (!force && !sonActive()) return;
  const a = obtenir();
  if (!a) return;
  try {
    a.currentTime = 0;
    a.volume = 1;
    a.play().catch(() => { /* pas encore débloqué : la notification visuelle suffit */ });
  } catch { /* lecteur indisponible */ }
}
