// ─────────────────────────────────────────────────────────────────────────────
// Les appels « internes » : ceux de n8n (et des autres automatismes de la
// plateforme) vers les routes qui pilotent un agent sans session utilisateur.
//
// Ces routes se contentaient de connaître l'identifiant d'agent ou le nom de
// session — or l'identifiant est public (lien du catalogue) et le nom de
// session s'en déduit. Elles exigent maintenant l'en-tête :
//
//   X-Camille-Key: <CAMILLE_INTERNAL_KEY>
//
// Sans variable CAMILLE_INTERNAL_KEY, aucun appel interne n'est accepté : pas
// de valeur par défaut, qui finirait connue de tous.
//
// Transition : CAMILLE_INTERNAL_KEY_SOUPLE=1 laisse passer un appel sans clé en
// l'écrivant dans les journaux (« [interne] appel sans clé : … »), le temps de
// mettre tous les workflows à jour. Une clé FAUSSE est refusée même alors.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { query } from "@/lib/db";
import { getUserFromRequest, type AuthUser } from "@/lib/auth-server";
import { peut, type Action } from "@/lib/equipe";

export function egalConstant(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** L'appel porte-t-il la clé interne (ou est-il toléré sans clé en mode souple) ? */
export function appelInterne(req: NextRequest, opts: { strict?: boolean } = {}): boolean {
  const attendue = process.env.CAMILLE_INTERNAL_KEY || "";
  const recue = req.headers.get("x-camille-key") || "";
  if (attendue && recue) return egalConstant(recue, attendue);
  // Le mode souple ne s'applique jamais aux routes « strictes » (secrets tiers).
  if (!opts.strict && !recue && process.env.CAMILLE_INTERNAL_KEY_SOUPLE === "1" && !req.headers.get("authorization")) {
    console.warn(`[interne] appel sans clé toléré : ${req.method} ${req.nextUrl.pathname}`);
    return true;
  }
  return false;
}

export const refusInterne = () =>
  NextResponse.json({ error: "Clé interne absente ou invalide" }, { status: 401 });

/** L'utilisateur peut-il agir sur cet agent (propriétaire ou collaborateur) ? */
export async function possedeAgent(userId: string, agentId: string, action: Action = "ventes"): Promise<boolean> {
  return peut(userId, agentId, action, { archives: true });
}

/**
 * Accès à un agent : appel interne, ou utilisateur connecté qui le possède.
 * Renvoie null si l'accès est accordé, sinon la réponse d'erreur à renvoyer.
 */
export async function accesAgent(
  req: NextRequest,
  agentId: string,
  action: Action = "ventes"
): Promise<{ refus: NextResponse | null; user: AuthUser | null; interne: boolean }> {
  if (appelInterne(req)) return { refus: null, user: null, interne: true };
  const user = await getUserFromRequest(req);
  if (!user) return { refus: refusInterne(), user: null, interne: false };
  if (!(await possedeAgent(user.id, agentId, action))) {
    return { refus: NextResponse.json({ error: "Agent introuvable" }, { status: 404 }), user, interne: false };
  }
  return { refus: null, user, interne: false };
}

/** Même chose, à partir d'un nom de session WhatsApp. */
export async function accesSession(req: NextRequest, session: string): Promise<NextResponse | null> {
  if (appelInterne(req)) return null;
  const user = await getUserFromRequest(req);
  if (!user) return refusInterne();
  const r = await query(
    `SELECT agent_id FROM camille.whatsapp_sessions WHERE session_name = $1`,
    [session]
  );
  const agentId = r.rows[0]?.agent_id as string | undefined;
  return agentId && (await peut(user.id, agentId, "ventes", { archives: true }))
    ? null
    : NextResponse.json({ error: "Session introuvable" }, { status: 404 });
}
