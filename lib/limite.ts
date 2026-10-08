// ─────────────────────────────────────────────────────────────────────────────
// Limiter les tentatives (connexion, mot de passe propriétaire, inscription…).
//
// Une fenêtre glissante en mémoire, par clé (« login:ip », « owner:agent:tel »).
// Suffisant pour une seule instance de l'application : avec plusieurs
// réplicas, chacune compte de son côté — la limite reste un frein, pas un mur.
// ─────────────────────────────────────────────────────────────────────────────

import type { NextRequest } from "next/server";

const essais = new Map<string, number[]>();

/**
 * Enregistre une tentative et dit si elle est permise.
 * `max` tentatives par `fenetreMs` ; au-delà, `attente` (secondes) jusqu'à la
 * prochaine tentative possible.
 */
export function tenter(cle: string, max: number, fenetreMs: number): { ok: boolean; attente: number } {
  const maintenant = Date.now();
  const liste = (essais.get(cle) || []).filter((t) => maintenant - t < fenetreMs);
  if (liste.length >= max) {
    essais.set(cle, liste);
    return { ok: false, attente: Math.ceil((fenetreMs - (maintenant - liste[0])) / 1000) };
  }
  liste.push(maintenant);
  essais.set(cle, liste);
  if (essais.size > 50_000) nettoyer(fenetreMs);
  return { ok: true, attente: 0 };
}

/** Efface le compteur (après une réussite, par exemple). */
export function oublier(cle: string) {
  essais.delete(cle);
}

function nettoyer(fenetreMs: number) {
  const maintenant = Date.now();
  for (const [k, v] of essais) if (!v.some((t) => maintenant - t < fenetreMs)) essais.delete(k);
}

/** L'adresse du client, derrière le proxy (Coolify / Traefik). */
export function ipDe(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "inconnue"
  );
}
