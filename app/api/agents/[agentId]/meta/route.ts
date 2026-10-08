// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/agents/[agentId]/meta  → état de la connexion WhatsApp (Meta)
// POST   /api/agents/[agentId]/meta  → fin de l'Embedded Signup { code, waba_id?, phone_number_id? }
// PUT    /api/agents/[agentId]/meta  → relit le catalogue relié au compte
// DELETE /api/agents/[agentId]/meta  → déconnecte le WhatsApp du commerçant
//
// Réservé au propriétaire de l'agent : c'est la parole de son commerce.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { chiffrer, coffrePret, dechiffrer } from "@/lib/whatsapp/coffre";
import { oublierIdentifiants } from "@/lib/whatsapp/identifiants";
import { appId, catalogueRelie, connecter, desabonner } from "@/lib/whatsapp/inscription";

type RouteContext = { params: Promise<{ agentId: string }> };

async function proprietaire(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const r = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  return r.rows.length ? user : null;
}

async function etat(agentId: string) {
  const r = await query(
    `SELECT COALESCE(to_jsonb(a)->>'transport', 'core')  AS transport,
            to_jsonb(a)->>'meta_phone_number_id'          AS phone_id,
            to_jsonb(a)->>'meta_waba_id'                  AS waba_id,
            to_jsonb(a)->>'meta_catalog_id'               AS catalog_id,
            to_jsonb(a)->>'meta_display_phone'            AS display_phone,
            to_jsonb(a)->>'meta_verified_name'            AS verified_name,
            to_jsonb(a)->>'meta_connected_at'             AS connected_at,
            (to_jsonb(a)->>'meta_token_enc') IS NOT NULL  AS a_son_jeton
       FROM camille.agents a WHERE a.id = $1`,
    [agentId]
  );
  return r.rows[0] || null;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  if (!(await proprietaire(req, agentId))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const e = await etat(agentId).catch(() => null);
  return NextResponse.json({
    connecte: Boolean(e?.a_son_jeton && e?.phone_id),
    transport: e?.transport || "core",
    numero: e?.display_phone || null,
    nom_verifie: e?.verified_name || null,
    catalogue: e?.catalog_id || null,
    connecte_le: e?.connected_at || null,
    // Ce qui manque côté configuration, pour l'afficher au lieu d'échouer.
    pret: {
      app_id: Boolean(appId()),
      config_id: Boolean(process.env.NEXT_PUBLIC_META_CONFIG_ID),
      secret: Boolean(process.env.WHATSAPP_APP_SECRET),
      coffre: coffrePret(),
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  if (!(await proprietaire(req, agentId))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!coffrePret()) {
    return NextResponse.json(
      { error: "META_TOKEN_KEY absente : Camille refuse de garder un jeton qu'elle ne sait pas chiffrer." },
      { status: 503 }
    );
  }
  const b = (await req.json().catch(() => ({}))) as { code?: string; waba_id?: string; phone_number_id?: string };
  if (!b.code) return NextResponse.json({ error: "Code de connexion manquant" }, { status: 400 });

  let c;
  try {
    c = await connecter(String(b.code), { wabaId: b.waba_id, phoneId: b.phone_number_id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  // Un numéro n'appartient qu'à un agent : sinon les messages de ses clients
  // arriveraient chez un autre commerce.
  const deja = await query(
    `SELECT id FROM camille.agents WHERE to_jsonb(agents)->>'meta_phone_number_id' = $1 AND id <> $2 LIMIT 1`,
    [c.phoneId, agentId]
  ).catch(() => ({ rows: [] as unknown[] }));
  if (deja.rows.length) {
    return NextResponse.json({ error: "Ce numéro WhatsApp est déjà relié à un autre agent." }, { status: 409 });
  }

  try {
    await query(
      `UPDATE camille.agents
          SET meta_phone_number_id = $2, meta_waba_id = $3, meta_catalog_id = $4,
              meta_token_enc = $5, meta_pin_enc = $6,
              meta_display_phone = $7, meta_verified_name = $8,
              meta_connected_at = NOW(), transport = 'meta', updated_at = NOW()
        WHERE id = $1`,
      [agentId, c.phoneId, c.wabaId, c.catalogId, chiffrer(c.token), chiffrer(c.pin), c.displayPhone, c.verifiedName]
    );
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json(
      { error: code === "42703" ? "Migration manquante : applique migration_meta_signup.sql." : (e as Error).message },
      { status: 500 }
    );
  }
  oublierIdentifiants(agentId);

  return NextResponse.json({
    ok: true,
    numero: c.displayPhone,
    nom_verifie: c.verifiedName,
    catalogue: c.catalogId,
    avertissements: c.avertissements,
  });
}

/** Le commerçant vient de relier un catalogue à son compte : on le relit. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  if (!(await proprietaire(req, agentId))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const r = await query(
    `SELECT to_jsonb(a)->>'meta_waba_id' AS waba_id, to_jsonb(a)->>'meta_token_enc' AS token_enc
       FROM camille.agents a WHERE a.id = $1`,
    [agentId]
  );
  const token = dechiffrer(r.rows[0]?.token_enc);
  if (!token || !r.rows[0]?.waba_id) return NextResponse.json({ error: "WhatsApp non connecté" }, { status: 400 });
  const catalogId = await catalogueRelie(r.rows[0].waba_id, token);
  await query("UPDATE camille.agents SET meta_catalog_id = $2 WHERE id = $1", [agentId, catalogId]);
  oublierIdentifiants(agentId);
  return NextResponse.json({ ok: true, catalogue: catalogId });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  if (!(await proprietaire(req, agentId))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const r = await query(
    `SELECT to_jsonb(a)->>'meta_waba_id' AS waba_id, to_jsonb(a)->>'meta_token_enc' AS token_enc
       FROM camille.agents a WHERE a.id = $1`,
    [agentId]
  );
  // Seul un WhatsApp connecté par le commerçant se déconnecte d'ici : un agent
  // qui parle avec les identifiants de l'application ne doit pas être éteint
  // par erreur.
  if (!r.rows[0]?.token_enc) return NextResponse.json({ error: "Aucun WhatsApp connecté par ce commerçant" }, { status: 400 });
  const token = dechiffrer(r.rows[0].token_enc);
  if (token && r.rows[0].waba_id) await desabonner(r.rows[0].waba_id, token).catch(() => {});
  await query(
    `UPDATE camille.agents
        SET meta_phone_number_id = NULL, meta_waba_id = NULL, meta_catalog_id = NULL,
            meta_token_enc = NULL, meta_pin_enc = NULL, meta_display_phone = NULL,
            meta_verified_name = NULL, meta_connected_at = NULL, transport = 'core', updated_at = NOW()
      WHERE id = $1`,
    [agentId]
  );
  oublierIdentifiants(agentId);
  return NextResponse.json({ ok: true });
}
