import { NextResponse } from "next/server";
import { buyfacturationActive, operateursOuverts } from "@/lib/paiement";

/** Les opérateurs Mobile Money ouverts : la page de paiement grise les autres. */
export async function GET() {
  const operateurs = buyfacturationActive() ? await operateursOuverts() : ["MTN", "ORANGE"];
  return NextResponse.json({ operateurs }, { headers: { "Cache-Control": "no-store" } });
}
