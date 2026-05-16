import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref")?.trim();

    if (!ref) {
      return NextResponse.json(
        { error: "Le paramètre ref est requis" },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT id, status, plan_id, agent_id, amount, transaction_id, created_at
       FROM camille.payments
       WHERE id = $1 AND user_id = $2`,
      [ref, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Paiement introuvable" },
        { status: 404 }
      );
    }

    const row = result.rows[0] as {
      id: string;
      status: string;
      plan_id: string;
      agent_id: string;
      amount: number;
      transaction_id: string | null;
      created_at: string;
    };

    return NextResponse.json({
      status: row.status,
      plan_id: row.plan_id,
      agent_id: row.agent_id,
      amount: row.amount,
      transaction_id: row.transaction_id,
      created_at: row.created_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/payments/verify]", err);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 }
    );
  }
}
