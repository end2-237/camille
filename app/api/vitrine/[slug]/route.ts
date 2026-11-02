// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vitrine/<adresse> — la vitrine en JSON, pour le site du marchand
// hébergé ailleurs (ex. le site M7 GOAT). Les mêmes données que la page
// /s/<adresse>, qui est déjà publique : produits actifs, prix, rayons, numéro
// WhatsApp, zones et frais de livraison, horaires. Rien d'interne n'en sort.
//
// Appel navigateur accepté depuis les domaines déclarés par le marchand
// (adresse de son site, domaines de ses clés d'API).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { enTetesVitrine, vitrineParSlug } from "@/lib/vitrine";

type RouteContext = { params: Promise<{ slug: string }> };

export async function OPTIONS(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const v = await vitrineParSlug(slug);
  return new NextResponse(null, { status: 204, headers: await enTetesVitrine(v?.agentId ?? null, req.headers.get("origin")) });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const v = await vitrineParSlug(slug);
  const headers = await enTetesVitrine(v?.agentId ?? null, req.headers.get("origin"));
  if (!v) return NextResponse.json({ error: "Cette boutique n'est pas disponible." }, { status: 404, headers });
  // L'identifiant interne de l'agent n'a rien à faire dans le navigateur.
  const { agentId: _interne, ...publique } = v;
  void _interne;
  return NextResponse.json(publique, { headers: { ...headers, "Cache-Control": "public, max-age=60" } });
}
