import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";

const MONETBIL_SERVICE_SECRET = process.env.MONETBIL_SERVICE_SECRET!;

/** Monetbil pings GET to verify the notify_url is reachable. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    // ── Parse body — accept both JSON and form-encoded ────────────────────────
    const contentType = req.headers.get("content-type") ?? "";
    let paymentRef: string | undefined;
    let status: string | undefined;
    let transactionId: string | undefined;
    let sign: string | undefined;

    if (contentType.includes("application/json")) {
      const data = (await req.json()) as Record<string, unknown>;
      paymentRef = String(data.payment_ref ?? data.paymentRef ?? "");
      status = String(data.status ?? "");
      transactionId = String(data.transaction_id ?? data.transactionId ?? "");
      sign = data.sign ? String(data.sign) : undefined;
    } else {
      // application/x-www-form-urlencoded or multipart
      const text = await req.text();
      const params = new URLSearchParams(text);
      paymentRef = params.get("payment_ref") ?? params.get("paymentRef") ?? "";
      status = params.get("status") ?? "";
      transactionId =
        params.get("transaction_id") ?? params.get("transactionId") ?? "";
      sign = params.get("sign") ?? undefined;
    }

    // ── Sanitise ──────────────────────────────────────────────────────────────
    paymentRef = paymentRef?.trim() ?? "";
    status = status?.trim() ?? "";
    transactionId = transactionId?.trim() ?? "";

    console.info("[notify] payment_ref=%s status=%s", paymentRef, status);

    // ── HMAC signature verification ───────────────────────────────────────────
    if (sign) {
      const expected = crypto
        .createHmac("sha1", MONETBIL_SERVICE_SECRET)
        .update(paymentRef + status.toLowerCase())
        .digest("hex");

      if (expected.toLowerCase() !== sign.toLowerCase()) {
        console.error(
          "[notify] Invalid HMAC signature for ref=%s",
          paymentRef
        );
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } else {
      // No sign field — log a warning but continue processing
      console.warn(
        "[notify] No HMAC signature received for ref=%s — proceeding anyway",
        paymentRef
      );
    }

    // ── Look up payment ───────────────────────────────────────────────────────
    if (!paymentRef) {
      return NextResponse.json({ ok: true }); // nothing to do
    }

    const paymentResult = await query(
      `SELECT id, user_id, agent_id, plan_id, status AS payment_status
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

      // Upgrade the agent's plan
      await query(
        `UPDATE camille.agents
         SET plan = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [payment.plan_id, payment.agent_id]
      );

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
