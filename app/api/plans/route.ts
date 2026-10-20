// ─────────────────────────────────────────────────────────────────────────────
// GET /api/plans — Plans et capacités depuis la base de données.
// Route publique — consommée par la page /pricing et le dashboard.
// Cache HTTP 5 min + stale-while-revalidate 60 s.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }    from "next/server";
import { getPlansFromDB, getPrixOptionSiteDB } from "@/lib/plans-db";

export const revalidate = 300; // ISR Next.js 15 — régénère toutes les 5 min

export async function GET() {
  try {
    const [{ plans, capabilities }, optionSite] = await Promise.all([getPlansFromDB(), getPrixOptionSiteDB()]);

    return NextResponse.json(
      { plans, capabilities, option_site_xaf: optionSite },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[GET /api/plans]", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des plans" },
      { status: 500 }
    );
  }
}
