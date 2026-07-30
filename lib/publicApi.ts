// ─────────────────────────────────────────────────────────────────────────────
// Authentification de l'API publique.
//
// Le site d'un client est un consommateur d'API comme un autre : il s'annonce
// avec une clé, Camille en déduit l'agent, et applique ses règles. Aucun
// couplage, aucun partage de base — juste un appel HTTP authentifié.
//
//   cam_pk_…  lecture du catalogue. Utilisable depuis un navigateur, mais
//             restreinte aux domaines déclarés par le marchand.
//   cam_sk_…  création de commandes. Serveur uniquement : elle ne doit
//             JAMAIS apparaître dans du code envoyé au navigateur.
//
// Seule l'empreinte SHA-256 est stockée : une clé perdue se révoque et se
// remplace, elle ne se retrouve pas.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";

export type ApiKeyRow = {
  id: string;
  agent_id: string;
  user_id: string;
  kind: "public" | "secret";
  origins: string[];
};

export const hashKey = (k: string) => crypto.createHash("sha256").update(k.trim()).digest("hex");

/** Génère une clé lisible : cam_pk_<32 caractères> */
export function generateKey(kind: "public" | "secret") {
  const raw = crypto.randomBytes(24).toString("base64url").slice(0, 32);
  return `cam_${kind === "public" ? "pk" : "sk"}_${raw}`;
}

function readKey(req: NextRequest): string {
  return (
    req.headers.get("x-camille-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    ""
  ).trim();
}

/**
 * Vérifie la clé et renvoie l'agent auquel elle donne accès.
 * @param need "public" accepte les deux natures ; "secret" exige une clé secrète.
 */
export async function authenticate(
  req: NextRequest,
  need: "public" | "secret"
): Promise<{ key: ApiKeyRow } | { error: NextResponse }> {
  const raw = readKey(req);
  if (!raw) {
    return { error: json({ error: "Clé manquante. Envoie l'en-tête X-Camille-Key." }, 401, req) };
  }

  // On ramène le statut plutôt que de filtrer dessus : un message qui confond
  // « clé inconnue », « clé révoquée » et « agent suspendu » envoie le marchand
  // régénérer des clés pendant des heures alors que le problème est ailleurs.
  let row: (ApiKeyRow & { revoked_at: string | null; agent_status: string }) | undefined;
  try {
    const r = await query(
      `SELECT k.id, k.agent_id, k.user_id, k.kind, k.origins, k.revoked_at,
              a.status AS agent_status
         FROM camille.api_keys k
         JOIN camille.agents a ON a.id = k.agent_id
        WHERE k.key_hash = $1`,
      [hashKey(raw)]
    );
    row = r.rows[0];
  } catch (e) {
    return {
      error: json(
        { error: "Intégration non configurée — applique migration_api_keys.sql", detail: (e as Error).message },
        503, req
      ),
    };
  }

  if (!row) {
    return { error: json({ error: "Clé inconnue. Vérifie qu'elle a été copiée entièrement." }, 401, req) };
  }
  if (row.revoked_at) {
    return { error: json({ error: "Clé révoquée. Génère-en une nouvelle depuis Intégrations." }, 401, req) };
  }
  if (row.agent_status !== "active") {
    return {
      error: json(
        {
          error: `Agent inactif (statut : ${row.agent_status}). La clé est bonne — c'est l'agent qu'il faut réactiver.`,
          agent_status: row.agent_status,
        },
        403, req
      ),
    };
  }

  // Une clé publique ne doit pas pouvoir créer de commande.
  if (need === "secret" && row.kind !== "secret") {
    return { error: json({ error: "Cette opération exige une clé secrète (cam_sk_…)." }, 403, req) };
  }

  // Domaines : ne s'applique qu'aux appels navigateur, qui portent Origin.
  const origin = req.headers.get("origin");
  const allowed = Array.isArray(row.origins) ? row.origins : [];
  if (origin && allowed.length && !allowed.some((o) => sameOrigin(o, origin))) {
    return { error: json({ error: `Domaine non autorisé : ${origin}` }, 403, req) };
  }

  // Compteur d'usage, best-effort : il ne doit jamais ralentir la réponse.
  query(
    "UPDATE camille.api_keys SET last_used_at = NOW(), calls_count = calls_count + 1 WHERE id = $1",
    [row.id]
  ).catch(() => {});

  return { key: row };
}

function sameOrigin(declared: string, actual: string) {
  try {
    const a = new URL(declared.includes("://") ? declared : `https://${declared}`);
    const b = new URL(actual);
    return a.host.toLowerCase() === b.host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Réponse JSON avec les en-têtes CORS.
 * On renvoie l'Origin reçue plutôt que "*" : la liste des domaines a déjà
 * été validée, et "*" empêcherait tout envoi de credentials plus tard.
 */
export function json(body: unknown, status = 200, req?: NextRequest) {
  const origin = req?.headers.get("origin");
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Camille-Key, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

/** Réponse au préflight CORS. */
export function preflight(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Camille-Key, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}
