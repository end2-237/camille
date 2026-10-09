import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { egalConstant } from "@/lib/interne";
import { sortirDeLEssai } from "@/lib/essai";
import { envoyerRecu } from "@/lib/recu";

const MONETBIL_SERVICE_SECRET = process.env.MONETBIL_SERVICE_SECRET!;

/** Monetbil pings GET to verify the notify_url is reachable. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

/**
 * Signature Monetbil (SDK officiel) : md5(secret + valeurs des paramètres triés
 * par nom, « sign » exclu). L'ancienne variante HMAC-SHA1(ref + statut) reste
 * acceptée si elle correspond.
 */
function signatureValide(params: Record<string, string>): boolean {
  const sign = (params.sign || "").toLowerCase();
  if (!sign || !MONETBIL_SERVICE_SECRET) return false;
  const reste = Object.keys(params).filter((k) => k !== "sign").sort();
  const md5 = crypto.createHash("md5")
    .update(MONETBIL_SERVICE_SECRET + reste.map((k) => params[k]).join(""))
    .digest("hex");
  if (egalConstant(md5, sign)) return true;
  const ancien = crypto.createHmac("sha1", MONETBIL_SERVICE_SECRET)
    .update((params.payment_ref || "") + (params.status || "").toLowerCase())
    .digest("hex");
  return egalConstant(ancien, sign);
}

/**
 * Demande à Monetbil lui-même où en est la transaction. Seule source de vérité
 * quand la notification n'est pas signée : ce qu'un inconnu poste ici ne
 * prouve rien.
 */
async function confirmerAupresDeMonetbil(transactionId: string): Promise<{ ok: boolean; amount?: number; ref?: string }> {
  if (!transactionId) return { ok: false };
  try {
    const r = await fetch("https://api.monetbil.com/payment/v1/checkPayment", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ paymentId: transactionId }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const d = (await r.json().catch(() => ({}))) as { transaction?: Record<string, unknown> };
    const t = d.transaction;
    if (!t) return { ok: false };
    return {
      ok: String(t.status) === "1",
      amount: t.amount != null ? Number(t.amount) : undefined,
      ref: t.payment_ref != null ? String(t.payment_ref) : undefined,
    };
  } catch (e) {
    console.error("[notify] checkPayment injoignable :", e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── Parse body — accept both JSON and form-encoded ────────────────────────
    const contentType = req.headers.get("content-type") ?? "";
    const params: Record<string, string> = {};
    if (contentType.includes("application/json")) {
      const data = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(data)) if (v != null) params[k] = String(v);
    } else {
      // application/x-www-form-urlencoded or multipart
      const text = await req.text();
      for (const [k, v] of new URLSearchParams(text)) params[k] = v;
    }

    // ── Sanitise ──────────────────────────────────────────────────────────────
    const paymentRef = (params.payment_ref ?? params.paymentRef ?? "").trim();
    const status = (params.status ?? "").trim();
    const transactionId = (params.transaction_id ?? params.transactionId ?? "").trim();

    console.info("[notify] payment_ref=%s status=%s", paymentRef, status);

    // ── Authenticité ──────────────────────────────────────────────────────────
    // Signature présente : elle doit être juste. Absente : on ne croit le
    // « succès » que si Monetbil le confirme (vérifié plus bas).
    const signee = !!params.sign;
    if (signee && !signatureValide(params)) {
      console.error("[notify] Invalid signature for ref=%s", paymentRef);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // ── Look up payment ───────────────────────────────────────────────────────
    if (!paymentRef) {
      return NextResponse.json({ ok: true }); // nothing to do
    }

    const paymentResult = await query(
      `SELECT id, user_id, agent_id, plan_id, amount, status AS payment_status
       FROM camille.payments
       WHERE id = $1`,
      [paymentRef]
    );

    if (paymentResult.rows.length === 0) {
      // ACK anyway — we may not have the record (race or duplicate notify)
      console.warn("[notify] Payment not found for ref=%s", paymentRef);
      return NextResponse.json({ ok: true });
    }

    const payment = paymentResult.rows[0] as {
      id: string;
      user_id: string;
      agent_id: string;
      plan_id: string;
      amount: number;
      payment_status: string;
    };

    // ── Idempotency guard ─────────────────────────────────────────────────────
    if (payment.payment_status === "success") {
      return NextResponse.json({ ok: true });
    }

    // ── Determine outcome ─────────────────────────────────────────────────────
    const isSuccess =
      status === "success" ||
      status === "successfull" || // Monetbil typo present in some versions
      status === "1";

    // Sans signature, un « succès » doit être confirmé par Monetbil, pour CE
    // paiement et CE montant ; sinon on laisse le paiement en attente.
    if (isSuccess && !signee) {
      const c = await confirmerAupresDeMonetbil(transactionId);
      const montantOk = c.amount == null || Number(c.amount) >= Number(payment.amount);
      const refOk = !c.ref || c.ref === paymentRef;
      if (!c.ok || !montantOk || !refOk) {
        console.warn("[notify] succès non confirmé par Monetbil pour ref=%s — ignoré", paymentRef);
        return NextResponse.json({ ok: true });
      }
    }

    if (isSuccess) {
      // Mark payment as succeeded
      await query(
        `UPDATE camille.payments
         SET status = 'success',
             transaction_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [transactionId || null, paymentRef]
      );

      // Upgrade the agent's plan, et poser la date de fin.
      //
      // Sans cette date, l'agent restait actif indefiniment apres le mois paye :
      // rien en base ne disait jusqu'a quand le paiement courait. On repart de
      // la fin en cours quand elle est encore devant, pour qu'un renouvellement
      // anticipe s'ajoute au lieu de raccourcir l'abonnement.
      //
      // free et enterprise n'ont pas de terme : le premier n'a rien a
      // renouveler, le second ne doit jamais pouvoir etre desactive.
      await query(
        `UPDATE camille.agents
         SET plan = $1,
             plan_expires_at = CASE
               WHEN $1 IN ('free', 'enterprise') THEN NULL
               ELSE GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + INTERVAL '1 month'
             END,
             updated_at = NOW()
         WHERE id = $2`,
        [payment.plan_id, payment.agent_id]
      );

      // Payer termine l'essai ; le reçu part au propriétaire.
      await sortirDeLEssai(payment.agent_id);
      await envoyerRecu(paymentRef);

      console.info(
        "[notify] Payment SUCCESS ref=%s plan=%s agent=%s",
        paymentRef,
        payment.plan_id,
        payment.agent_id
      );
    } else {
      // Mark payment as failed
      await query(
        `UPDATE camille.payments
         SET status = 'failed',
             updated_at = NOW()
         WHERE id = $1`,
        [paymentRef]
      );

      console.info(
        "[notify] Payment FAILED ref=%s status=%s",
        paymentRef,
        status
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/payments/notify]", err);
    // Always return 200 to prevent Monetbil from retrying infinitely
    return NextResponse.json({ ok: true });
  }
}
