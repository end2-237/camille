// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/agents/[agentId]/couriers → les livreurs de la boutique
// POST   … { code }                     → rattache un livreur par son code
// PATCH  … { id, status | display_name }→ suspend, réactive, renomme
// DELETE … { id }                       → détache
//
// Le commerçant n'invente pas de compte : il colle le code que le livreur lui
// a donné. Personne ne se retrouve rattaché sans l'avoir voulu.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { clip, ownsAgent } from "@/lib/companyAccounts";
import { COURIERS_MISSING, normalizeCode } from "@/lib/couriers";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RouteContext = { params: Promise<{ agentId: string }> };

const absent = (e: unknown) => {
  const c = (e as { code?: string }).code;
  return c === "42703" || c === "42P01";
};

async function guard(req: NextRequest, params: RouteContext["params"]) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const { agentId } = await params;
  if (!(await ownsAgent(agentId, user.id))) {
    return { error: NextResponse.json({ error: "Agent introuvable" }, { status: 404 }) };
  }
  return { agentId };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;

  try {
    const r = await query(
      `SELECT c.id, c.status, c.display_name, c.phone, c.last_lat, c.last_lng, c.last_seen_at,
              c.created_at, u.full_name, u.email,
              (SELECT COUNT(*) FROM camille.orders o
                WHERE o.courier_id = c.id AND o.status = 'livree')        AS delivered,
              (SELECT COUNT(*) FROM camille.orders o
                WHERE o.courier_id = c.id AND o.status = 'en_livraison')  AS en_cours
         FROM camille.couriers c
         JOIN camille.users u ON u.id = c.user_id
        WHERE c.agent_id = $1
        ORDER BY c.created_at`,
      [g.agentId]
    );
    return NextResponse.json({
      ready: true,
      couriers: r.rows.map((c: any) => ({
        ...c,
        name: c.display_name || c.full_name || c.email,
        delivered: Number(c.delivered) || 0,
        en_cours: Number(c.en_cours) || 0,
        last_lat: c.last_lat == null ? null : Number(c.last_lat),
        last_lng: c.last_lng == null ? null : Number(c.last_lng),
      })),
    });
  } catch (e) {
    if (absent(e)) return NextResponse.json({ ready: false, couriers: [], error: COURIERS_MISSING });
    return NextResponse.json({ ready: false, couriers: [], error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = normalizeCode(b.code);
  if (!code) return NextResponse.json({ error: "Code livreur manquant." }, { status: 400 });

  try {
    const u = await query(
      `SELECT id, full_name, email FROM camille.users
        WHERE upper(regexp_replace(COALESCE(courier_code, ''), '[^A-Za-z0-9]', '', 'g')) = $1`,
      [code]
    );
    const livreur = u.rows[0];
    if (!livreur) {
      return NextResponse.json({ error: "Code livreur inconnu. Vérifie-le auprès du livreur." }, { status: 404 });
    }

    const r = await query(
      `INSERT INTO camille.couriers (agent_id, user_id, display_name, phone)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, user_id) DO UPDATE
            SET status = 'active',
                display_name = COALESCE(EXCLUDED.display_name, camille.couriers.display_name),
                updated_at = NOW()
        RETURNING *`,
      [g.agentId, livreur.id, clip(b.name, 60) ?? livreur.full_name ?? null, clip(b.phone, 20)]
    );
    return NextResponse.json({
      courier: { ...r.rows[0], name: r.rows[0].display_name || livreur.full_name || livreur.email },
    }, { status: 201 });
  } catch (e) {
    if (absent(e)) return NextResponse.json({ error: COURIERS_MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Livreur manquant." }, { status: 400 });

  try {
    const r = await query(
      `UPDATE camille.couriers
          SET status       = COALESCE($1, status),
              display_name = COALESCE($2, display_name),
              phone        = COALESCE($3, phone),
              updated_at   = NOW()
        WHERE id = $4 AND agent_id = $5
        RETURNING *`,
      [
        b.status === "active" || b.status === "suspended" ? b.status : null,
        clip(b.name, 60), clip(b.phone, 20), id, g.agentId,
      ]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
    return NextResponse.json({ courier: r.rows[0] });
  } catch (e) {
    if (absent(e)) return NextResponse.json({ error: COURIERS_MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Livreur manquant." }, { status: 400 });

  try {
    await query("DELETE FROM camille.couriers WHERE id = $1 AND agent_id = $2", [id, g.agentId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (absent(e)) return NextResponse.json({ error: COURIERS_MISSING }, { status: 503 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
