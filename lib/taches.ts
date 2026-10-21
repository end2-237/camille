// ─────────────────────────────────────────────────────────────────────────────
// Les tâches de fond du serveur Camille (Node seulement, lancées par
// instrumentation.ts).
//
// Le bilan du matin : chaque agent reçoit le sien à son heure d'ouverture.
// Pas besoin de n8n pour ça — un oubli de configuration ne doit pas priver
// tous les commerçants de leur bilan. Et les rappels de rendez-vous.
// ─────────────────────────────────────────────────────────────────────────────
import { envoyerBilans } from "./bilan";
import { rappelerRendezVous } from "./rendezvous";

export function lancerTaches() {
  const tour = () => envoyerBilans().catch((e) => console.error("[taches] bilan :", (e as Error).message));

  // Au début de chaque heure (+2 min), pour tomber pile sur les ouvertures.
  const attente = ((62 - new Date().getUTCMinutes()) % 60) * 60_000;
  setTimeout(() => {
    tour();
    setInterval(tour, 3600_000);
  }, attente || 60_000);

  // Les rappels de rendez-vous : toutes les 10 minutes.
  setInterval(() => {
    rappelerRendezVous()
      .then((n) => { if (n) console.log(`[taches] ${n} rappel(s) de rendez-vous envoyé(s)`); })
      .catch((e) => console.error("[taches] rappels :", (e as Error).message));
  }, 10 * 60_000);
}
