// ─────────────────────────────────────────────────────────────────────────────
// GET /api/app/version?platform=android&version=1.0.0
//
// Dit à l'app si elle peut continuer. Deux niveaux :
//   • version < min_version    → BLOQUANTE : l'app est inutilisable sans MAJ
//   • version < latest_version → simple invitation à mettre à jour
//
// Publique à dessein : l'app doit pouvoir demander avant même de connecter
// l'utilisateur. Aucune donnée sensible n'est exposée.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/** Compare deux versions sémantiques. -1, 0 ou 1. */
function cmp(a: string, b: string): number {
  const pa = String(a).split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const platform = p.get("platform") === "ios" ? "ios" : "android";
  const current = p.get("version") || "0.0.0";

  let row: { min_version?: string; latest_version?: string; download_url?: string; notes?: string } = {};
  try {
    const r = await query(
      "SELECT min_version, latest_version, download_url, notes FROM camille.app_release WHERE platform = $1",
      [platform]
    );
    row = r.rows[0] ?? {};
  } catch {
    // Table absente : on ne bloque JAMAIS sur une erreur d'infrastructure.
    return NextResponse.json({ blocking: false, update_available: false, reason: "non configuré" });
  }

  const min = row.min_version || "0.0.0";
  const latest = row.latest_version || min;

  return NextResponse.json({
    platform,
    current,
    min_version: min,
    latest_version: latest,
    blocking: cmp(current, min) < 0,
    update_available: cmp(current, latest) < 0,
    download_url: row.download_url || null,
    notes: row.notes || null,
  });
}
