// ─────────────────────────────────────────────────────────────────────────────
// Le bilan du matin.
//
// À l'heure d'ouverture du commerce (8 h à Douala si ses horaires sont
// illisibles), une notification par agent :
//   - les commandes arrivées pendant la fermeture, qui attendent ;
//   - la journée d'hier : commandes, chiffre, clients servis ;
//   - ce que les clients ont demandé sans le trouver.
//
// C'est ce qui fait revenir le commerçant dans Camille chaque matin — la
// rétention, pas un gadget. Une seule fois par jour et par agent.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";
import { heureLocale, lireHoraires } from "@/lib/horaires";
import { regrouperDemandes } from "@/lib/whatsapp/demandes";

/** Douala : UTC+1, sans heure d'été. */
const DECALAGE = 1;

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/** Les demandes manquées d'un agent sur une période, regroupées. */
export async function demandesManquees(agentId: string, jours = 30, max = 5) {
  const r = await query(
    `SELECT texte, phone FROM camille.demandes_manquees
      WHERE agent_id = $1 AND created_at > NOW() - make_interval(days => $2)
      ORDER BY created_at DESC LIMIT 2000`,
    [agentId, jours]
  );
  return regrouperDemandes(r.rows as { texte: string; phone: string | null }[], max);
}

/** Le texte du bilan d'un agent, ou null s'il n'y a rien à dire. */
export async function composerBilan(agentId: string): Promise<{ titre: string; corps: string } | null> {
  const [attente, hier, clients] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0)::float AS montant
         FROM camille.orders WHERE agent_id = $1 AND status = 'nouvelle'`,
      [agentId]
    ),
    query(
      `SELECT COUNT(*)::int AS n,
              COALESCE(SUM(total) FILTER (WHERE status <> 'annulee'), 0)::float AS montant
         FROM camille.orders
        WHERE agent_id = $1
          AND (created_at AT TIME ZONE 'Africa/Douala')::date = (NOW() AT TIME ZONE 'Africa/Douala')::date - 1`,
      [agentId]
    ),
    query(
      `SELECT COUNT(DISTINCT contact_phone)::int AS n FROM camille.agent_conversations
        WHERE session_name = $1 AND role = 'user'
          AND (created_at AT TIME ZONE 'Africa/Douala')::date = (NOW() AT TIME ZONE 'Africa/Douala')::date - 1`,
      [`meta:${agentId}`]
    ).catch(() => ({ rows: [{ n: 0 }] })),
  ]);
  const manquees = await demandesManquees(agentId, 7, 3).catch(() => []);

  const a = attente.rows[0] || { n: 0, montant: 0 };
  const h = hier.rows[0] || { n: 0, montant: 0 };
  const c = Number(clients.rows[0]?.n) || 0;
  if (!a.n && !h.n && !c && !manquees.length) return null;

  const lignes: string[] = [];
  if (a.n) lignes.push(`${a.n} commande${a.n > 1 ? "s" : ""} à traiter (${fcfa(a.montant)}).`);
  lignes.push(`Hier : ${h.n} commande${h.n > 1 ? "s" : ""}${h.n ? `, ${fcfa(h.montant)}` : ""}, ${c} client${c > 1 ? "s" : ""} servi${c > 1 ? "s" : ""}.`);
  if (manquees.length) {
    lignes.push(`Demandé sans succès : ${manquees.map((m) => `${m.demande} (${m.clients})`).join(", ")}.`);
  }
  return {
    titre: a.n ? `☀️ Bonjour ! ${a.n} commande${a.n > 1 ? "s" : ""} vous attend${a.n > 1 ? "ent" : ""}` : "☀️ Votre bilan du jour",
    corps: lignes.join(" "),
  };
}

/**
 * Le tour du bilan. Appelé toutes les heures : chaque agent reçoit le sien à
 * son heure d'ouverture, une fois par jour.
 */
export async function envoyerBilans(maintenant = new Date()): Promise<{ envoyes: number }> {
  const heure = Math.floor(heureLocale(maintenant, DECALAGE));
  let agents: { id: string; user_id: string; business_hours: string | null; name: string }[] = [];
  try {
    const r = await query(
      `SELECT id, user_id, business_hours, COALESCE(NULLIF(name, ''), business_name, 'Votre agent') AS name
         FROM camille.agents WHERE status = 'active' AND user_id IS NOT NULL`
    );
    agents = r.rows;
  } catch (e) {
    console.error("[bilan] agents illisibles :", (e as Error).message);
    return { envoyes: 0 };
  }

  let envoyes = 0;
  for (const a of agents) {
    const ouvre = Math.floor(lireHoraires(a.business_hours)?.ouvre ?? 8);
    if (heure !== ouvre) continue;
    try {
      // Réserve le jour AVANT d'envoyer : deux tours simultanés n'en
      // enverraient qu'un.
      const res = await query(
        `INSERT INTO camille.bilans_envoyes (agent_id, jour)
         VALUES ($1, (NOW() AT TIME ZONE 'Africa/Douala')::date) ON CONFLICT DO NOTHING RETURNING 1`,
        [a.id]
      );
      if (!res.rows.length) continue;
      const b = await composerBilan(a.id);
      if (!b) continue;
      await notifyUser(a.user_id, "systeme", {
        title: `${b.titre} — ${a.name}`.slice(0, 90),
        body: b.corps.slice(0, 240),
        data: { type: "bilan", agentId: a.id },
        channel: "commandes",
      });
      envoyes++;
    } catch (e) {
      console.error("[bilan]", a.id, (e as Error).message);
    }
  }
  return { envoyes };
}
