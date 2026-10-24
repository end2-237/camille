// ─────────────────────────────────────────────────────────────────────────────
// POST   /api/agents/[agentId]/media  → upload audio ou vidéo vers Camille Core
// DELETE /api/agents/[agentId]/media?type=audio|video → supprime le fichier
// GET    /api/agents/[agentId]/media  → diagnostic
//
// Les fichiers sont stockés sur Camille Core (public/media/) et servis
// directement depuis https://camille-core.vps.buyticle.com/media/...
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { fichierDeLAgent } from "@/lib/fichiers";
import { ffmpegDisponible, preparerVideo } from "@/lib/video";

// ── Types ─────────────────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ agentId: string }> };

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_AUDIO_MB = 10;
// Une vidéo plus lourde est acceptée : elle est recompressée sous les 16 Mo
// de WhatsApp avant d'être stockée (voir lib/video.ts).
const MAX_VIDEO_MB = 300;
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

// ── Camille Core helpers ──────────────────────────────────────────────────────

function coreUrl(): string {
  return (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");
}

function coreKey(): string {
  return process.env.CAMILLE_CORE_API_KEY ?? "";
}

function coreHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "X-Api-Key": coreKey(), "Content-Type": "application/json", ...extra };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function readCapabilities(agentId: string): Promise<Record<string, unknown>> {
  const r = await query("SELECT capabilities FROM camille.agents WHERE id = $1", [agentId]);
  if (!r.rows.length) return {};
  const raw = r.rows[0].capabilities;
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try { return JSON.parse(raw as string); } catch { return {}; }
}

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

  const core = coreUrl();
  let coreTest = "non testé";
  try {
    const r = await fetch(`${core}/api/server/info`, { headers: { "X-Api-Key": coreKey() } });
    const txt = await r.text();
    coreTest = `HTTP ${r.status} — ${txt.slice(0, 200)}`;
  } catch (e) {
    coreTest = `Erreur: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    storageBackend: "Camille Core",
    coreUrl:        core,
    hasKey:         !!coreKey(),
    coreApiTest:    coreTest,
  });
}

// ── POST — upload ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;

  if (!(await peut(user.id, agentId, "reglages"))) {
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

  // Sans ffmpeg (développement local), pas de compression : on garde l'ancien plafond.
  const compression = type === "video" && (await ffmpegDisponible());
  const maxBytes = type === "audio" ? MAX_AUDIO_B : compression ? MAX_VIDEO_B : 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Fichier trop lourd — max ${Math.round(maxBytes / 1048576)} Mo` },
      { status: 400 }
    );
  }

  try {
    let octets: Buffer = Buffer.from(await file.arrayBuffer());
    let mime = file.type;
    let compression_info: { avant: number; apres: number } | null = null;
    // Une vidéo trop lourde ou mal encodée pour WhatsApp (HEVC, MOV, 10 bits…)
    // est recompressée ICI : ce qui est stocké part tel quel chez Meta.
    if (compression) {
      try {
        const prep = await preparerVideo(octets);
        if (prep.compressee) {
          compression_info = { avant: prep.avant.taille, apres: prep.apres.taille };
          octets = prep.octets;
          mime = "video/mp4";
        }
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 422 });
      }
    }

    const ext      = MIME_TO_EXT[mime] ?? (type === "audio" ? "ogg" : "mp4");
    // Nom de fichier unique : agentId_type_timestamp.ext
    const filename = `${agentId.replace(/-/g, "")}_welcome_${type}_${Date.now()}.${ext}`;

    // Envoyer vers Camille Core
    const uploadRes = await fetch(`${coreUrl()}/api/media/upload`, {
      method:  "POST",
      headers: coreHeaders(),
      body:    JSON.stringify({ name: filename, data: octets.toString("base64"), mimeType: mime }),
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Upload Camille Core: ${uploadRes.status} — ${text.slice(0, 300)}`);
    }

    const { url } = await uploadRes.json() as { url: string };

    // Supprimer l'ancienne URL de même type avant de sauvegarder la nouvelle
    const caps = await readCapabilities(agentId);

    // Effacer l'ancienne version du fichier sur Core si elle existe
    const oldUrl = caps[`welcome_${type}_url`] as string | undefined;
    if (oldUrl) {
      const oldFilename = fichierDeLAgent(oldUrl, agentId);
      if (oldFilename) {
        await fetch(`${coreUrl()}/api/media/${encodeURIComponent(oldFilename)}`, {
          method:  "DELETE",
          headers: { "X-Api-Key": coreKey() },
        }).catch(() => {});
      }
    }

    caps[`welcome_${type}_url`] = url;
    await writeCapabilities(agentId, caps);

    return NextResponse.json({ url, filename, compression: compression_info });

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

  if (!(await peut(user.id, agentId, "reglages"))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  try {
    // Lire l'URL actuelle depuis la DB pour supprimer le bon fichier
    const caps = await readCapabilities(agentId);
    const currentUrl = caps[`welcome_${type}_url`] as string | undefined;

    if (currentUrl) {
      const filename = fichierDeLAgent(currentUrl, agentId);
      if (filename) {
        await fetch(`${coreUrl()}/api/media/${encodeURIComponent(filename)}`, {
          method:  "DELETE",
          headers: { "X-Api-Key": coreKey() },
        }).catch(() => {});
      }
    }

    // Effacer l'URL en DB
    delete caps[`welcome_${type}_url`];
    await writeCapabilities(agentId, caps);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[DELETE /api/agents/:id/media]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
