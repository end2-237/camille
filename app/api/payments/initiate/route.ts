import { NextRequest, NextResponse }   from "next/server";
import crypto                          from "crypto";
import { query }                       from "@/lib/db";
import { getUserFromRequest }          from "@/lib/auth-server";
import { isPurchasableDB, getPlanPriceXafDB } from "@/lib/plans-db";

const MONETBIL_SERVICE_KEY = process.env.MONETBIL_SERVICE_KEY!;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://camille.vps.buyticle.com";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { agentId, planId, phone, country } = body as {
      agentId?: string;
      planId?: string;
      phone?: string;
      country?: string;
    };

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!agentId || !planId) {
      return NextResponse.json(
        { error: "agentId et planId sont requis" },
        { status: 400 }
      );
    }

    // Vérifie que le plan est achetable (is_purchasable = true en DB)
    const purchasable = await isPurchasableDB(planId);
    if (!purchasable) {
      return NextResponse.json(
        {
          error:
            planId === "enterprise"
              ? "Contactez-nous pour le plan Enterprise : hello@buyticle.com"
              : "Plan invalide ou non disponible à l'achat.",
        },
        { status: 400 }
      );
    }

    // ── Verify agent ownership ────────────────────────────────────────────────
    const agentResult = await query(
      `SELECT id, owner_email FROM camille.agents
       WHERE id = $1 AND user_id = $2 AND status != 'archived'`,
      [agentId, user.id]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Agent introuvable ou non autorisé" },
        { status: 404 }
      );
    }

    const agent = agentResult.rows[0] as { id: string; owner_email: string };
    // Prix depuis la DB (jamais depuis le client)
    const amount = await getPlanPriceXafDB(planId);

    // ── Generate payment reference ────────────────────────────────────────────
    const paymentRef = `CAM-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    // ── Insert pending payment record ─────────────────────────────────────────
    await query(
      `INSERT INTO camille.payments
         (id, user_id, agent_id, plan_id, amount, currency, status, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'XAF', 'pending', $6, NOW(), NOW())`,
      [paymentRef, user.id, agentId, planId, amount, phone ?? null]
    );

    // ── Call Monetbil widget API ──────────────────────────────────────────────
    const notifyUrl = `${APP_URL}/api/payments/notify`;
    const returnUrl = `${APP_URL}/dashboard/billing?payment=return&ref=${paymentRef}`;
    const cancelUrl = `${APP_URL}/dashboard/billing?payment=cancel&ref=${paymentRef}`;

    const params = new URLSearchParams({
      amount: String(amount),
      currency: "XAF",
      payment_ref: paymentRef,
      notify_url: notifyUrl,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      item_ref: planId,
      locale: "fr",
      user_email: agent.owner_email ?? user.email,
      country_code: country ?? "CM",
    });

    if (phone) {
      params.set("phone", phone);
    }

    const monetbilRes = await fetch(
      `https://api.monetbil.com/widget/v2.1/${MONETBIL_SERVICE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );

    let paymentUrl: string;

    if (monetbilRes.ok) {
      let monetbilData: Record<string, unknown> = {};
      const contentType = monetbilRes.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        monetbilData = (await monetbilRes.json()) as Record<string, unknown>;
      } else {
        // Some Monetbil responses are plain text or HTML redirect URLs
        const text = await monetbilRes.text();
        if (text.startsWith("http")) {
          paymentUrl = text.trim();
        }
      }

      if (!paymentUrl!) {
        paymentUrl =
          (monetbilData.payment_url as string) ??
          (monetbilData.url as string) ??
          `https://www.monetbil.com/pay/${MONETBIL_SERVICE_KEY}?payment_ref=${paymentRef}`;
      }
    } else {
      // Monetbil API error — fall back to direct pay URL so the user can still pay
      console.error(
        "[POST /api/payments/initiate] Monetbil API error",
        monetbilRes.status,
        await monetbilRes.text()
      );
      paymentUrl = `https://www.monetbil.com/pay/${MONETBIL_SERVICE_KEY}?payment_ref=${paymentRef}`;
    }

    return NextResponse.json(
      { payment_url: paymentUrl, payment_ref: paymentRef, amount },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/payments/initiate]", err);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 }
    );
  }
}
