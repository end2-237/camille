// ─────────────────────────────────────────────────────────────────────────────
// Les rendez-vous : créneaux libres, réservation, changement de statut.
//
// La règle « jamais deux rendez-vous qui se chevauchent » est tenue deux
// fois : on ne PROPOSE que du libre (lib/creneaux.ts), et la base REFUSE un
// chevauchement (contrainte d'exclusion, migration_rendezvous.sql). Deux
// clients qui touchent le même créneau à la même seconde : le second reçoit
// « pris », et d'autres heures.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { creneauxLibres, heureDuRappel, type Occupe } from "@/lib/creneaux";
import { envoyerMeta } from "@/lib/whatsapp/modeles";

export type Statut = "demande" | "confirme" | "annule" | "termine" | "absent";
export type RendezVous = {
  id: string; agent_id: string; phone: string; nom: string | null; prestation: string | null;
  debut: string; fin: string; statut: Statut; note: string | null; source: string; created_at: string;
};

/** Les réglages de l'agent : durée par défaut et espacement des débuts. */
export async function reglagesRdv(agentId: string): Promise<{ duree: number; pas: number }> {
  try {
    const r = await query(`SELECT to_jsonb(a)->'capabilities'->'rdv' AS rdv, to_jsonb(a)->>'capabilities' AS brut FROM camille.agents a WHERE id = $1`, [agentId]);
    let rdv = r.rows[0]?.rdv as { duree?: number; pas?: number } | null;
    if (!rdv && typeof r.rows[0]?.brut === "string") {
      try { rdv = JSON.parse(r.rows[0].brut)?.rdv ?? null; } catch { rdv = null; }
    }
    const duree = Math.min(480, Math.max(15, Number(rdv?.duree) || 30));
    return { duree, pas: Math.min(240, Math.max(15, Number(rdv?.pas) || duree)) };
  } catch {
    return { duree: 30, pas: 30 };
  }
}

/** Les rendez-vous actifs (demandés ou confirmés) d'une période. */
export async function occupes(agentId: string, de: Date, a: Date): Promise<Occupe[]> {
  try {
    const r = await query(
      `SELECT debut, fin FROM camille.rendez_vous
        WHERE agent_id = $1 AND statut IN ('demande','confirme') AND fin > $2 AND debut < $3`,
      [agentId, de.toISOString(), a.toISOString()]
    );
    return r.rows.map((x: { debut: string; fin: string }) => ({ debut: new Date(x.debut), fin: new Date(x.fin) }));
  } catch {
    return []; // table absente : migration_rendezvous.sql
  }
}

/** Les prochains créneaux libres pour une durée donnée (ou celle de l'agent). */
export async function proposer(agentId: string, horaires: string | null | undefined, duree?: number, n = 9): Promise<Date[]> {
  const reg = await reglagesRdv(agentId);
  const d = duree || reg.duree;
  const maintenant = new Date();
  const pris = await occupes(agentId, maintenant, new Date(maintenant.getTime() + 15 * 86400_000));
  return creneauxLibres({ horaires, occupes: pris, duree: d, pas: duree ? undefined : reg.pas, maintenant, n });
}

/**
 * Réserve un créneau. Atomique : l'insertion n'a lieu que si rien ne chevauche,
 * et la contrainte de la base tranche les courses à la seconde près.
 */
export async function reserver(p: {
  agentId: string; phone: string; nom?: string | null; debut: Date; duree?: number;
  prestation?: string | null; productId?: string | null; source?: string; note?: string | null;
}): Promise<{ ok: true; rdv: RendezVous } | { ok: false; raison: "pris" | "passe" | "erreur"; detail?: string }> {
  const duree = p.duree || (await reglagesRdv(p.agentId)).duree;
  const fin = new Date(p.debut.getTime() + duree * 60_000);
  if (p.debut.getTime() < Date.now() - 5 * 60_000) return { ok: false, raison: "passe" };
  try {
    const r = await query(
      `INSERT INTO camille.rendez_vous (agent_id, phone, nom, prestation, product_id, debut, fin, source, note)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
        WHERE NOT EXISTS (
          SELECT 1 FROM camille.rendez_vous
           WHERE agent_id = $1 AND statut IN ('demande','confirme')
             AND tstzrange(debut, fin, '[)') && tstzrange($6::timestamptz, $7::timestamptz, '[)'))
       RETURNING *`,
      [p.agentId, p.phone, p.nom || null, p.prestation || null, p.productId || null, p.debut.toISOString(), fin.toISOString(), p.source || "whatsapp", p.note || null]
    );
    if (!r.rows.length) return { ok: false, raison: "pris" };
    return { ok: true, rdv: r.rows[0] as RendezVous };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23P01") return { ok: false, raison: "pris" }; // exclusion : course perdue
    return { ok: false, raison: "erreur", detail: err.message };
  }
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
/** « mardi 21 octobre à 10h30 », à l'heure de Douala. */
export function quandLisible(d: Date): string {
  const x = new Date(d.getTime() + 3600_000);
  const mois = x.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  return `${JOURS[x.getUTCDay()]} ${x.getUTCDate()} ${mois} à ${x.getUTCHours()}h${String(x.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Change le statut et prévient le client sur WhatsApp (dans les 24 h, en
 * message libre ; au-delà, par le modèle de message de Camille).
 */
export async function changerStatut(agentId: string, id: string, statut: Statut, motif = ""): Promise<{ ok: boolean; error?: string; envoye?: boolean }> {
  const r = await query(
    `UPDATE camille.rendez_vous SET statut = $3, updated_at = NOW()
      WHERE id = $1 AND agent_id = $2 RETURNING *`,
    [id, agentId, statut]
  ).catch((e: { code?: string; message: string }) => ({ rows: [], error: e }));
  const rdv = (r as { rows: RendezVous[] }).rows[0];
  if (!rdv) {
    const e = (r as { error?: { code?: string } }).error;
    return { ok: false, error: e?.code === "23P01" ? "Ce créneau chevauche un autre rendez-vous actif." : "Rendez-vous introuvable." };
  }
  const nomCommerce = (await query(`SELECT business_name, location FROM camille.agents WHERE id = $1`, [agentId]).catch(() => ({ rows: [] }))).rows[0] as { business_name?: string; location?: string } | undefined;
  const quand = quandLisible(new Date(rdv.debut));
  const textes: Partial<Record<Statut, string>> = {
    confirme: `✅ C'est confirmé : votre rendez-vous${rdv.prestation ? ` (${rdv.prestation})` : ""} chez ${nomCommerce?.business_name || "nous"} est le ${quand}.${nomCommerce?.location ? `\n📍 ${nomCommerce.location}` : ""}\nÀ très vite 🙏`,
    annule: `Votre rendez-vous du ${quand} ne peut malheureusement pas être maintenu${motif ? ` (${motif})` : ""}. Écrivez-nous ici pour choisir un autre moment 🙏`,
  };
  const texte = textes[statut];
  if (!texte) return { ok: true };
  const envoi = await envoyerMeta(agentId, rdv.phone, texte).catch((e: Error) => ({ ok: false, error: e.message }));
  return { ok: true, envoye: envoi.ok, error: envoi.ok ? undefined : `Statut changé, mais le message n'est pas parti : ${envoi.error}` };
}

/**
 * Le tour des rappels (toutes les 10 minutes, instrumentation.ts). Chaque
 * rendez-vous est marqué AVANT l'envoi : deux instances ne rappellent jamais
 * deux fois le même client.
 */
export async function rappelerRendezVous(maintenant = new Date()): Promise<number> {
  let candidats: (RendezVous & { business_name: string | null; location: string | null })[];
  try {
    candidats = (await query(
      `SELECT r.*, a.business_name, a.location FROM camille.rendez_vous r
         JOIN camille.agents a ON a.id = r.agent_id
        WHERE r.statut = 'confirme' AND r.rappel_at IS NULL
          AND r.debut > $1 AND r.debut < $1::timestamptz + INTERVAL '16 hours'`,
      [maintenant.toISOString()]
    )).rows;
  } catch {
    return 0; // colonne rappel_at absente : migration_rendezvous.sql
  }
  let envoyes = 0;
  for (const r of candidats) {
    if (heureDuRappel(new Date(r.debut)).getTime() > maintenant.getTime()) continue;
    const pris = await query(
      `UPDATE camille.rendez_vous SET rappel_at = NOW() WHERE id = $1 AND rappel_at IS NULL RETURNING id`, [r.id]
    ).catch(() => ({ rows: [] }));
    if (!pris.rows.length) continue;
    const texte =
      `⏰ Petit rappel : votre rendez-vous${r.prestation ? ` (${r.prestation})` : ""} chez ${r.business_name || "nous"} ` +
      `est prévu ${quandLisible(new Date(r.debut))}.${r.location ? `\n📍 ${r.location}` : ""}\n` +
      `Un empêchement ? Répondez simplement ici, on trouvera un autre moment 🙏`;
    const e = await envoyerMeta(r.agent_id, r.phone, texte).catch((x: Error) => ({ ok: false, error: x.message }));
    if (e.ok) envoyes++;
    else console.warn(`[rappels] rendez-vous ${r.id} : ${e.error}`);
  }
  return envoyes;
}
