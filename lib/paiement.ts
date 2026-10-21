// ─────────────────────────────────────────────────────────────────────────────
// Les abonnements Camille (forfaits, option Site) encaissés par buyfacturation.
//
// Pas les commandes des clients : celles-là se paient au commerçant.
//
// Un seul compte pawaPay pour toute la maison, et pawaPay n'accepte qu'une
// adresse de rappel : c'est buyfacturation qui lui parle, et Camille qui parle
// à buyfacturation (POST /api/v1/collectes, clé de l'app « camille » dans
// BUYFACT_APPS côté buyfacturation). La notification est signée ; on ne la
// croit pas pour autant : le statut est toujours redemandé avec la clé.
//
// Configuration :
//   BUYFACT_URL             l'adresse de buyfacturation (déjà utilisée pour les bons)
//   BUYFACT_COLLECTES_KEY   la clé de l'app « camille » pour les collectes
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from "crypto";
import { query } from "@/lib/db";
import { sortirDeLEssai } from "@/lib/essai";
import { envoyerRecu } from "@/lib/recu";

const env = (k: string) => process.env[k]?.trim() ?? "";
const base = () => (env("BUYFACT_URL") || "https://pay.buyticle.com").replace(/\/+$/, "");
const cle = () => env("BUYFACT_COLLECTES_KEY");

export const buyfacturationActive = () => Boolean(cle());

export type Operateur = "MTN" | "ORANGE";
export type StatutCollecte = "pending" | "success" | "failed";

const lireStatut = (s?: string): StatutCollecte => (s === "COMPLETED" ? "success" : s === "FAILED" || s === "EXPIRED" ? "failed" : "pending");

/** 6XXXXXXXX (avec ou sans +237, espaces) → 2376XXXXXXXX ; null sinon. */
export function msisdn(numero: string): string | null {
  const d = String(numero || "").replace(/\D/g, "").replace(/^00/, "");
  const local = d.startsWith("237") ? d.slice(3) : d;
  return /^6\d{8}$/.test(local) ? `237${local}` : null;
}

/** L'opérateur déduit du numéro camerounais. MTN : 67, 650-654, 680-684 ; Orange : 69, 655-659, 685-689. */
export function operateurDe(numero: string): Operateur | null {
  const n = msisdn(numero)?.slice(3);
  if (!n) return null;
  if (/^(67|65[0-4]|68[0-4])/.test(n)) return "MTN";
  if (/^(69|65[5-9]|68[5-9])/.test(n)) return "ORANGE";
  return null;
}

/**
 * Les opérateurs ouverts à l'encaissement. BUYFACT_OPERATEURS (« MTN » ou
 * « MTN,ORANGE ») tranche s'il est posé ; sinon on demande à buyfacturation
 * ce que le compte pawaPay autorise réellement, toutes les 5 minutes. Faute
 * de réponse : MTN seul — mieux vaut griser Orange à tort que laisser un
 * commerçant attendre une demande qui n'arrivera jamais.
 */
let memo: { ops: Operateur[]; jusqua: number } | null = null;

export async function operateursOuverts(): Promise<Operateur[]> {
  const force = env("BUYFACT_OPERATEURS").toUpperCase();
  if (force) return (["MTN", "ORANGE"] as Operateur[]).filter((o) => force.includes(o));
  if (memo && memo.jusqua > Date.now()) return memo.ops;
  try {
    const r = await fetch(`${base()}/api/v1/operateurs`, { headers: { "x-api-key": cle() }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = (await r.json()) as { operateurs?: { provider?: string; operations?: { type?: string; statut?: string }[] }[] };
    const ouverts = (d.operateurs ?? []).filter((o) =>
      (o.operations ?? []).some((op) => op.type === "DEPOSIT" && (op.statut ?? "OPERATIONAL") === "OPERATIONAL")
    );
    const ops: Operateur[] = [];
    if (ouverts.some((o) => /MTN/i.test(o.provider ?? ""))) ops.push("MTN");
    if (ouverts.some((o) => /ORANGE/i.test(o.provider ?? ""))) ops.push("ORANGE");
    memo = { ops: ops.length ? ops : ["MTN"], jusqua: Date.now() + 5 * 60_000 };
  } catch {
    memo = { ops: memo?.ops ?? ["MTN"], jusqua: Date.now() + 60_000 };
  }
  return memo.ops;
}

async function appel(chemin: string, init: RequestInit = {}) {
  const r = await fetch(base() + chemin, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/json", "x-api-key": cle(), ...(init.headers ?? {}) },
  });
  const corps = (await r.json().catch(() => ({}))) as { reference?: string; statut?: string; raison?: string | null; error?: string };
  return { http: r.status, corps };
}

/** Lance la demande Mobile Money. `reference` : UUID v4, c'est aussi l'id du paiement. */
export async function lancerCollecte(p: {
  reference: string; montant: number; numero: string; operateur?: Operateur | null; description: string; callbackUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { http, corps } = await appel("/api/v1/collectes", {
      method: "POST",
      // Opérateur inconnu : buyfacturation le déduit lui-même du numéro.
      body: JSON.stringify({ ...p, operateur: p.operateur || undefined, numero: msisdn(p.numero) }),
    });
    if (http >= 400 || corps.statut === "FAILED") return { ok: false, error: corps.raison || corps.error || `buyfacturation HTTP ${http}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `buyfacturation injoignable : ${(e as Error).message}` };
  }
}

/** Où en est la collecte, d'après buyfacturation lui-même. */
export async function statutCollecte(reference: string): Promise<StatutCollecte | null> {
  try {
    const { http, corps } = await appel(`/api/v1/collectes/${encodeURIComponent(reference)}`);
    if (http === 404) return "pending";
    if (http >= 400) return null;
    return lireStatut(corps.statut);
  } catch {
    return null;
  }
}

/** La référence d'une notification signée par buyfacturation ; null si la signature ne tient pas. */
export function referenceSignee(corpsBrut: string, signature: string | null): string | null {
  const k = cle();
  const donnee = (signature || "").replace(/^sha256=/, "");
  const attendue = createHmac("sha256", k).update(corpsBrut).digest("hex");
  if (!k || donnee.length !== attendue.length) return null;
  if (!timingSafeEqual(Buffer.from(donnee), Buffer.from(attendue))) return null;
  try {
    const ref = (JSON.parse(corpsBrut) as { reference?: string }).reference;
    return ref ? String(ref) : null;
  } catch {
    return null;
  }
}

/**
 * Le paiement est confirmé : on le marque, et on donne ce qui a été payé —
 * un mois de forfait, ou un mois d'option Site. Idempotent : le second appel
 * (notification puis vérification, ou deux notifications) ne prolonge rien.
 *
 * Un renouvellement anticipé s'ajoute à la fin en cours au lieu de la
 * raccourcir. free et enterprise n'ont pas de terme.
 */
export async function appliquerPaiement(ref: string, transactionId: string | null = null): Promise<boolean> {
  const r = await query(
    `UPDATE camille.payments SET status = 'success', transaction_id = COALESCE($2, transaction_id), updated_at = NOW()
      WHERE id = $1 AND status <> 'success'
      RETURNING agent_id, plan_id, COALESCE(to_jsonb(payments)->>'kind', 'forfait') AS kind`,
    [ref, transactionId]
  );
  const p = r.rows[0] as { agent_id: string; plan_id: string; kind: string } | undefined;
  if (!p) return false;

  if (p.kind === "site") {
    await query(
      `UPDATE camille.agents
          SET site_expires_at = GREATEST(COALESCE(site_expires_at, NOW()), NOW()) + INTERVAL '1 month', updated_at = NOW()
        WHERE id = $1`,
      [p.agent_id]
    );
  } else {
    await query(
      `UPDATE camille.agents
          SET plan = $1,
              plan_expires_at = CASE
                WHEN $1 IN ('free', 'enterprise') THEN NULL
                ELSE GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + INTERVAL '1 month'
              END,
              updated_at = NOW()
        WHERE id = $2`,
      [p.plan_id, p.agent_id]
    );
    await sortirDeLEssai(p.agent_id);
  }
  await envoyerRecu(ref);
  console.info("[paiement] confirmé ref=%s %s agent=%s", ref, p.kind === "site" ? "option Site" : `forfait ${p.plan_id}`, p.agent_id);
  return true;
}

/** Échec : le paiement en attente passe en échec, rien d'autre ne bouge. */
export async function marquerEchec(ref: string) {
  await query(`UPDATE camille.payments SET status = 'failed', updated_at = NOW() WHERE id = $1 AND status = 'pending'`, [ref]);
}
