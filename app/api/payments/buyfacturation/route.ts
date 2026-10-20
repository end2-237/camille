import { NextRequest, NextResponse } from "next/server";
import { appliquerPaiement, marquerEchec, referenceSignee, statutCollecte } from "@/lib/paiement";

/**
 * La notification de buyfacturation : une collecte a changé de statut.
 *
 * On ne retient que la référence, et seulement si la signature tient ; le
 * statut est redemandé à buyfacturation avec notre clé. Ce qu'un inconnu
 * poste ici ne peut donc rien activer.
 */
export async function POST(req: NextRequest) {
  const brut = await req.text();
  const ref = referenceSignee(brut, req.headers.get("x-buyticle-signature"));
  if (!ref) return NextResponse.json({ error: "Signature invalide" }, { status: 401 });

  const statut = await statutCollecte(ref);
  if (statut === "success") await appliquerPaiement(ref);
  else if (statut === "failed") await marquerEchec(ref);
  return NextResponse.json({ ok: true });
}
