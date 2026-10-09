// ─────────────────────────────────────────────────────────────────────────────
// Qui peut faire quoi sur un agent.
//
// Le propriétaire (agents.user_id) peut tout. Ses collaborateurs
// (camille.team_members, statut « active ») ont un rôle :
//
//   gerant  → voir, ventes, catalogue, reglages
//   vendeur → voir, ventes
//
// et l'accès à tous les agents du propriétaire, ou à une liste précise.
// facturation, equipe et supprimer restent au seul propriétaire.
//
// Sans la table (migration_team.sql pas encore passée), seul le propriétaire
// a accès : exactement le comportement d'avant.
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "@/lib/db";

import { permet, type Action, type Role } from "@/lib/roles";
export { permet, LIBELLE_ROLE, type Action, type Role } from "@/lib/roles";

// La table existe-t-elle ? Vérifié une fois par processus (puis toutes les
// 5 minutes tant qu'elle manque, pour voir passer la migration sans redémarrer).
let tableVue: { ok: boolean; le: number } | null = null;
async function equipeActive(): Promise<boolean> {
  if (tableVue && (tableVue.ok || Date.now() - tableVue.le < 5 * 60_000)) return tableVue.ok;
  try {
    const r = await query(`SELECT to_regclass('camille.team_members') IS NOT NULL AS ok`);
    tableVue = { ok: !!r.rows[0]?.ok, le: Date.now() };
  } catch {
    tableVue = { ok: false, le: Date.now() };
  }
  return tableVue.ok;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le rôle de cet utilisateur sur cet agent (non archivé), ou null. */
export async function roleSurAgent(
  userId: string,
  agentId: string,
  opts: { archives?: boolean } = {}
): Promise<Role | null> {
  if (!UUID.test(agentId)) return null;
  const r = await query(
    `SELECT user_id FROM camille.agents WHERE id = $1 ${opts.archives ? "" : "AND status <> 'archived'"}`,
    [agentId]
  );
  const proprio = r.rows[0]?.user_id as string | undefined;
  if (!proprio) return null;
  if (proprio === userId) return "proprietaire";
  if (!(await equipeActive())) return null;
  const m = await query(
    `SELECT role FROM camille.team_members
      WHERE owner_id = $1 AND member_id = $2 AND status = 'active'
        AND (agent_ids IS NULL OR $3::uuid = ANY(agent_ids))
      LIMIT 1`,
    [proprio, userId, agentId]
  );
  return (m.rows[0]?.role as Role | undefined) ?? null;
}

/** L'utilisateur peut-il faire `action` sur cet agent ? */
export async function peut(userId: string, agentId: string, action: Action, opts: { archives?: boolean } = {}): Promise<boolean> {
  return permet(await roleSurAgent(userId, agentId, opts), action);
}

/**
 * Condition SQL « l'agent `alias` est accessible à l'utilisateur `$param` »,
 * pour les listes (commandes, réclamations, statistiques…). Les vendeurs et
 * gérants voient les agents qu'on leur a ouverts.
 */
export async function sqlAgentAccessible(alias: string, param: string): Promise<string> {
  if (!(await equipeActive())) return `${alias}.user_id = ${param}`;
  // Comparaisons en texte : elles tiennent quel que soit le type réel des
  // colonnes (uuid ou text selon l'âge de la base).
  return `(${alias}.user_id = ${param} OR EXISTS (
    SELECT 1 FROM camille.team_members tm
     WHERE tm.owner_id::text = ${alias}.user_id::text AND tm.member_id::text = ${param}::text
       AND tm.status = 'active'
       AND (tm.agent_ids IS NULL OR ${alias}.id::text = ANY(tm.agent_ids::text[]))))`;
}

/** Les agents accessibles et le rôle sur chacun. */
export async function agentsAccessibles(userId: string): Promise<{ id: string; role: Role }[]> {
  const cond = await sqlAgentAccessible("a", "$1");
  const r = await query(
    `SELECT a.id, a.user_id FROM camille.agents a WHERE a.status <> 'archived' AND ${cond}`,
    [userId]
  );
  const res: { id: string; role: Role }[] = [];
  for (const row of r.rows) {
    if (row.user_id === userId) res.push({ id: row.id, role: "proprietaire" });
    else res.push({ id: row.id, role: (await roleSurAgent(userId, row.id)) ?? "vendeur" });
  }
  return res;
}

/** Les comptes (propriétaires) dont l'utilisateur est membre actif. */
export async function proprietairesDe(userId: string): Promise<string[]> {
  if (!(await equipeActive())) return [];
  const r = await query(
    `SELECT DISTINCT owner_id FROM camille.team_members WHERE member_id = $1 AND status = 'active'`,
    [userId]
  );
  return r.rows.map((x) => x.owner_id as string);
}

/** Les membres actifs d'un compte qui peuvent faire `action` sur cet agent (pour les notifier). */
export async function membresPour(ownerId: string, agentId: string | null, action: Action): Promise<string[]> {
  if (!(await equipeActive())) return [];
  const r = await query(
    `SELECT member_id, role FROM camille.team_members
      WHERE owner_id = $1 AND status = 'active' AND member_id IS NOT NULL
        AND ($2::uuid IS NULL OR agent_ids IS NULL OR $2::uuid = ANY(agent_ids))`,
    [ownerId, agentId]
  );
  return r.rows.filter((x) => permet(x.role as Role, action)).map((x) => x.member_id as string);
}

export const refusDroit = { error: "Votre rôle ne permet pas cette action" };
