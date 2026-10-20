import { NextRequest, NextResponse }   from "next/server";
import crypto                          from "crypto";
import { query }                       from "@/lib/db";
import { getUserFromRequest }          from "@/lib/auth-server";
import { isPurchasableDB, getPlanPriceXafDB, prixOptionSitePour } from "@/lib/plans-db";
import { buyfacturationActive, lancerCollecte, msisdn, operateurDe, type Operateur } from "@/lib/paiement";

const MONETBIL_SERVICE_KEY = process.env.MONETBIL_SERVICE_KEY!;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://camille.vps.buyticle.com";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!user.email_verified) {
    return NextResponse.json(
      { error: "Confirmez d'abord votre adresse e-mail avec le code reçu.", code: "email_non_verifie" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { agentId, phone, country, operateur } = body as {
      agentId?: string;
      planId?: string;
      phone?: string;
      country?: string;
      operateur?: string;
    };
    // L'option Site se paie comme un forfait, au mois, par agent.
    const kind = body.kind === "site" ? "site" : "forfait";
    const planId = kind === "site" ? "site" : (body.planId as string | undefined);

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!agentId || !planId) {
      return NextResponse.json(
        { error: "agentId et planId sont requis" },
        { status: 400 }
      );
    }

    // Vérifie que le plan est achetable (is_purchasable = true en DB)
    const purchasable = kind === "site" || (await isPurchasableDB(planId));
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
      `SELECT id, owner_email, plan FROM camille.agents
       WHERE id = $1 AND user_id = $2 AND status != 'archived'`,
      [agentId, user.id]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Agent introuvable ou non autorisé" },
        { status: 404 }
      );
    }

    const agent = agentResult.rows[0] as { id: string; owner_email: string; plan: string | null };
    // Prix depuis la DB (jamais depuis le client)
    // L'option Site : le supplément du forfait de l'agent, sinon le prix par défaut.
    const amount = kind === "site" ? await prixOptionSitePour(agent.plan) : await getPlanPriceXafDB(planId);

    // ── buyfacturation : la demande arrive sur le téléphone ───────────────────
    // Pas de page de paiement : le commerçant valide avec son code Mobile Money
    // (*126# MTN, #150*50# Orange), et la page de facturation attend la
    // confirmation. La référence est un UUID : buyfacturation l'exige.
    if (buyfacturationActive()) {
      const numero = msisdn(phone || "");
      if (!numero) {
        return NextResponse.json({ error: "Entrez le numéro Mobile Money qui paiera (MTN ou Orange, 6XXXXXXXX)." }, { status: 400 });
      }
      const op: Operateur | null = operateur === "MTN" || operateur === "ORANGE" ? operateur : operateurDe(numero);
      const ref = crypto.randomUUID();
      await query(
        `INSERT INTO camille.payments
           (id, user_id, agent_id, plan_id, amount, currency, status, phone, kind, provider, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'XAF', 'pending', $6, $7, 'buyfacturation', NOW(), NOW())`,
        [ref, user.id, agentId, planId, amount, numero, kind]
      );
      const lance = await lancerCollecte({
        reference: ref,
        montant: amount,
        numero,
        operateur: op,
        description: kind === "site" ? "Camille — option Site (1 mois)" : `Camille — forfait ${planId} (1 mois)`,
        callbackUrl: `${APP_URL}/api/payments/buyfacturation`,
      });
      if (!lance.ok) {
        await query(`UPDATE camille.payments SET status = 'failed', updated_at = NOW() WHERE id = $1`, [ref]);
        return NextResponse.json({ error: `Paiement non lancé : ${lance.error}` }, { status: 502 });
      }
      return NextResponse.json(
        {
          payment_ref: ref,
          amount,
          instruction:
            op === "ORANGE"
              ? "Composez #150*50# et validez la demande avec votre code Orange Money."
              : "Validez la demande reçue sur votre téléphone avec votre code Mobile Money (*126# pour MTN).",
        },
        { status: 201 }
      );
    }

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
