// ─────────────────────────────────────────────────────────────────────────────
// Les accusés de Meta : « envoyé », « remis », « lu »… et surtout « échoué ».
//
// Un message refusé par Meta ne lève aucune erreur au moment de l'envoi quand
// l'échec est découvert plus tard (client injoignable, fenêtre de 24 h
// dépassée…). Sans ces accusés, le commerçant croyait son client prévenu de la
// livraison alors que rien n'était parti. On ne retient ici QUE les échecs :
// ce sont eux qui appellent une action.
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";

type Echec = { messageId: string; phoneNumberId: string; client: string; code: number; detail: string };

/** Les échecs contenus dans une notification du webhook Meta. */
export function extraireEchecs(body: Record<string, unknown>): Echec[] {
  const out: Echec[] = [];
  for (const entry of (body.entry || []) as Record<string, unknown>[]) {
    for (const ch of (entry.changes || []) as Record<string, unknown>[]) {
      const v = (ch.value || {}) as Record<string, unknown>;
      const phoneNumberId = String((v.metadata as { phone_number_id?: string })?.phone_number_id || "");
      for (const st of (v.statuses || []) as Record<string, unknown>[]) {
        if (st.status !== "failed") continue;
        const err = ((st.errors || []) as { code?: number; title?: string; message?: string; error_data?: { details?: string } }[])[0] || {};
        out.push({
          messageId: String(st.id || ""),
          phoneNumberId,
          client: String(st.recipient_id || ""),
          code: Number(err.code || 0),
          detail: err.error_data?.details || err.message || err.title || "",
        });
      }
    }
  }
  return out;
}

/** La raison, en français, pour le commerçant. */
export function raisonEchec(code: number, detail: string): string {
  switch (code) {
    case 131047:
      return "le client n'a pas écrit depuis plus de 24 h : WhatsApp n'autorise alors qu'un modèle de message approuvé";
    case 131026:
      return "le numéro du client n'est pas joignable sur WhatsApp";
    case 131049:
      return "WhatsApp a limité les messages vers ce client pour préserver sa boîte de réception";
    case 131056:
      return "trop de messages envoyés à ce client en peu de temps";
    case 131051:
      return "type de message non pris en charge";
    case 130472:
      return "le client participe à une expérience de Meta qui bloque ce message";
    default:
      return detail ? `refusé par WhatsApp (${detail})` : `refusé par WhatsApp (code ${code || "inconnu"})`;
  }
}

/** Un même échec n'alerte qu'une fois, même si Meta renvoie l'accusé. */
const DEJA = new Set<string>();

export async function traiterEchecs(body: Record<string, unknown>): Promise<void> {
  for (const e of extraireEchecs(body)) {
    if (!e.messageId || DEJA.has(e.messageId)) continue;
    DEJA.add(e.messageId);
    if (DEJA.size > 2000) DEJA.clear();

    console.warn(`[meta] message ${e.messageId} vers ${e.client} échoué (${e.code}) : ${e.detail}`);
    try {
      const r = await query(
        `SELECT id, user_id FROM camille.agents
          WHERE to_jsonb(agents)->>'meta_phone_number_id' = $1 LIMIT 1`,
        [e.phoneNumberId]
      );
      const agent = r.rows[0];
      if (!agent?.user_id) continue;
      await notifyUser(agent.user_id, "alerte", {
        title: `Message WhatsApp non remis — +${e.client}`,
        body: `Le message n'est pas parti : ${raisonEchec(e.code, e.detail)}.`.slice(0, 160),
        data: { type: "complaint", agentId: String(agent.id), phone: e.client },
        channel: "alertes",
      });
    } catch (err) {
      console.error("[meta] échec non signalé :", (err as Error).message);
    }
  }
}
