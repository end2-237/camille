// ─────────────────────────────────────────────────────────────────────────────
// Webhooks sortants.
//
// Le site d'un marchand ne peut pas deviner qu'une commande vient de passer en
// livraison. Deux façons de le lui dire : qu'il interroge Camille en boucle, ou
// que Camille l'appelle une fois, au moment où ça arrive. C'est la seconde.
//
// Le corps est signé en HMAC-SHA256 avec le secret de l'agent : le site sait
// que l'appel vient bien de Camille et pas d'un tiers qui connaît son URL.
//
//   X-Camille-Event      order.status_changed
//   X-Camille-Signature  sha256=<hex du corps>
//
// Best-effort de bout en bout : un webhook injoignable ne doit JAMAIS empêcher
// une commande d'avancer. Le commerçant travaille, le site suivra.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "crypto";
import { query } from "@/lib/db";

const TIMEOUT_MS = 4000;

export function sign(secret: string, body: string) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

type Endpoint = { url: string; secret: string | null };

async function endpointFor(agentId: string): Promise<Endpoint | null> {
  try {
    const r = await query(
      "SELECT webhook_url, webhook_secret FROM camille.agents WHERE id = $1",
      [agentId]
    );
    const url = r.rows[0]?.webhook_url;
    if (!url || !/^https?:\/\//i.test(url)) return null;
    return { url, secret: r.rows[0]?.webhook_secret ?? null };
  } catch {
    // 42703 : migration_site_integration.sql pas encore appliquée. Aucun
    // webhook configuré, donc rien à envoyer — ce n'est pas une erreur.
    return null;
  }
}

/**
 * Prévient le site du marchand. Ne lève jamais.
 * @returns true si le site a répondu 2xx.
 */
export async function notify(agentId: string, event: string, data: unknown): Promise<boolean> {
  const ep = await endpointFor(agentId);
  if (!ep) return false;

  const body = JSON.stringify({ event, sent_at: new Date().toISOString(), data });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Camille-Event": event,
  };
  if (ep.secret) headers["X-Camille-Signature"] = sign(ep.secret, body);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ep.url, { method: "POST", headers, body, signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
