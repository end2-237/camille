// ─────────────────────────────────────────────────────────────────────────────
// Réclamations — ce que le client signale et que le commerçant doit traiter.
//
//   POST   enregistre une réclamation (appelé par le workflow n8n)
//   GET    liste les réclamations du commerçant connecté
//   PATCH  marque une réclamation comme traitée
//
// Elles sont stockées dans camille.owner_tasks avec type = 'complaint' plutôt
// que dans une table dédiée : la structure y suffit (agent, téléphone, contenu
// libre, statut), et cela évite d'imposer une migration de plus pour une
// fonction qu'on veut disponible tout de suite.
//
// L'agent promettait déjà au client de « transmettre à l'équipe ». Sans ce
// point d'arrivée, c'était une promesse que le système ne tenait pas.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";

const CORE_URL = (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");
const CORE_KEY = process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

/**
 * Prévient le client sur WhatsApp.
 *
 * Le commerçant prenait sa réclamation en charge, et le client n'en savait
 * rien : il attendait sans savoir si quelqu'un l'avait lu. Ne lève jamais —
 * un message qui ne part pas ne doit pas empêcher de traiter le dossier.
 */
async function tellClient(agentId: string, phone: string, text: string) {
  if (!phone) return;
  try {
    const s = await query(
      "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1 LIMIT 1",
      [agentId]
    );
    await fetch(`${CORE_URL}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": CORE_KEY },
      body: JSON.stringify({ chatId: phone, session: s.rows[0]?.session_name || "default", text }),
    });
  } catch { /* le client sera prévenu par le commerçant lui-même */ }
}

/** Libellés lisibles : le workflow envoie une intention, pas une phrase. */
const KINDS: Record<string, string> = {
  complaint: "Réclamation",
  after_sales: "Suivi de commande",
  talk_to_human: "Demande à parler à quelqu'un",
};

// ── Création, depuis le workflow ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as Record<string, unknown>));

  const agentId = String(b.agentId || b.agent_id || "").trim();
  const phone = String(b.phone || "").replace(/[^0-9]/g, "");
  const message = String(b.message || "").slice(0, 1000).trim();
  const kind = KINDS[String(b.kind || "")] ? String(b.kind) : "complaint";

  if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "message requis" }, { status: 400 });

  // L'agent doit exister : on en tire aussi le propriétaire à prévenir.
  let agent: { user_id: string; business_name: string } | undefined;
  try {
    const r = await query(
      "SELECT user_id, business_name FROM camille.agents WHERE id = $1",
      [agentId]
    );
    agent = r.rows[0];
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  // Une réclamation déjà ouverte pour ce client n'est pas dupliquée : un client
  // qui insiste trois fois ne doit pas produire trois tâches identiques, sinon
  // le commerçant traite du bruit au lieu de traiter des clients.
  try {
    const dup = await query(
      `SELECT id FROM camille.owner_tasks
        WHERE agent_id = $1 AND phone = $2 AND type = 'complaint'
          AND status = 'active' AND created_at > NOW() - INTERVAL '6 hours'
        LIMIT 1`,
      [agentId, phone]
    );
    if (dup.rows.length) {
      return NextResponse.json({ ok: true, id: dup.rows[0].id, deduplicated: true });
    }
  } catch { /* table absente : on tentera l'insertion, elle dira pourquoi */ }

  let id: string;
  try {
    const r = await query(
      `INSERT INTO camille.owner_tasks (agent_id, phone, type, title, content)
       VALUES ($1, $2, 'complaint', $3, $4::jsonb)
       RETURNING id`,
      [
        agentId,
        phone,
        `${KINDS[kind]} — ${phone || "client inconnu"}`,
        JSON.stringify({ kind, message, contact: phone }),
      ]
    );
    id = r.rows[0].id;
  } catch (e) {
    return NextResponse.json(
      { error: "Enregistrement impossible", detail: (e as Error).message },
      { status: 500 }
    );
  }

  // Une réclamation qui dort est pire qu'une réclamation absente : on prévient.
  notifyUser(agent.user_id, "alerte", {
    title: `${KINDS[kind]} — ${agent.business_name || "ton agent"}`,
    body: message.slice(0, 120),
    data: { type: "complaint", id, phone },
  }).catch(() => {});

  return NextResponse.json({ ok: true, id }, { status: 201 });
}

// ── Lecture, côté commerçant ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status"); // active | done | (tous)
  const params: unknown[] = [user.id];
  let where = "WHERE a.user_id = $1 AND t.type = 'complaint'";
  if (status) {
    params.push(status);
    where += ` AND t.status = $${params.length}`;
  }

  try {
    const r = await query(
      // LEFT JOIN : un contact peut ne pas exister (client jamais enregistré),
      // et la réclamation doit rester visible malgré tout.
      `SELECT t.id, t.phone, t.title, t.content, t.status, t.created_at,
              a.id AS agent_id, a.business_name,
              COALESCE(c.human_takeover, false) AS human_takeover
         FROM camille.owner_tasks t
         JOIN camille.agents a ON a.id = t.agent_id
         LEFT JOIN camille.contacts c
                ON c.agent_id = t.agent_id AND c.phone = t.phone
         ${where}
        ORDER BY t.created_at DESC
        LIMIT 200`,
      params
    );
    return NextResponse.json({ complaints: r.rows });
  } catch (e) {
    // Table absente : une liste vide vaut mieux qu'un écran en erreur.
    return NextResponse.json({ complaints: [], error: (e as Error).message });
  }
}

// ── Clôture ─────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  // Deux gestes distincts sur la même réclamation :
  //   { takeover: true|false }  faire taire l'agent, ou lui rendre la parole
  //   { status: ... }           classer la réclamation
  // Les séparer permet de garder la main sur un client sans clore son dossier,
  // et de clore un dossier sans laisser l'agent muet pour toujours.
  const onlyTakeover = typeof b.takeover === "boolean" && b.status === undefined;
  const status = b.status === "active" ? "active" : "done";

  try {
    // Basculement seul : on ne touche pas au statut de la réclamation.
    if (onlyTakeover) {
      const own = await query(
        `SELECT t.agent_id, t.phone
           FROM camille.owner_tasks t
           JOIN camille.agents a ON a.id = t.agent_id
          WHERE t.id = $1 AND a.user_id = $2`,
        [id, user.id]
      );
      const t = own.rows[0];
      if (!t) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
      if (!t.phone) return NextResponse.json({ error: "Ce client n'a pas de numéro." }, { status: 400 });

      await query(
        `INSERT INTO camille.contacts (agent_id, phone, human_takeover, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (agent_id, phone)
         DO UPDATE SET human_takeover = $3, updated_at = NOW()`,
        [t.agent_id, t.phone, b.takeover === true]
      );
      // Le client doit savoir qu'un humain s'occupe de lui — c'est toute la
      // différence entre attendre et être ignoré.
      if (b.takeover === true) {
        const who = await query(
          "SELECT business_name FROM camille.agents WHERE id = $1", [t.agent_id]
        ).catch(() => ({ rows: [] }));
        const nom = who.rows[0]?.business_name || "L'équipe";
        await tellClient(
          String(t.agent_id),
          String(t.phone),
          `${nom} a bien pris ton message en charge 🙌 Un conseiller te répond ici même, dans cette conversation.`
        );
      }
      return NextResponse.json({ ok: true, human_takeover: b.takeover === true });
    }

    const r = await query(
      `UPDATE camille.owner_tasks t
          SET status = $1
         FROM camille.agents a
        WHERE t.id = $2 AND t.agent_id = a.id AND a.user_id = $3
      RETURNING t.id, t.status, t.agent_id, t.phone`,
      [status, id, user.id]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });

    const row = r.rows[0];

    // Une réclamation ouverte a fait taire l'agent pour ce client, le temps
    // qu'un humain règle le problème. La clôturer lui rend la parole — sans
    // quoi ce client ne serait plus jamais servi automatiquement.
    if (status === "done" && row.phone) {
      await query(
        `UPDATE camille.contacts
            SET human_takeover = false, updated_at = NOW()
          WHERE agent_id = $1 AND phone = $2`,
        [row.agent_id, row.phone]
      ).catch(() => {});

      // Clôturer sans rien dire laisse le client persuadé qu'on l'a oublié.
      const who = await query(
        "SELECT business_name FROM camille.agents WHERE id = $1", [row.agent_id]
      ).catch(() => ({ rows: [] }));
      const nom = who.rows[0]?.business_name || "L'équipe";
      await tellClient(
        String(row.agent_id),
        String(row.phone),
        `${nom} a traité ta demande ✅ Si quelque chose reste en suspens, écris-nous ici, on reprend tout de suite.`
      );
    }

    return NextResponse.json({ ok: true, complaint: { id: row.id, status: row.status } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
