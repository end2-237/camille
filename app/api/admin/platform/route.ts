// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/platform — l'état de la plateforme WhatsApp.
//
// Relaie la veille tenue par camille-core : version de la bibliothèque, version
// du protocole annoncée à WhatsApp, décalage entre les deux, et corrélation des
// déconnexions récentes.
//
// C'est la vue qui manquait la nuit où la moitié des agents sont tombés : le
// signal existait (une version publiée quelques jours plus tôt, un numéro de
// protocole qui ne correspondait plus), mais personne ne le regardait.
//
// Cette route ne renvoie JAMAIS d'erreur serveur. Une console d'exploitation
// qui tombe en panne parce que la chose qu'elle surveille est en panne ne sert
// à rien : si le core est injoignable, c'est une information, pas un 500.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth-server";

const CORE_URL = process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com";
const CORE_API_KEY = process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  try {
    const r = await fetch(`${CORE_URL}/api/platform`, {
      headers: { "X-Api-Key": CORE_API_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      return NextResponse.json({
        injoignable: true,
        niveau: "attention",
        diagnostic: `camille-core répond ${r.status} sur /api/platform.`,
        prevision:
          r.status === 404
            ? "Cette version de camille-core n'a pas encore la veille plateforme — redéploie-la."
            : "Sans le core, on ne voit plus venir les changements de WhatsApp.",
      });
    }
    return NextResponse.json(await r.json());
  } catch (e) {
    return NextResponse.json({
      injoignable: true,
      niveau: "attention",
      diagnostic: `camille-core injoignable : ${(e as Error).message}`,
      prevision: "Tant que le core ne répond pas, aucune session WhatsApp n'est surveillée.",
    });
  }
}
