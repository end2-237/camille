// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vitrine/<adresse>/commande — la commande passée sur la vitrine.
//
// Public : pas de clé, puisque c'est le navigateur du client qui appelle. Le
// montant est entièrement recalculé en base (lib/vitrine.ts) et le débit est
// limité par adresse IP, pour qu'un robot ne remplisse pas le tableau de bord.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { commanderSurVitrine, type CommandeVitrine } from "@/lib/vitrine";

type RouteContext = { params: Promise<{ slug: string }> };

const essais = new Map<string, number[]>();
function tropDEssais(ip: string): boolean {
  const maintenant = Date.now();
  const recents = (essais.get(ip) || []).filter((t) => maintenant - t < 10 * 60_000);
  recents.push(maintenant);
  essais.set(ip, recents);
  if (essais.size > 5000) essais.clear();
  return recents.length > 6;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
  if (tropDEssais(ip)) {
    return NextResponse.json({ error: "Trop de commandes en peu de temps. Réessayez dans quelques minutes." }, { status: 429 });
  }
  const b = (await req.json().catch(() => null)) as CommandeVitrine | null;
  if (!b) return NextResponse.json({ error: "Commande illisible." }, { status: 400 });
  const r = await commanderSurVitrine(slug, b);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r, { status: 201 });
}
