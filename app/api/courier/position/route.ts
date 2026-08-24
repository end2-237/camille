// ─────────────────────────────────────────────────────────────────────────────
// POST /api/courier/position — le téléphone du livreur dit où il en est.
//
// Envoyé pendant une course, toutes les quelques secondes. C'est ce qui permet
// au commerçant de répondre « il arrive » sans appeler, et au livreur de voir
// sa route se recalculer pendant qu'il roule.
//
// Rien n'est historisé : on garde la dernière position, pas le trajet. Suivre
// un livreur à la trace toute la journée n'apporterait rien à la livraison.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { lat?: number; lng?: number; agentId?: string };
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return NextResponse.json({ error: "Position invalide" }, { status: 400 });
  }

  try {
    await query(
      `UPDATE camille.couriers
          SET last_lat = $1, last_lng = $2, last_seen_at = NOW(), updated_at = NOW()
        WHERE user_id = $3 AND status = 'active'
          AND ($4::uuid IS NULL OR agent_id = $4)`,
      [lat, lng, user.id, b.agentId ?? null]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const c = (e as { code?: string }).code;
    // Sans la table, le suivi n'existe pas : ce n'est pas une raison pour
    // interrompre la course du livreur.
    if (c === "42703" || c === "42P01") return NextResponse.json({ ok: false });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
