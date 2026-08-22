// ─────────────────────────────────────────────────────────────────────────────
// Médiathèque d'un agent — camille.agents.media
//
//   GET    → la liste, normalisée
//   POST   → envoie une image (multipart) et l'ajoute à la liste
//   PATCH  → remplace la liste (ordre, légendes, natures)
//   DELETE → retire une entrée, et le fichier avec
//
// Rien ici n'est propre à un métier : ce sont des visuels typés, que chaque
// surface consomme comme elle l'entend (site vitrine via l'API publique,
// WhatsApp, bon de commande). Un marchand qui n'a pas de rayons n'utilise
// simplement pas la nature « category ».
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
// Un fichier de route Next n'exporte que ses verbes HTTP : la liste vit à côté.
import { MEDIA_KINDS } from "@/lib/mediaKinds";

type RouteContext = { params: Promise<{ agentId: string }> };

type MediaItem = { id: string; kind: string; url: string; caption: string };

const coreUrl = () => (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");
const coreKey = () => process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

/** Un identifiant stable même pour les entrées créées avant ce champ. */
const idFor = (url: string) => crypto.createHash("sha1").update(url).digest("hex").slice(0, 12);

function normalize(raw: unknown): MediaItem[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const url = String(o.url ?? "").trim();
      if (!url) return null;
      const kind = String(o.kind ?? "gallery");
      return {
        id: String(o.id ?? idFor(url)),
        kind: (MEDIA_KINDS as readonly string[]).includes(kind) ? kind : "gallery",
        url,
        caption: String(o.caption ?? "").slice(0, 80),
      };
    })
    .filter(Boolean) as MediaItem[];
}

async function owned(agentId: string, userId: string) {
  const r = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, userId]
  );
  return r.rows.length > 0;
}

async function readMedia(agentId: string): Promise<MediaItem[]> {
  // to_jsonb : sur une base où migration_agent_media.sql n'est pas passée, on
  // renvoie une médiathèque vide plutôt qu'une erreur 500.
  const r = await query("SELECT (to_jsonb(a)->'media') AS media FROM camille.agents a WHERE id = $1", [agentId]);
  return normalize(r.rows[0]?.media);
}

async function writeMedia(agentId: string, items: MediaItem[]) {
  await query("UPDATE camille.agents SET media = $1::jsonb, updated_at = NOW() WHERE id = $2", [
    JSON.stringify(items),
    agentId,
  ]);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await owned(agentId, user.id))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  try {
    return NextResponse.json({ media: await readMedia(agentId), kinds: MEDIA_KINDS });
  } catch (e) {
    return NextResponse.json(
      { error: "Médiathèque indisponible — applique migration_site_integration.sql", detail: (e as Error).message },
      { status: 503 }
    );
  }
}

// ── POST — ajouter un visuel ─────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await owned(agentId, user.id))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Corps invalide (multipart attendu)" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  const kindRaw = String(form.get("kind") ?? "gallery");
  const kind = (MEDIA_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "gallery";
  const caption = String(form.get("caption") ?? "").slice(0, 80);

  if (!file) return NextResponse.json({ error: "Champ file requis" }, { status: 400 });

  const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!okTypes.includes(file.type)) {
    return NextResponse.json({ error: "Format accepté : JPG, PNG, WEBP, GIF" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image trop lourde (max 5 Mo)" }, { status: 400 });
  }

  // Un visuel de rayon sans légende ne sert à rien : c'est la légende qui dit
  // à quel rayon il appartient.
  if (kind === "category" && !caption) {
    return NextResponse.json(
      { error: "Donne le nom exact du rayon en légende, sinon le visuel ne sera rattaché à rien." },
      { status: 400 }
    );
  }

  try {
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const filename = `${agentId.replace(/-/g, "")}_${kind}_${Date.now()}.${ext}`;
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const up = await fetch(`${coreUrl()}/api/media/upload`, {
      method: "POST",
      headers: { "X-Api-Key": coreKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: filename, data: base64, mimeType: file.type }),
    });
    if (!up.ok) {
      const text = await up.text();
      throw new Error(`Camille Core: ${up.status} — ${text.slice(0, 200)}`);
    }
    const { url } = (await up.json()) as { url: string };

    const items = await readMedia(agentId);
    // Logo et bandeau sont uniques par nature : en ajouter un remplace l'autre,
    // sinon le site ne saurait pas lequel afficher.
    const kept = kind === "logo" || kind === "banner" ? items.filter((m) => m.kind !== kind) : items;
    const item: MediaItem = { id: idFor(url), kind, url, caption };
    await writeMedia(agentId, [...kept, item]);

    return NextResponse.json({ item, media: [...kept, item] }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/agents/:id/visuals]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── PATCH — ordre, légendes, natures ─────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await owned(agentId, user.id))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const items = normalize(body?.media).slice(0, 60);

  try {
    await writeMedia(agentId, items);
    return NextResponse.json({ media: items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── DELETE — retirer un visuel ───────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  if (!(await owned(agentId, user.id))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }

  const id = req.nextUrl.searchParams.get("id") || "";
  const items = await readMedia(agentId);
  const target = items.find((m) => m.id === id);
  if (!target) return NextResponse.json({ error: "Visuel introuvable" }, { status: 404 });

  await writeMedia(agentId, items.filter((m) => m.id !== id));

  // Le fichier part aussi : garder des images orphelines sur le disque de core
  // finit par le remplir. Best-effort — l'entrée est déjà retirée.
  const filename = target.url.split("/media/").pop();
  if (filename) {
    fetch(`${coreUrl()}/api/media/${encodeURIComponent(filename)}`, {
      method: "DELETE",
      headers: { "X-Api-Key": coreKey() },
    }).catch(() => {});
  }

  return NextResponse.json({ media: items.filter((m) => m.id !== id) });
}
