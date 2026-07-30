// ─────────────────────────────────────────────────────────────────────────────
// POST /api/account/delete — suppression définitive du compte.
//
// Google Play l'exige de toute application permettant de créer un compte :
// l'utilisateur doit pouvoir tout effacer depuis l'app, sans passer par le
// support. On efface réellement — pas de drapeau « supprimé » sur des données
// qui resteraient en base.
//
// Le mot de passe est redemandé : un téléphone déverrouillé laissé sur une
// table ne doit pas suffire à détruire le travail d'un commerçant.
//
// Ce qui disparaît : agents, catalogues, commandes, conversations, clés d'API,
// jetons de notification, sessions, puis le compte. Ce qui subsiste : les
// messages déjà envoyés sur WhatsApp, qui appartiennent aux conversations des
// clients et sont hors de notre portée — c'est dit dans la réponse.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, verifyPassword } from "@/lib/auth-server";
import { query } from "@/lib/db";

/**
 * Tables dépendantes, dans l'ordre où il faut les vider : les feuilles avant
 * les branches. Certaines n'existent que si la migration correspondante est
 * passée — une table absente ne doit pas interrompre la suppression, sinon un
 * compte devient indestructible sur une base en retard.
 */
const BY_AGENT = [
  "camille.conversation_traces",
  "camille.api_keys",
  "camille.orders",
  "camille.products",
  "camille.contacts",
  "camille.owner_tasks",
  "camille.messages",
  "camille.conversations",
  "camille.whatsapp_sessions",
];

const BY_USER = ["camille.push_tokens", "camille.notifications", "camille.sessions"];

async function wipe(table: string, column: string, ids: string[]) {
  if (!ids.length) return { table, deleted: 0, skipped: true };
  try {
    const r = await query(
      `DELETE FROM ${table} WHERE ${column} = ANY($1::uuid[])`,
      [ids]
    );
    return { table, deleted: r.rowCount ?? 0 };
  } catch (e) {
    // 42P01 = table absente : la migration n'est pas passée ici, rien à effacer.
    const code = (e as { code?: string }).code;
    if (code === "42P01" || code === "42703") return { table, deleted: 0, skipped: true };
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const password = String(body.password || "");
  const confirm = String(body.confirm || "");

  if (!password) {
    return NextResponse.json(
      { error: "Ton mot de passe est nécessaire pour confirmer la suppression." },
      { status: 400 }
    );
  }

  // Double barrière : le mot de passe prouve l'identité, le mot tapé prouve
  // l'intention. Une suppression de compte ne doit pas tenir à un seul geste.
  if (confirm.trim().toUpperCase() !== "SUPPRIMER") {
    return NextResponse.json(
      { error: "Écris SUPPRIMER pour confirmer." },
      { status: 400 }
    );
  }

  try {
    const u = await query(
      "SELECT id, password_hash FROM camille.users WHERE id = $1",
      [user.id]
    );
    const row = u.rows[0];
    if (!row) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    if (!verifyPassword(password, row.password_hash)) {
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });
    }

    const ag = await query("SELECT id FROM camille.agents WHERE user_id = $1", [user.id]);
    const agentIds: string[] = ag.rows.map((r: { id: string }) => r.id);

    const report: Record<string, number> = {};
    for (const t of BY_AGENT) {
      const r = await wipe(t, "agent_id", agentIds);
      if (!r.skipped) report[t] = r.deleted;
    }
    for (const t of BY_USER) {
      const r = await wipe(t, "user_id", [user.id]);
      if (!r.skipped) report[t] = r.deleted;
    }

    if (agentIds.length) {
      await query("DELETE FROM camille.agents WHERE user_id = $1", [user.id]);
      report["camille.agents"] = agentIds.length;
    }
    await query("DELETE FROM camille.users WHERE id = $1", [user.id]);
    report["camille.users"] = 1;

    // Les sessions sont déjà effacées ci-dessus : le jeton porté par l'appelant
    // ne vaut plus rien dès cette réponse, sur tous ses appareils.
    return NextResponse.json({
      ok: true,
      deleted: report,
      note:
        "Compte supprimé. Les messages déjà envoyés sur WhatsApp restent dans " +
        "les conversations de tes clients : ils ne nous appartiennent plus.",
    });
  } catch (e) {
    console.error("[POST /api/account/delete]", e);
    return NextResponse.json(
      { error: "Suppression impossible pour le moment.", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
