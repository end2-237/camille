// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/[agentId]/media  → upload audio ou vidéo d'accueil
// DELETE /api/agents/[agentId]/media?type=audio|video → supprime le fichier
//
// Stockage : Supabase Storage via REST direct (pas le SDK JS).
// Env vars requises :
//   STORAGE_URL          → ex: https://storage.vps.buyticle.com
//   SUPABASE_SERVICE_ROLE_KEY → clé service role Supabase
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

// ── Config ────────────────────────────────────────────────────────────────────

const BUCKET       = "agent-media";
const MAX_AUDIO_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_AUDIO_B  = MAX_AUDIO_MB * 1024 * 1024;
const MAX_VIDEO_B  = MAX_VIDEO_MB * 1024 * 1024;

const ALLOWED_AUDIO = new Set([
  "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/webm",
]);
const ALLOWED_VIDEO = new Set([
  "video/mp4", "video/quicktime", "video/webm",
]);

const MIME_TO_EXT: Record<string, string> = {
  "audio/ogg":       "ogg",
  "audio/mpeg":      "mp3",
  "audio/mp4":       "m4a",
  "audio/aac":       "aac",
  "audio/x-m4a":    "m4a",
  "audio/webm":      "webm",
  "video/mp4":       "mp4",
  "video/quicktime": "mov",
  "video/webm":      "webm",
};

const AUDIO_EXTS = ["ogg", "mp3", "m4a", "aac", "webm"];
const VIDEO_EXTS = ["mp4", "mov", "webm"];

type RouteContext = { params: Promise<{ agentId: string }> };

// ── Storage REST helpers ──────────────────────────────────────────────────────

function storageBase() {
  // STORAGE_URL is the root of the Supabase Storage REST API.
  // Examples:
  //   Self-hosted separate storage : https://storage.vps.buyticle.com
  //   Self-hosted via Kong gateway : https://supabase.vps.buyticle.com/storage/v1
  //   Supabase cloud               : https://xxxx.supabase.co/storage/v1
  const raw = process.env.STORAGE_URL
    || process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || "";

  // If the URL already ends with /storage/v1 keep it as-is, otherwise append.
  return raw.replace(/\/$/, "").endsWith("/storage/v1")
    ? raw.replace(/\/$/, "")
    : raw.replace(/\/$/, "") + "/storage/v1";
}

function storageHeaders(contentType?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const h: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

/** Creates the bucket if it doesn't exist. Ignores "already exists" errors. */
async function ensureBucket(): Promise<void> {
  const base = storageBase();
  const res  = await fetch(`${base}/bucket`, {
    method:  "POST",
    headers: storageHeaders("application/json"),
    body:    JSON.stringify({
      id:     BUCKET,
      name:   BUCKET,
      public: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // "already exists" or duplicate key → fine
    if (
      body.toLowerCase().includes("already exist") ||
      body.toLowerCase().includes("duplicate") ||
      res.status === 409
    ) return;
    throw new Error(`Storage bucket error: ${body}`);
  }
}

/** Uploads a buffer to the bucket. Returns the public URL. */
async function uploadFile(
  path:        string,
  buffer:      Buffer,
  contentType: string,
): Promise<string> {
  const base = storageBase();
  const url  = `${base}/object/${BUCKET}/${path}`;

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      ...storageHeaders(),
      "Content-Type":  contentType,
      "x-upsert":      "true",   // overwrite if same path
    },
    body: buffer,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Storage upload error: ${body}`);
  }

  // Public URL — served directly from the storage domain
  const storageRoot = (
    process.env.STORAGE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");

  return `${storageRoot}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Deletes multiple paths (best-effort, ignores 404). */
async function deleteFiles(paths: string[]): Promise<void> {
  const base = storageBase();
  await fetch(`${base}/object/${BUCKET}`, {
    method:  "DELETE",
    headers: storageHeaders("application/json"),
    body:    JSON.stringify({ prefixes: paths }),
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function readCapabilities(agentId: string): Promise<Record<string, unknown>> {
  const r = await query(
    "SELECT capabilities FROM camille.agents WHERE id = $1",
    [agentId]
  );
  if (r.rows.length === 0) return {};
  const raw = r.rows[0].capabilities;
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try { return JSON.parse(raw as string) as Record<string, unknown>; } catch { return {}; }
}

async function writeCapabilities(agentId: string, caps: Record<string, unknown>) {
  await query(
    `UPDATE camille.agents SET capabilities = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(caps), agentId]
  );
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
  if (ownerCheck.rows.length === 0) {
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
    const hint = type === "audio" ? ".ogg, .mp3, .m4a, .aac" : ".mp4";
    return NextResponse.json(
      { error: `Format non supporté (${file.type}). Acceptés : ${hint}` },
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

  const ext         = MIME_TO_EXT[file.type] ?? (type === "audio" ? "ogg" : "mp4");
  const storagePath = `${agentId}/welcome_${type}.${ext}`;

  try {
    await ensureBucket();

    const buffer    = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadFile(storagePath, buffer, file.type);

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
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  try {
    const exts  = type === "audio" ? AUDIO_EXTS : VIDEO_EXTS;
    const paths = exts.map((e) => `${agentId}/welcome_${type}.${e}`);
    await deleteFiles(paths);

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
