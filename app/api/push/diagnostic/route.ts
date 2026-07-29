// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/push/diagnostic — vérifie chaque maillon de la chaîne push.
// POST /api/push/diagnostic — envoie une notification de test sur ses appareils.
//
// « Je ne reçois pas de notification » a cinq causes possibles ; deviner coûte
// plus cher que de rendre la chaîne observable.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";
import crypto from "crypto";

type Check = { ok: boolean; label: string; detail?: string; fix?: string };

async function checkServiceAccount(): Promise<Check & { projectId?: string }> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return {
      ok: false,
      label: "Compte de service Firebase",
      detail: "Variable FIREBASE_SERVICE_ACCOUNT_JSON absente",
      fix: "Console Firebase → Paramètres du projet → Comptes de service → Générer une clé privée, puis coller le JSON dans Coolify.",
    };
  }
  try {
    const j = JSON.parse(raw);
    if (!j.client_email || !j.private_key || !j.project_id) {
      return { ok: false, label: "Compte de service Firebase", detail: "JSON incomplet (client_email / private_key / project_id)" };
    }
    return { ok: true, label: "Compte de service Firebase", detail: j.project_id, projectId: j.project_id };
  } catch {
    return { ok: false, label: "Compte de service Firebase", detail: "JSON illisible — vérifie qu'il est bien sur une seule ligne" };
  }
}

// Un compte de service peut être présent mais refusé (clé révoquée, horloge
// décalée…). On tente réellement l'échange de jeton OAuth.
async function checkFirebaseAuth(): Promise<Check> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { ok: false, label: "Authentification Firebase", detail: "non testée (pas de compte de service)" };
  try {
    const sa = JSON.parse(raw);
    const key = String(sa.private_key).replace(/\\n/g, "\n");
    const now = Math.floor(Date.now() / 1000);
    const b64 = (b: string) =>
      Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const h = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const c = b64(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now, exp: now + 3600,
    }));
    const sig = Buffer.from(crypto.createSign("RSA-SHA256").update(`${h}.${c}`).sign(key))
      .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${h}.${c}.${sig}`,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, label: "Authentification Firebase", detail: `refusée (${res.status}) ${t.slice(0, 160)}` };
    }
    return { ok: true, label: "Authentification Firebase", detail: "jeton OAuth obtenu" };
  } catch (e) {
    return { ok: false, label: "Authentification Firebase", detail: (e as Error).message };
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const checks: Check[] = [];

  // 1. La table existe-t-elle ?
  let tokens: { token: string; platform: string; active: boolean; last_error: string | null }[] = [];
  try {
    const r = await query(
      "SELECT token, platform, active, last_error FROM camille.push_tokens WHERE user_id = $1 ORDER BY updated_at DESC",
      [user.id]
    );
    tokens = r.rows;
    checks.push({ ok: true, label: "Table des jetons", detail: "présente" });
  } catch (e) {
    checks.push({
      ok: false,
      label: "Table des jetons",
      detail: (e as Error).message,
      fix: "Applique migration_push.sql",
    });
  }

  // 2. Un appareil est-il enregistré ?
  const active = tokens.filter((t) => t.active);
  checks.push({
    ok: active.length > 0,
    label: "Appareil enregistré",
    detail: `${active.length} actif(s) sur ${tokens.length}`,
    fix: active.length
      ? undefined
      : "Réinstalle l'APK (expo-notifications est un module natif, l'OTA ne suffit pas) puis reconnecte-toi et accepte les notifications.",
  });

  const rejected = tokens.filter((t) => !t.active && t.last_error);
  if (rejected.length) {
    checks.push({
      ok: false,
      label: "Jetons refusés par Firebase",
      detail: `${rejected.length} — ${String(rejected[0].last_error).slice(0, 120)}`,
    });
  }

  // 3 & 4. Configuration et authentification Firebase
  const sa = await checkServiceAccount();
  checks.push(sa);
  if (sa.ok) checks.push(await checkFirebaseAuth());

  return NextResponse.json({
    ready: checks.every((c) => c.ok),
    checks,
    tokens: active.map((t) => ({ platform: t.platform, tail: t.token.slice(-8) })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const r = await notifyUser(user.id, "systeme", {
    title: "Test Camille ✅",
    body: "Si tu vois ce message, les notifications fonctionnent.",
    data: { type: "test" },
    channel: "commandes",
  });
  return NextResponse.json({ ...r, ok: r.sent > 0 });
}
