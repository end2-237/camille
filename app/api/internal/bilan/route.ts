// ─────────────────────────────────────────────────────────────────────────────
// POST /api/internal/bilan — le tour horaire du bilan du matin.
//
// Lancé chaque heure par le serveur lui-même (instrumentation.ts) ; cette
// route permet aussi de le déclencher depuis n8n ou à la main (X-Camille-Key).
// Chaque agent ne reçoit son bilan qu'une fois par jour, à son ouverture.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { appelInterne, refusInterne } from "@/lib/interne";
import { envoyerBilans } from "@/lib/bilan";

export async function POST(req: NextRequest) {
  if (!appelInterne(req)) return refusInterne();
  return NextResponse.json(await envoyerBilans());
}
