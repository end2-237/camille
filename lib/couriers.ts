// ─────────────────────────────────────────────────────────────────────────────
// Livreurs — déléguer la course sans ouvrir la boutique.
//
// Un livreur a son propre compte Camille. Son profil lui donne un code ; le
// commerçant le colle dans son tableau de bord, et le rattachement est fait.
// À partir de là, le livreur ne voit qu'une chose : les commandes parties en
// livraison, leur trajet, et le bouton qui les marque livrées.
//
// Tout le reste — catalogue, chiffre d'affaires, fiches clients — lui reste
// fermé, et pas seulement à l'écran : chaque route vérifie le rattachement.
// Masquer un lien n'a jamais interdit d'y aller.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Sans I ni O ni 0 ni 1 : le code se dicte au téléphone sans être répété. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const COURIERS_MISSING =
  "Livreurs non installés — applique migration_couriers.sql sur la base.";

/** « LIV-7K2M » : lisible, court, et reconnaissable pour ce qu'il est. */
export function makeCourierCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `LIV-${s}`;
}

export const normalizeCode = (raw: unknown) =>
  String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

/**
 * Le code du livreur, créé au premier besoin.
 *
 * On ne le génère pas à l'inscription : la plupart des comptes sont des
 * commerçants, et un code livreur qui traîne sur chaque compte n'apprendrait
 * rien à personne.
 */
export async function courierCodeFor(userId: string): Promise<string> {
  const existing = await query("SELECT courier_code FROM camille.users WHERE id = $1", [userId]);
  const code = existing.rows[0]?.courier_code;
  if (code) return code;

  for (let essai = 0; essai < 6; essai++) {
    const candidat = makeCourierCode();
    try {
      const r = await query(
        "UPDATE camille.users SET courier_code = $1 WHERE id = $2 AND courier_code IS NULL RETURNING courier_code",
        [candidat, userId]
      );
      if (r.rows[0]?.courier_code) return r.rows[0].courier_code;
      // Quelqu'un l'a rempli entre-temps : on relit plutôt que d'écraser.
      const relu = await query("SELECT courier_code FROM camille.users WHERE id = $1", [userId]);
      if (relu.rows[0]?.courier_code) return relu.rows[0].courier_code;
    } catch (e) {
      // 23505 = collision sur l'index unique : on retire un autre code.
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  throw new Error("Impossible de tirer un code livreur libre.");
}

/** Les boutiques pour lesquelles ce compte livre, et rien d'autre. */
export async function missionsOf(userId: string) {
  const r = await query(
    `SELECT c.id, c.agent_id, c.status, c.display_name,
            a.business_name, a.name AS agent_name, a.location
       FROM camille.couriers c
       JOIN camille.agents a ON a.id = c.agent_id
      WHERE c.user_id = $1 AND c.status = 'active'
      ORDER BY a.business_name`,
    [userId]
  );
  return r.rows as any[];
}

/** Ce livreur peut-il toucher aux commandes de cette boutique ? */
export async function courierFor(userId: string, agentId: string) {
  const r = await query(
    "SELECT * FROM camille.couriers WHERE user_id = $1 AND agent_id = $2 AND status = 'active'",
    [userId, agentId]
  );
  return r.rows[0] ?? null;
}

/**
 * Les courses visibles par un livreur : celles qui sont PARTIES.
 *
 * Ni les commandes à traiter, ni celles en cuisine : le livreur n'a pas à
 * savoir ce qui se prépare, et une commande qu'il verrait trop tôt, il
 * viendrait la chercher trop tôt.
 */
export async function ridesFor(userId: string) {
  const r = await query(
    `SELECT o.id, o.ref, o.agent_id, o.status, o.items, o.total, o.currency,
            o.customer_name, o.contact_phone, o.address, o.place_label,
            o.lat, o.lng, o.note, o.scheduled_at, o.dispatched_at, o.created_at,
            o.payment_method, o.company_name, o.courier_id, o.picked_up_at,
            a.business_name AS shop_name, a.latitude AS shop_lat, a.longitude AS shop_lng,
            a.location AS shop_location
       FROM camille.orders o
       JOIN camille.couriers c ON c.agent_id = o.agent_id AND c.user_id = $1 AND c.status = 'active'
       JOIN camille.agents a   ON a.id = o.agent_id
      WHERE o.status = 'en_livraison'
      ORDER BY COALESCE(o.scheduled_at, o.dispatched_at, o.created_at)`,
    [userId]
  );
  return r.rows as any[];
}
