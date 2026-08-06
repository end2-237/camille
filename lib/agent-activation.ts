// ─────────────────────────────────────────────────────────────────────────────
// Promotion d'un agent « brouillon » en agent « actif ».
//
// Un agent naît en `draft` (voir l'INSERT de POST /api/agents). Or n8n ne
// travaille qu'avec des agents `active` : GET /api/agents/by-session filtre
// dessus, et sans ligne il renvoie 404 « Aucun agent actif pour cette
// session ». Le workflow s'arrête là — aucun message n'est traité.
//
// Rien ne faisait franchir ce pas. L'application mobile annonçait pourtant
// « Connecte WhatsApp pour l'activer », et brancher WhatsApp n'activait rien :
// le vendeur voyait sa session en ligne, son téléphone couplé, et ses clients
// écrivaient dans le vide. La promesse est tenue ici.
//
// On ne promeut QUE depuis `draft`. `paused` est un geste délibéré du vendeur
// et `archived` une suppression : une reconnexion WhatsApp ne doit jamais les
// annuler dans son dos.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";

/**
 * Active l'agent s'il est encore en brouillon. À n'appeler qu'au moment où la
 * session WhatsApp est réellement connectée — pas au démarrage de la session,
 * qui précède le scan du QR code.
 *
 * Ne lève jamais : cette promotion est un effet de bord d'une route dont ce
 * n'est pas le sujet, et l'échouer ne doit pas faire échouer l'appel principal.
 *
 * @returns true si l'agent vient de passer de brouillon à actif.
 */
export async function activerAgentSiBrouillon(agentId: string | null | undefined): Promise<boolean> {
  if (!agentId) return false;
  try {
    const r = await query(
      `UPDATE camille.agents
          SET status = 'active', updated_at = NOW()
        WHERE id = $1 AND status = 'draft'
        RETURNING id`,
      [agentId]
    );
    return r.rows.length > 0;
  } catch (err) {
    console.error("[activerAgentSiBrouillon]", err);
    return false;
  }
}

/**
 * Même chose à partir du nom de session, quand l'appelant ne connaît que lui
 * (c'est le cas de camille-core, qui ne manipule pas d'identifiants d'agent).
 */
export async function activerAgentDeSessionSiBrouillon(sessionName: string): Promise<boolean> {
  if (!sessionName) return false;
  try {
    const r = await query(
      `UPDATE camille.agents a
          SET status = 'active', updated_at = NOW()
         FROM camille.whatsapp_sessions ws
        WHERE ws.session_name = $1
          AND a.id = ws.agent_id
          AND a.status = 'draft'
        RETURNING a.id`,
      [sessionName]
    );
    return r.rows.length > 0;
  } catch (err) {
    console.error("[activerAgentDeSessionSiBrouillon]", err);
    return false;
  }
}
