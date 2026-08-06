// ─────────────────────────────────────────────────────────────────────────────
// POST /api/waha/phone — connexion WhatsApp par numéro (code de couplage).
//
// Cette route parlait encore à l'ancien service WAHA : elle appelait
// https://waha.vps.buyticle.com/api/sessions/…/auth/request-code avec la clé
// WAHA_API_KEY. Tout le reste de l'application est passé à camille-core il y a
// longtemps ; cette route est restée seule derrière, pointée sur un hôte qui ne
// répond plus, avec un chemin que camille-core n'implémente pas et un champ de
// corps qui n'est pas le sien (`phoneNumber` au lieu de `phone`).
//
// Le symptôme était trompeur : Node échoue avec « fetch failed », la route
// renvoyait ce texte tel quel, et l'application affichait « failed to fetch » —
// ce qui ressemble à s'y méprendre à une panne de réseau côté client.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { wahaPairingCode } from "@/lib/waha";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { agentId, phoneNumber } = await req.json();
    if (!agentId || !phoneNumber) {
      return NextResponse.json({ error: "agentId et phoneNumber requis" }, { status: 400 });
    }

    const sessionRes = await query(
      "SELECT session_name FROM camille.whatsapp_sessions WHERE agent_id = $1 AND user_id = $2",
      [agentId, user.id]
    );
    if (sessionRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune session pour cet agent. Appuie d'abord sur « Connecter »." },
        { status: 404 }
      );
    }

    const { session_name } = sessionRes.rows[0];

    // Camille Core normalise déjà le numéro, mais un + ou des espaces collés
    // au début feraient échouer sa validation de longueur avant d'y arriver.
    const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, "");
    if (cleanPhone.length < 7) {
      return NextResponse.json(
        { error: "Numéro incomplet. Indique-le avec l'indicatif du pays, par exemple 237699000000." },
        { status: 400 }
      );
    }

    const { code, message } = await wahaPairingCode(session_name, cleanPhone);

    // Pas encore de code : ce n'est pas une erreur, c'est un socket qui finit de
    // s'ouvrir. On le dit, plutôt que de renvoyer un échec qui ferait tout
    // recommencer au vendeur.
    if (!code) {
      return NextResponse.json({
        code: null,
        pending: true,
        message: message ?? "Numéro enregistré. Le code apparaît dans quelques secondes — reste sur cet écran.",
      });
    }

    return NextResponse.json({ code });
  } catch (err) {
    console.error("[POST /api/waha/phone]", err);
    const msg = err instanceof Error ? err.message : String(err);
    // On distingue « je n'ai pas pu joindre le core » du reste : c'est la seule
    // cause sur laquelle le vendeur ne peut rien, et il doit le savoir.
    const injoignable = /fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|abort/i.test(msg);
    return NextResponse.json(
      {
        error: injoignable
          ? "Le service WhatsApp est injoignable. Réessaie dans un instant."
          : msg,
        detail: injoignable ? msg : undefined,
      },
      { status: injoignable ? 503 : 500 }
    );
  }
}
