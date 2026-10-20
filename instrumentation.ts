// ─────────────────────────────────────────────────────────────────────────────
// Les tâches de fond du serveur Camille.
//
// Next.js appelle register() une fois au démarrage. On y lance le tour
// horaire du bilan du matin : chaque agent reçoit le sien à son heure
// d'ouverture. Pas besoin de n8n pour ça — un oubli de configuration ne doit
// pas priver tous les commerçants de leur bilan.
//
// CAMILLE_TACHES=0 coupe les tâches (une seconde instance, un test local).
// ─────────────────────────────────────────────────────────────────────────────
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CAMILLE_TACHES === "0" || process.env.NODE_ENV !== "production") return;

  const { envoyerBilans } = await import("./lib/bilan");
  const tour = () => envoyerBilans().catch((e) => console.error("[taches] bilan :", (e as Error).message));

  // Au début de chaque heure (+2 min), pour tomber pile sur les ouvertures.
  const attente = ((62 - new Date().getUTCMinutes()) % 60) * 60_000;
  setTimeout(() => {
    tour();
    setInterval(tour, 3600_000);
  }, attente || 60_000);
}
