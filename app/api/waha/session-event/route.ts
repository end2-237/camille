// ─────────────────────────────────────────────────────────────────────────────
// POST /api/waha/session-event
// Appelée par camille-core quand l'état d'une session WhatsApp change durablement.
// Route serveur à serveur : authentifiée par la clé partagée, pas par un compte.
//
// Un agent débranché ne dit rien de lui-même : le vendeur découvre la panne
// quand un client se plaint. C'est ce silence qu'on corrige ici.
//
// Corps attendu : { session, status, reason? }
//   status : "CONNECTED" | "DISCONNECTED" | "AUTH_FAILURE"
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";

const CORE_KEY = () => process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

// Etats pour lesquels l'agent ne repond plus et ne se retablira pas seul.
// STOPPED en est volontairement absent : c'est une coupure demandee par le
// vendeur lui-meme, l'alerter reviendrait a lui reprocher son propre geste.
const DOWN = new Set(["DISCONNECTED", "AUTH_FAILURE"]);

// Le reste de l'application ecrit « WORKING » pour une session en ligne
// (/api/waha/status mappe CONNECTED -> WORKING). On s'aligne sur cette
// convention plutot que d'introduire une seconde ecriture pour le meme etat :
// deux vocabulaires pour un seul fait finissent toujours par diverger.
function storedStatus(coreStatus: string): string {
  return coreStatus === "CONNECTED" ? "WORKING" : coreStatus;
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key") ?? "";
  if (key !== CORE_KEY()) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 401 });
  }

  let body: { session?: string; status?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const session = String(body.session ?? "").trim();
  const status = String(body.status ?? "").trim().toUpperCase();
  const reason = String(body.reason ?? "").trim();

  if (!session || !status) {
    return NextResponse.json({ error: "Champs requis : session, status" }, { status: 400 });
  }

  try {
    // L'état déjà enregistré sert de mémoire : sans lui, une reconnexion qui
    // boucle enverrait une notification à chaque tentative.
    const r = await query(
      `SELECT ws.status AS previous,
              ws.agent_id,
              a.user_id,
              COALESCE(NULLIF(a.name, ''), 'Ton agent') AS agent_name
         FROM camille.whatsapp_sessions ws
         JOIN camille.agents a ON a.id = ws.agent_id
        WHERE ws.session_name = $1`,
      [session]
    );
    if (!r.rows.length) {
      return NextResponse.json({ ignored: "session inconnue" });
    }

    const { previous, agent_id, user_id, agent_name } = r.rows[0] as {
      previous: string | null;
      agent_id: string;
      user_id: string;
      agent_name: string;
    };

    const prev = String(previous ?? "").toUpperCase();
    const wasDown = DOWN.has(prev);
    const isDown = DOWN.has(status);

    await query(
      `UPDATE camille.whatsapp_sessions
          SET status = $2, updated_at = NOW()
        WHERE session_name = $1`,
      [session, storedStatus(status)]
    );

    // Une session arrêtée volontairement ne redevient pas une panne : le vendeur
    // l'a coupée lui-même, il n'a pas besoin qu'on l'en avertisse.
    if (prev === "STOPPED" && isDown) {
      return NextResponse.json({ ok: true, notified: false, reason: "coupure volontaire" });
    }

    // Seules les bascules comptent. Rester connecté n'est pas une nouvelle, et
    // rester déconnecté non plus — on l'a déjà dit une fois.
    if (wasDown === isDown) {
      return NextResponse.json({ ok: true, notified: false, reason: "état inchangé" });
    }

    if (isDown) {
      await notifyUser(user_id, "alerte", {
        title: `${agent_name} est déconnecté`,
        body:
          status === "AUTH_FAILURE"
            ? "La liaison WhatsApp a été rompue. Touche cette alerte pour rescanner le QR code."
            : "Il ne répond plus à tes clients. Touche cette alerte pour le reconnecter.",
        channel: "alertes",
        // Aiguillage de l'app : ouvre directement l'écran de connexion WhatsApp
        // de cet agent, sans le faire chercher dans les menus.
        data: { type: "whatsapp_disconnected", agentId: agent_id, session, reason },
      });
    } else {
      await notifyUser(user_id, "systeme", {
        title: `${agent_name} est de nouveau en ligne`,
        body: "La connexion WhatsApp est rétablie, il répond de nouveau à tes clients.",
        channel: "alertes",
        data: { type: "whatsapp_connected", agentId: agent_id, session },
      });
    }

    return NextResponse.json({ ok: true, notified: true, status });
  } catch (err) {
    console.error("[POST /api/waha/session-event]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
