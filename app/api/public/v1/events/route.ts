// ─────────────────────────────────────────────────────────────────────────────
// POST /api/public/v1/events
//
// Le site du marchand raconte ce qui s'y passe : pages vues, produits
// consultés, paniers, commandes entamées. Camille sait déjà ce qui a été
// acheté ; ceci lui apprend ce qui a été regardé sans être acheté — la seule
// façon de dire à un commerçant « on vient chez toi, mais on repart du panier ».
//
// Clé PUBLIQUE : l'appel part du navigateur du visiteur, comme la lecture du
// catalogue, et reste borné aux domaines déclarés par le marchand.
//
//   navigator.sendBeacon("/api/public/v1/events", JSON.stringify({...}))
//
// Rien de nominatif n'est enregistré : pas d'IP, pas de cookie tiers, pas
// d'adresse. Le « visiteur » est un identifiant aléatoire que le site pose
// lui-même dans le stockage local du navigateur.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { authenticate, json, preflight } from "@/lib/publicApi";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Natures acceptées. Une nature inconnue devient une page vue. */
const KINDS = ["page_view", "product_view", "add_to_cart", "checkout_start", "order", "search"] as const;

/** Au-delà, c'est un robot ou une erreur de boucle : on écrête. */
const MAX_EVENTS = 20;

const BOT = /bot|crawler|spider|crawling|headless|preview|lighthouse|pingdom|monitor/i;

const clip = (v: unknown, n: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, n) : null;
};

/** On ne garde du référent que son domaine : le reste est du bruit. */
function refHost(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try {
    return new URL(s).hostname.replace(/^www\./, "").slice(0, 80);
  } catch {
    return s.replace(/^www\./, "").slice(0, 80);
  }
}

/** Le chemin, jamais l'URL complète : un domaine n'apprend rien de plus. */
function path(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s, "https://x.invalid");
    return `${u.pathname}${u.search}`.slice(0, 200);
  } catch {
    return s.slice(0, 200);
  }
}

const device = (v: unknown, ua: string) => {
  const given = String(v ?? "").toLowerCase();
  if (given === "mobile" || given === "tablet" || given === "desktop") return given;
  if (/ipad|tablet/i.test(ua)) return "tablet";
  return /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";
};

/** Recopie la clé du paramètre `key` dans l'en-tête attendu, si besoin. */
function requestWithKey(req: NextRequest): NextRequest {
  if (req.headers.get("x-camille-key") || req.headers.get("authorization")) return req;
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return req;
  const headers = new Headers(req.headers);
  headers.set("x-camille-key", key);
  // Le corps a déjà été lu : cette requête ne sert qu'à porter les en-têtes.
  return new NextRequest(req.url, { headers });
}

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  // Un robot d'indexation n'est pas un client : le compter fausserait tout.
  if (BOT.test(ua)) return json({ ok: true, ignored: "bot" }, 202, req);

  // sendBeacon envoie du text/plain : req.json() suffit rarement.
  let body: any = {};
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: "corps JSON invalide" }, 400, req);
  }

  // navigator.sendBeacon ne sait pas poser d'en-tête : la clé publique peut
  // donc arriver en paramètre. Elle est de lecture seule et reste bornée aux
  // domaines déclarés — c'est le prix d'une mesure qui survit à la fermeture
  // de l'onglet. Seule cette route l'accepte.
  const auth = await authenticate(requestWithKey(req), "public");
  if ("error" in auth) return auth.error;

  const list: any[] = Array.isArray(body.events) ? body.events : [body];
  const events = list.filter((e) => e && typeof e === "object").slice(0, MAX_EVENTS);
  if (!events.length) return json({ error: "aucun événement" }, 400, req);

  const rows: any[][] = events.map((e) => [
    auth.key.agent_id,
    (KINDS as readonly string[]).includes(String(e.kind)) ? String(e.kind) : "page_view",
    path(e.path ?? e.url),
    clip(e.title, 160),
    refHost(e.referrer),
    clip(e.visitor, 64),
    clip(e.session ?? e.session_id, 64),
    device(e.device, ua),
    clip(e.locale, 12),
    JSON.stringify(e.meta && typeof e.meta === "object" ? e.meta : {}).slice(0, 2000),
  ]);

  // Une seule insertion pour tout le lot : le navigateur n'attend pas.
  const values = rows
    .map((_, i) => {
      const o = i * 10;
      return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10}::jsonb)`;
    })
    .join(",");

  try {
    await query(
      `INSERT INTO camille.site_events
         (agent_id, kind, path, title, referrer_host, visitor, session_id, device, locale, meta)
       VALUES ${values}`,
      rows.flat()
    );
  } catch (e) {
    // 42P01 = table absente : la migration n'est pas passée. On le dit une
    // fois, sans jamais casser la page du visiteur.
    if ((e as { code?: string }).code === "42P01") {
      return json(
        { ok: false, error: "Mesure d'audience non installée — applique migration_site_traffic.sql" },
        503, req
      );
    }
    return json({ ok: false }, 202, req);
  }

  return json({ ok: true, received: rows.length }, 202, req);
}
