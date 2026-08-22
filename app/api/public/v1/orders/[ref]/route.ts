// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/v1/orders/{ref}
//
// Le site du marchand affiche l'avancement d'une commande. Jusqu'ici il ne
// pouvait qu'en créer : le client passait commande, puis n'avait plus rien à
// regarder qu'une page figée.
//
//   curl "https://camille.vps.buyticle.com/api/public/v1/orders/AB3K9P?phone=237699887766" \
//        -H "X-Camille-Key: cam_pk_xxxxx"
//
// Une référence de commande est courte (6 caractères) : elle se devine. Avec
// une clé PUBLIQUE — donc visible dans le navigateur — on exige donc le
// téléphone du client, qui doit correspondre. Une clé SECRÈTE (serveur) s'en
// dispense : elle n'appartient qu'au marchand.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { authenticate, json, preflight } from "@/lib/publicApi";
import { statusLabel, statusStep, ORDER_STEPS } from "@/lib/orderStatus";

type RouteContext = { params: Promise<{ ref: string }> };

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await authenticate(req, "public");
  if ("error" in auth) return auth.error;

  const { ref } = await params;
  const reference = String(ref || "").trim().toUpperCase();
  if (!reference) return json({ error: "Référence manquante" }, 400, req);

  const askedPhone = (req.nextUrl.searchParams.get("phone") || "").replace(/[^0-9]/g, "");
  if (auth.key.kind !== "secret" && !askedPhone) {
    return json(
      { error: "Ajoute ?phone=… (le numéro du client) ou utilise une clé secrète." },
      400, req
    );
  }

  // SELECT * : les colonnes de suivi (processing_at, scheduled_at…) arrivent au
  // fil des migrations. Les nommer ici, c'est casser la route sur une base qui
  // n'a pas encore reçu la dernière.
  let row: Record<string, unknown> | undefined;
  try {
    const r = await query(
      "SELECT * FROM camille.orders WHERE UPPER(ref) = $1 AND agent_id = $2 LIMIT 1",
      [reference, auth.key.agent_id]
    );
    row = r.rows[0];
  } catch (e) {
    return json({ error: "Suivi indisponible", detail: (e as Error).message }, 500, req);
  }

  // Référence inconnue et téléphone qui ne correspond pas donnent la MÊME
  // réponse : sinon la route devient un moyen de tester des références.
  const phoneOk =
    auth.key.kind === "secret" ||
    String(row?.contact_phone ?? "").replace(/[^0-9]/g, "").endsWith(askedPhone.slice(-9));
  if (!row || !phoneOk) return json({ error: "Commande introuvable" }, 404, req);

  const items = Array.isArray(row.items)
    ? row.items
    : (() => { try { return JSON.parse(String(row.items || "[]")); } catch { return []; } })();

  const status = String(row.status || "nouvelle");
  const total = Number(row.total) || 0;
  const deliveryFee = Number(row.delivery_fee) || 0;

  return json({
    order: {
      ref: row.ref,
      status,
      status_label: statusLabel(status),
      step: statusStep(status),
      steps: ORDER_STEPS.map((s) => ({ status: s, label: statusLabel(s) })),
      items,
      subtotal: Math.max(0, total - deliveryFee),
      delivery_fee: deliveryFee,
      total,
      currency: row.currency || "XAF",
      customer_name: row.customer_name ?? null,
      address: row.place_label || row.address || null,
      note: row.note ?? null,
      scheduled_at: row.scheduled_at ?? null,
      placed_at: row.created_at ?? null,
      processing_at: row.processing_at ?? null,
      dispatched_at: row.dispatched_at ?? null,
      delivered_at: row.delivered_at ?? null,
      // Le bon de commande : le client le réclame, autant le lui donner.
      document_url: row.doc_url ?? null,
    },
  }, 200, req);
}
