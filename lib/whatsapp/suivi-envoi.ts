// ─────────────────────────────────────────────────────────────────────────────
// Le suivi de commande — la partie qui lit la base et envoie.
// Les textes et les boutons sont dans suivi.ts, sans dépendance, et éprouvés.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import * as meta from "./meta";
import { transportDe, type EnvoiResult } from "./envoi";
import { annonce, urlAnimation, type CommandeSuivie } from "./suivi";

export type CommandeComplete = CommandeSuivie & {
  id: string;
  agent_id: string;
  contact_phone: string | null;
  doc_url?: string | null;
  doc_number?: string | null;
  courier_phone?: string | null;
  courier_lat?: number | null;
  courier_lng?: number | null;
  courier_seen_at?: string | Date | null;
  business_name?: string | null;
};

/**
 * Les animations de réussite : un sticker WebP animé (512×512, ≤ 500 Ko).
 *
 * Par défaut, ceux livrés avec Camille dans public/stickers (✅ et 🎉, emojis
 * animés Noto, CC BY 4.0), servis depuis NEXT_PUBLIC_APP_URL. Pour en mettre
 * d'autres : STICKER_COMMANDE_URL / STICKER_LIVREE_URL. Pour n'en envoyer
 * aucun : la variable à « off ». Best-effort : un refus ne bloque rien.
 */
export async function envoyerAnimation(phone: string, moment: "commande" | "livree"): Promise<void> {
  const url = urlAnimation(moment);
  if (!url) return;
  const r = await meta.sendSticker(phone, url);
  if (!r.ok) console.warn(`[suivi] animation « ${moment} » refusée :`, r.error);
}

const chiffres = (s: unknown) => String(s || "").replace(/@.*$/, "").replace(/[^0-9]/g, "");

/**
 * Une commande avec son livreur. Par identifiant, ou par référence ; dans ce
 * second cas `phone` est OBLIGATOIRE et doit être celui du client — un bouton
 * « cmd:recap:<ref> » se recopie, une commande ne se montre qu'à son client.
 */
export async function chargerCommande(
  q: { id?: string; agentId?: string; ref?: string; phone?: string }
): Promise<CommandeComplete | null> {
  if (!q.id && !(q.agentId && q.ref && q.phone)) return null;
  const ou = q.id ? "o.id = $1" : "o.agent_id = $1 AND upper(o.ref) = upper($2)";
  const args = q.id ? [q.id] : [q.agentId, q.ref];
  const avecLivreur = `
    SELECT o.*, a.business_name,
           c.display_name AS courier_name, c.phone AS courier_phone,
           c.last_lat AS courier_lat, c.last_lng AS courier_lng, c.last_seen_at AS courier_seen_at
      FROM camille.orders o
      JOIN camille.agents a ON a.id = o.agent_id
      LEFT JOIN camille.couriers c ON c.id = o.courier_id
     WHERE ${ou} LIMIT 1`;
  const sansLivreur = `
    SELECT o.*, a.business_name FROM camille.orders o
      JOIN camille.agents a ON a.id = o.agent_id
     WHERE ${ou} LIMIT 1`;
  let row: Record<string, unknown> | undefined;
  try {
    row = (await query(avecLivreur, args)).rows[0];
  } catch {
    // Livreurs non installés (migration_couriers.sql) : la commande reste lisible.
    try { row = (await query(sansLivreur, args)).rows[0]; } catch { return null; }
  }
  if (!row) return null;
  if (q.phone && chiffres(row.contact_phone) !== chiffres(q.phone)) return null;
  const items = Array.isArray(row.items)
    ? row.items
    : (() => { try { return JSON.parse(String(row.items || "[]")); } catch { return []; } })();
  return { ...(row as unknown as CommandeComplete), items };
}

/**
 * Annonce l'étape au client, avec ses boutons — agents Meta seulement.
 * Ne lève jamais. `skipped` quand l'agent parle par camille-core (pas de
 * boutons) ou quand l'étape n'a rien à dire.
 */
export async function annoncerStatut(orderId: string): Promise<EnvoiResult> {
  const o = await chargerCommande({ id: orderId });
  if (!o) return { ok: false, transport: "meta", error: "commande introuvable" };
  const { transport } = await transportDe(String(o.agent_id), (o as { session_name?: string }).session_name);
  if (transport !== "meta") return { ok: false, transport, skipped: true };

  const phone = chiffres(o.contact_phone);
  if (!phone) return { ok: false, transport, error: "aucun numéro client sur la commande" };

  const a = annonce(o, { boutique: o.business_name || undefined, avecLivreur: Boolean(o.courier_name) });
  if (!a) return { ok: false, transport, skipped: true };

  // Une petite animation de réussite à la livraison, si le commerçant en a
  // fourni une. Best-effort : sans elle, le message part quand même.
  if (o.status === "livree") await envoyerAnimation(phone, "livree");

  const r = await meta.sendButtons(phone, a.texte, a.boutons);
  if (!r.ok) {
    // 131047 : plus de 24 h sans message du client. Meta n'accepte alors
    // qu'un modèle approuvé — on le dit clairement au commerçant.
    const horsFenetre = /131047|24 ?h|re-?engagement/i.test(String(r.error || ""));
    return {
      ok: false, transport,
      error: horsFenetre
        ? "Le client n'a pas écrit depuis plus de 24 h : WhatsApp n'autorise qu'un message modèle approuvé."
        : r.error,
    };
  }
  try {
    await query(
      `INSERT INTO camille.agent_conversations (session_name, contact_phone, role, content, created_at)
       VALUES ($1, $2, 'assistant', $3, NOW())`,
      [`meta:${o.agent_id}`, phone, `[suivi ${o.status}] ${a.texte}`.slice(0, 4000)]
    );
  } catch { /* la trace ne doit jamais faire échouer l'envoi */ }
  return { ok: true, transport };
}

/** La dernière commande non terminée de ce client (14 jours au plus), ou null. */
export async function commandeEnCours(agentId: string, phone: string): Promise<CommandeSuivie | null> {
  try {
    const r = await query(
      `SELECT ref, status, fulfillment, items, delivery_fee, total, currency, address,
              to_jsonb(o)->>'place_label' AS place_label
         FROM camille.orders o
        WHERE agent_id = $1
          AND regexp_replace(COALESCE(contact_phone, ''), '[^0-9]', '', 'g') = $2
          AND status NOT IN ('livree', 'annulee')
          AND created_at > now() - interval '14 days'
        ORDER BY created_at DESC LIMIT 1`,
      [agentId, chiffres(phone)]
    );
    const row = r.rows[0];
    if (!row) return null;
    const items = Array.isArray(row.items)
      ? row.items
      : (() => { try { return JSON.parse(String(row.items || "[]")); } catch { return []; } })();
    return { ...row, items } as CommandeSuivie;
  } catch {
    return null;
  }
}

