// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/[agentId]/media  → upload audio ou vidéo vers Supabase Storage
// DELETE /api/agents/[agentId]/media?type=audio|video → supprime le fichier
// GET  /api/agents/[agentId]/media  → diagnostic (config storage)
//
// Utilise l'API REST Supabase Storage directement (pas le SDK JS) pour éviter
// les problèmes d'initialisation au build/runtime.
//
// Vars Coolify requises :
//   STORAGE_URL              → https://storage.vps.buyticle.com
//   SUPABASE_SERVICE_ROLE_KEY → clé service role
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ agentId: string }> };

// ── Config ────────────────────────────────────────────────────────────────────

const BUCKET       = "agent-media";
const MAX_AUDIO_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_AUDIO_B  = MAX_AUDIO_MB * 1024 * 1024;
const MAX_VIDEO_B  = MAX_VIDEO_MB * 1024 * 1024;

const ALLOWED_AUDIO = new Set([
  "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/webm",
]);
const ALLOWED_VIDEO = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const MIME_TO_EXT: Record<string, string> = {
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
  "audio/aac": "aac", "audio/x-m4a": "m4a", "audio/webm": "webm",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function storageBase(): string {
  const raw = process.env.STORAGE_URL
           || process.env.SUPABASE_URL
           || process.env.NEXT_PUBLIC_SUPABASE_URL
           || "";
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/storage/v1") ? trimmed : trimmed + "/storage/v1";
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function storageHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${serviceKey()}`,
    apikey: serviceKey(),
    ...extra,
  };
}

/** Crée le bucket public s'il n'existe pas déjà. */
async function ensureBucket(): Promise<void> {
  const base = storageBase();
  const key  = serviceKey();

  if (!base || base === "/storage/v1" || !key) {
    throw new Error(
      `Storage non configuré. Vérifiez STORAGE_URL (actuel: "${base}") et SUPABASE_SERVICE_ROLE_KEY.`
    );
  }

  // Vérifier si le bucket existe
  const checkRes = await fetch(`${base}/bucket/${BUCKET}`, {
    headers: storageHeaders(),
  });

  if (checkRes.ok) return; // existe déjà

  // Créer le bucket public
  const createRes = await fetch(`${base}/bucket`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    // Ignorer "already exists"
    if (!text.toLowerCase().includes("already") && !text.toLowerCase().includes("exist")) {
      throw new Error(`Création bucket: ${createRes.status} — ${text}`);
    }
  }
}

/** Lit capabilities depuis la DB. */
async function readCapabilities(agentId: string): Promise<Record<string, unknown>> {
  const r = await query("SELECT capabilities FROM camille.agents WHERE id = $1", [agentId]);
  if (!r.rows.length) return {};
  const raw = r.rows[0].capabilities;
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try { return JSON.parse(raw as string); } catch { return {}; }
}

/** Écrit capabilities en DB. */
async function writeCapabilities(agentId: string, caps: Record<string, unknown>): Promise<void> {
  await query(
    "UPDATE camille.agents SET capabilities = $1, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(caps), agentId]
  );
}

// ── GET — diagnostic ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const base = storageBase();
  const key  = serviceKey();

  let bucketsTest = "non testé";
  try {
    const r = await fetch(`${base}/bucket`, { headers: storageHeaders() });
    const txt = await r.text();
    bucketsTest = `HTTP ${r.status} — ${txt.slice(0, 200)}`;
  } catch (e) {
    bucketsTest = `Erreur fetch: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    storageBase:      base,
    hasKey:           !!key,
    keyPrefix:        key ? key.slice(0, 20) + "..." : "MANQUANTE",
    STORAGE_URL:      process.env.STORAGE_URL              || "(non défini)",
    SUPABASE_URL:     process.env.SUPABASE_URL              || "(non défini)",
    NP_SUPABASE_URL:  process.env.NEXT_PUBLIC_SUPABASE_URL  || "(non défini)",
    bucketsApiTest:   bucketsTest,
  });
}

// ── POST — upload ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  const ownerCheck = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (!ownerCheck.rows.length) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Corps invalide (multipart attendu)" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const type = (formData.get("type") as string | null)?.toLowerCase();

  if (!file || !type) {
    return NextResponse.json({ error: "Champs file et type requis" }, { status: 400 });
  }
  if (type !== "audio" && type !== "video") {
    return NextResponse.json({ error: 'type doit être "audio" ou "video"' }, { status: 400 });
  }

  const allowedSet = type === "audio" ? ALLOWED_AUDIO : ALLOWED_VIDEO;
  if (!allowedSet.has(file.type)) {
    const hint = type === "audio" ? ".ogg, .mp3, .m4a" : ".mp4";
    return NextResponse.json(
      { error: `Type MIME non supporté (${file.type}). Formats: ${hint}` },
      { status: 400 }
    );
  }

  const maxBytes = type === "audio" ? MAX_AUDIO_B : MAX_VIDEO_B;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Fichier trop lourd — max ${type === "audio" ? MAX_AUDIO_MB : MAX_VIDEO_MB} Mo` },
      { status: 400 }
    );
  }

  try {
    await ensureBucket();

    const ext         = MIME_TO_EXT[file.type] ?? (type === "audio" ? "ogg" : "mp4");
    const storagePath = `${agentId}/welcome_${type}.${ext}`;
    const base        = storageBase();

    // Upload via REST (upsert)
    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await fetch(
      `${base}/object/${BUCKET}/${storagePath}?upsert=true`,
      {
        method:  "POST",
        headers: storageHeaders({ "Content-Type": file.type }),
        body:    arrayBuffer,
      }
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Upload storage: ${uploadRes.status} — ${text}`);
    }

    // URL publique
    const publicUrl = `${base}/object/public/${BUCKET}/${storagePath}`;

    // Persist en DB
    const caps = await readCapabilities(agentId);
    caps[`welcome_${type}_url`] = publicUrl;
    await writeCapabilities(agentId, caps);

    return NextResponse.json({ url: publicUrl, path: storagePath });

  } catch (err) {
    console.error("[POST /api/agents/:id/media]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE — suppression ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  const type = req.nextUrl.searchParams.get("type")?.toLowerCase();

  if (type !== "audio" && type !== "video") {
    return NextResponse.json({ error: 'type doit être "audio" ou "video"' }, { status: 400 });
  }

  const ownerCheck = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (!ownerCheck.rows.length) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  try {
    const base = storageBase();
    const exts = type === "audio"
      ? ["ogg", "mp3", "m4a", "aac", "webm"]
      : ["mp4", "mov", "webm"];

    // Supprimer toutes les extensions possibles (on ne sait pas laquelle est stockée)
    await Promise.allSettled(
      exts.map((ext) =>
        fetch(`${base}/object/${BUCKET}/${agentId}/welcome_${type}.${ext}`, {
          method:  "DELETE",
          headers: storageHeaders(),
        })
      )
    );

    // Effacer l'URL en DB
    const caps = await readCapabilities(agentId);
    delete caps[`welcome_${type}_url`];
    await writeCapabilities(agentId, caps);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[DELETE /api/agents/:id/media]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
