// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/me/courier → mon code livreur et les boutiques où je livre
// POST /api/me/courier → régénère le code (il a été diffusé par erreur)
//
// Le code est créé au premier appel, pas à l'inscription : la plupart des
// comptes sont des commerçants, et un code livreur qui traîne sur chacun
// n'apprendrait rien à personne.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { COURIERS_MISSING, courierCodeFor, makeCourierCode, missionsOf } from "@/lib/couriers";

const absent = (e: unknown) => {
  const c = (e as { code?: string }).code;
  return c === "42703" || c === "42P01";
};

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const [code, missions] = await Promise.all([courierCodeFor(user.id), missionsOf(user.id)]);
    return NextResponse.json({
      ready: true,
      code,
      name: user.full_name ?? user.email,
      missions: missions.map((m) => ({
        id: m.id,
        agent_id: m.agent_id,
        shop: m.business_name || m.agent_name,
        location: m.location ?? null,
      })),
    });
  } catch (e) {
    if (absent(e)) return NextResponse.json({ ready: false, error: COURIERS_MISSING });
    return NextResponse.json({ ready: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    for (let essai = 0; essai < 6; essai++) {
      try {
        const r = await query(
          "UPDATE camille.users SET courier_code = $1 WHERE id = $2 RETURNING courier_code",
          [makeCourierCode(), user.id]
        );
        return NextResponse.json({ code: r.rows[0]?.courier_code });
      } catch (e) {
        if ((e as { code?: string }).code !== "23505") throw e;
      }
    }
    return NextResponse.json({ error: "Réessaie dans un instant." }, { status: 500 });
  } catch (e) {
    if (absent(e)) return NextResponse.json({ error: COURIERS_MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
