// Colonnes lues sur camille.agents par les statistiques.
//
// Partagees entre /api/stats et /api/stats/diagnostic a dessein : le diagnostic
// lisait « id, status » pendant que /api/stats demandait « identity,
// business_context » — des colonnes qui n'existent pas. Le diagnostic annoncait
// donc « aucun probleme detecte » alors que la page de statistiques etait vide.
// Tant que les deux partagent cette constante, le diagnostic echoue exactement
// la ou les statistiques echouent.
//
// Rappel : l'identite et le contexte metier sont des colonnes plates ; les
// objets « identity » et « business_context » sont reconstruits en JavaScript
// (voir rowToAgent dans app/api/agents/route.ts).
export const AGENT_STATS_COLUMNS =
  "id, plan, status, capabilities, name, avatar_emoji, sector, created_at";
