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
    const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 10 : rawLimit), 50);

    const result = await query(
      `SELECT
         id,
         agent_id,
         plan_id,
         amount,
         currency,
         status,
         transaction_id,
         phone,
         created_at,
         updated_at
       FROM camille.payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [user.id, limit]
    );

    return NextResponse.json({ payments: result.rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/payments/history]", err);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 }
    );
  }
}
