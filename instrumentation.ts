// ─────────────────────────────────────────────────────────────────────────────
// Les tâches de fond du serveur Camille (lib/taches.ts).
//
// Next.js appelle register() une fois au démarrage, et compile ce fichier
// aussi pour le runtime « edge » (à cause de middleware.ts). L'import vit donc
// DANS le bloc nodejs : c'est la forme que Next sait élaguer, et la base de
// données ou web-push ne sont jamais embarqués côté edge.
//
// CAMILLE_TACHES=0 coupe les tâches (une seconde instance, un test local).
// ─────────────────────────────────────────────────────────────────────────────
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.CAMILLE_TACHES === "0" || process.env.NODE_ENV !== "production") return;
    const { lancerTaches } = await import("./lib/taches");
    lancerTaches();
  }
}
