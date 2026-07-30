// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/agents/[agentId]/api-keys  — liste (jamais la clé en clair)
// POST                                    — génère une clé, affichée UNE fois
// DELETE                                  — révoque ({ id })
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { generateKey, hashKey } from "@/lib/publicApi";

type RouteContext = { params: Promise<{ agentId: string }> };

async function owns(agentId: string, userId: string) {
  const r = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, userId]
  );
  return r.rows.length > 0;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await owns(agentId, user.id))) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  try {
    const r = await query(
      `SELECT id, label, kind, key_prefix, origins, revoked_at, last_used_at, calls_count, created_at
         FROM camille.api_keys
        WHERE agent_id = $1
        ORDER BY created_at DESC`,
      [agentId]
    );
    return NextResponse.json({ keys: r.rows });
  } catch (e) {
    return NextResponse.json({
      keys: [],
      error: "Intégration non configurée — applique migration_api_keys.sql",
      detail: (e as Error).message,
    });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await owns(agentId, user.id))) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "secret" ? "secret" : "public";
  const label = String(b.label || "Site web").slice(0, 60);
  const origins: string[] = Array.isArray(b.origins)
    ? b.origins.map((o: unknown) => String(o).trim()).filter(Boolean).slice(0, 10)
    : [];

  const key = generateKey(kind);

  try {
    await query(
      `INSERT INTO camille.api_keys (agent_id, user_id, label, kind, key_hash, key_prefix, origins)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [agentId, user.id, label, kind, hashKey(key), key.slice(0, 12), JSON.stringify(origins)]
    );
  } catch (e) {
    return NextResponse.json({
      error: "Création impossible — applique migration_api_keys.sql",
      detail: (e as Error).message,
    }, { status: 500 });
  }

  // Seule occasion où la clé est renvoyée : on n'en garde que l'empreinte.
  return NextResponse.json({ key, kind, label, once: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;

  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  try {
    await query(
      "UPDATE camille.api_keys SET revoked_at = NOW() WHERE id = $1 AND agent_id = $2 AND user_id = $3",
      [b.id, agentId, user.id]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
