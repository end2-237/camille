// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/[agentId]/media  → upload audio ou vidéo d'accueil
// DELETE /api/agents/[agentId]/media?type=audio|video → supprime le fichier
//
// Stockage : Supabase Storage, bucket "agent-media" (public).
// Le bucket est créé automatiquement s'il n'existe pas encore.
// Les URLs publiques sont persistées dans camille.agents.capabilities.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/client";
import { query } from "@/lib/db";

// ── Config ────────────────────────────────────────────────────────────────────

const BUCKET         = "agent-media";
const MAX_AUDIO_MB   = 10;
const MAX_VIDEO_MB   = 50;
const MAX_AUDIO_B    = MAX_AUDIO_MB * 1024 * 1024;
const MAX_VIDEO_B    = MAX_VIDEO_MB * 1024 * 1024;

const ALLOWED_AUDIO  = new Set(["audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/webm"]);
const ALLOWED_VIDEO  = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const MIME_TO_EXT: Record<string, string> = {
  "audio/ogg":      "ogg",
  "audio/mpeg":     "mp3",
  "audio/mp4":      "m4a",
  "audio/aac":      "aac",
  "audio/x-m4a":   "m4a",
  "audio/webm":     "webm",
  "video/mp4":      "mp4",
  "video/quicktime":"mov",
  "video/webm":     "webm",
};

// Extensions à essayer lors de la suppression (on ne sait pas laquelle a été uploadée)
const AUDIO_EXTS = ["ogg", "mp3", "m4a", "aac", "webm"];
const VIDEO_EXTS = ["mp4", "mov", "webm"];

type RouteContext = { params: Promise<{ agentId: string }> };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ensures the public bucket exists — silently ignores "already exists" errors. */
async function ensureBucket(supabase: ReturnType<typeof createServerClient>) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public:               true,
    fileSizeLimit:        MAX_VIDEO_B,
    allowedMimeTypes:     [...ALLOWED_AUDIO, ...ALLOWED_VIDEO],
  });
  // error.message === "Bucket already exists" is expected — ignore it
  if (error && !error.message?.toLowerCase().includes("already exists")) {
    throw new Error(`Storage bucket error: ${error.message}`);
  }
}

/** Reads current capabilities (TEXT column storing JSON) for an agent. */
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

/** Writes capabilities back as JSON string. */
async function writeCapabilities(agentId: string, caps: Record<string, unknown>) {
  await query(
    `UPDATE camille.agents
     SET capabilities = $1, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(caps), agentId]
  );
}

// ── POST — upload ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  // Verify ownership
  const ownerCheck = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  // Parse multipart form
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

  // Validate MIME
  const allowedSet = type === "audio" ? ALLOWED_AUDIO : ALLOWED_VIDEO;
  if (!allowedSet.has(file.type)) {
    const hint = type === "audio"
      ? "Formats acceptés : .ogg, .mp3, .m4a, .aac"
      : "Formats acceptés : .mp4";
    return NextResponse.json({ error: `Type MIME non supporté (${file.type}). ${hint}` }, { status: 400 });
  }

  // Validate size
  const maxBytes = type === "audio" ? MAX_AUDIO_B : MAX_VIDEO_B;
  if (file.size > maxBytes) {
    const maxMb = type === "audio" ? MAX_AUDIO_MB : MAX_VIDEO_MB;
    return NextResponse.json({ error: `Fichier trop lourd — max ${maxMb} Mo` }, { status: 400 });
  }

  // Derive path  — always overwrite to keep one file per type per agent
  const ext         = MIME_TO_EXT[file.type] ?? (type === "audio" ? "ogg" : "mp4");
  const storagePath = `${agentId}/welcome_${type}.${ext}`;

  try {
    const supabase = createServerClient();
    await ensureBucket(supabase);

    // Convert File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert:      true,   // overwrite if same name
        duplex:      "half",
      } as Parameters<ReturnType<typeof supabase.storage.from>["upload"]>[2]);

    if (uploadErr) {
      console.error("[POST /api/agents/:id/media] Storage upload:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // Build public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Persist URL in capabilities
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
    const supabase = createServerClient();

    // Try to remove all possible extensions (we don't know which was uploaded)
    const exts  = type === "audio" ? AUDIO_EXTS : VIDEO_EXTS;
    const paths = exts.map((e) => `${agentId}/welcome_${type}.${e}`);
    await supabase.storage.from(BUCKET).remove(paths);
    // Ignore remove errors — file may not exist under all extensions

    // Clear URL from capabilities
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
