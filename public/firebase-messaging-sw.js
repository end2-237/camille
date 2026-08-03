/* eslint-disable no-undef */
// ─────────────────────────────────────────────────────────────────────────────
// Service worker des notifications web.
//
// C'est lui, et lui seul, qui permet de recevoir une alerte quand l'onglet est
// fermé : le reste du site ne tourne plus, ce fichier si. Il vit à la racine du
// domaine pour couvrir toutes les pages — un service worker ne voit que ce qui
// est sous son propre chemin.
//
// La configuration Firebase arrive par la query string de l'enregistrement
// (voir lib/push-web.ts) : un service worker ne lit pas les variables
// d'environnement de Next, et recopier les clés en dur ici obligerait à
// modifier le fichier à chaque changement de projet Firebase.
//
// Ces clés sont publiques par nature — ce sont celles qu'un navigateur reçoit
// de toute façon. Le secret, lui, reste côté serveur.
// ─────────────────────────────────────────────────────────────────────────────

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get("apiKey") || "",
  authDomain: params.get("authDomain") || "",
  projectId: params.get("projectId") || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId: params.get("appId") || "",
};

// Sans projectId, l'initialisation échoue bruyamment à chaque réveil du worker.
// Mieux vaut un worker inerte qu'une console pleine d'erreurs illisibles.
if (config.projectId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Message reçu alors qu'aucun onglet n'est au premier plan.
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const d = payload.data || {};
    self.registration.showNotification(n.title || "Camille", {
      body: n.body || "",
      icon: "/icon",
      badge: "/icon",
      // Deux alertes du même type se remplacent au lieu de s'empiler : après
      // une nuit, on veut l'état actuel, pas quarante bannières.
      tag: d.type || "camille",
      renotify: true,
      data: d,
    });
  });
}

// Clic sur la notification : on réutilise un onglet Camille déjà ouvert plutôt
// que d'en empiler un nouveau à chaque alerte.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const cible = d.href || "/dashboard/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          c.navigate(cible);
          return c.focus();
        }
      }
      return self.clients.openWindow(cible);
    })
  );
});
