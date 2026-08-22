// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/public/v1/customers/{phone}  → fiche client + dernières commandes
// POST /api/public/v1/customers/{phone}  → enregistre nom, e-mail, entreprise,
//                                          adresses
//
// Le client d'un marchand n'existait que comme un numéro WhatsApp avec une
// langue. Il ressaisissait donc son nom et son adresse à chaque commande, sur
// le site comme dans la conversation.
//
//   curl -X POST .../api/public/v1/customers/237699887766 \
//     -H "X-Camille-Key: cam_sk_xxxxx" -H "Content-Type: application/json" \
//     -d '{"name":"Kate Biya","company":"Enko","addresses":[{"label":"Bureau","address":"Bonapriso"}]}'
//
// Clé SECRÈTE obligatoire : ce sont des données personnelles, elles ne
// transitent pas par le navigateur d'un visiteur.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { authenticate, json, preflight } from "@/lib/publicApi";
import { statusLabel, statusStep } from "@/lib/orderStatus";

type RouteContext = { params: Promise<{ phone: string }> };

const digits = (v: unknown) => String(v ?? "").replace(/[^0-9]/g, "");

/** Adresses : on garde ce qu'on sait relire, et on plafonne. */
function cleanAddresses(input: unknown) {
  if (!Array.isArray(input)) return null;
  return input.slice(0, 10).map((a) => {
    const o = (a ?? {}) as Record<string, unknown>;
    return {
      label: String(o.label ?? "").slice(0, 40),
      address: String(o.address ?? "").slice(0, 200),
      details: String(o.details ?? "").slice(0, 120),
      lat: Number.isFinite(Number(o.lat)) ? Number(o.lat) : null,
      lng: Number.isFinite(Number(o.lng)) ? Number(o.lng) : null,
    };
  }).filter((a) => a.address);
}

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await authenticate(req, "secret");
  if ("error" in auth) return auth.error;

  const phone = digits((await params).phone);
  if (!phone) return json({ error: "Numéro invalide" }, 400, req);

  let contact: Record<string, unknown> | null = null;
  try {
    const r = await query(
      "SELECT * FROM camille.contacts WHERE agent_id = $1 AND phone = $2 LIMIT 1",
      [auth.key.agent_id, phone]
    );
    contact = r.rows[0] ?? null;
  } catch (e) {
    return json(
      { error: "Fiche client indisponible — applique migration_site_integration.sql", detail: (e as Error).message },
      503, req
    );
  }

  // L'historique vaut souvent plus que la fiche : c'est lui qui permet de
  // proposer « comme la dernière fois ».
  let orders: unknown[] = [];
  try {
    const r = await query(
      `SELECT ref, status, total, currency, created_at
         FROM camille.orders
        WHERE agent_id = $1 AND contact_phone = $2
        ORDER BY created_at DESC LIMIT 5`,
      [auth.key.agent_id, phone]
    );
    orders = r.rows.map((o: Record<string, unknown>) => ({
      ref: o.ref,
      status: o.status,
      status_label: statusLabel(String(o.status)),
      step: statusStep(String(o.status)),
      total: Number(o.total) || 0,
      currency: o.currency || "XAF",
      placed_at: o.created_at,
    }));
  } catch { /* la fiche reste utile sans l'historique */ }

  return json({
    customer: contact && {
      phone,
      name: contact.display_name ?? null,
      email: contact.email ?? null,
      company: contact.company ?? null,
      addresses: contact.addresses ?? [],
      orders_count: Number(contact.orders_count) || 0,
      last_order_at: contact.last_order_at ?? null,
      language: contact.language_pref ?? null,
    },
    orders,
  }, 200, req);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authenticate(req, "secret");
  if ("error" in auth) return auth.error;

  const phone = digits((await params).phone);
  if (!phone) return json({ error: "Numéro invalide" }, 400, req);

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = b.name === undefined ? null : String(b.name).slice(0, 60);
  const email = b.email === undefined ? null : String(b.email).slice(0, 120);
  const company = b.company === undefined ? null : String(b.company).slice(0, 80);
  const addresses = cleanAddresses(b.addresses);

  try {
    // COALESCE($n, colonne) : un champ absent du corps n'efface pas ce qui est
    // déjà connu. Le site n'envoie souvent qu'une partie de la fiche.
    const r = await query(
      `INSERT INTO camille.contacts (agent_id, phone, display_name, email, company, addresses)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '[]'::jsonb))
       ON CONFLICT (agent_id, phone) DO UPDATE
            SET display_name = COALESCE(EXCLUDED.display_name, camille.contacts.display_name),
                email        = COALESCE(EXCLUDED.email,        camille.contacts.email),
                company      = COALESCE(EXCLUDED.company,      camille.contacts.company),
                addresses    = CASE WHEN $6 IS NULL THEN camille.contacts.addresses ELSE EXCLUDED.addresses END,
                updated_at   = NOW()
         RETURNING display_name, email, company, addresses, orders_count, last_order_at`,
      [auth.key.agent_id, phone, name, email, company, addresses ? JSON.stringify(addresses) : null]
    );
    const c = r.rows[0] ?? {};
    return json({
      ok: true,
      customer: {
        phone,
        name: c.display_name ?? null,
        email: c.email ?? null,
        company: c.company ?? null,
        addresses: c.addresses ?? [],
        orders_count: Number(c.orders_count) || 0,
        last_order_at: c.last_order_at ?? null,
      },
    }, 200, req);
  } catch (e) {
    return json(
      { error: "Enregistrement impossible — applique migration_site_integration.sql", detail: (e as Error).message },
      503, req
    );
  }
}
