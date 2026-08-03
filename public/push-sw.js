/* eslint-disable no-undef */
// ─────────────────────────────────────────────────────────────────────────────
// Service worker des notifications web.
//
// C'est lui, et lui seul, qui permet de recevoir une alerte quand l'onglet est
// fermé : le reste du site ne tourne plus, ce fichier si. Il vit à la racine du
// domaine pour couvrir toutes les pages — un service worker ne voit que ce qui
// est sous son propre chemin.
//
// Web Push standard, sans SDK : la paire VAPID suffit. Rien n'est chargé depuis
// un domaine tiers, donc rien ne casse le jour où ce domaine bouge.
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  // Une notification poussée sans données reste possible ; mieux vaut un
  // libellé générique qu'un worker qui lève et n'affiche rien du tout.
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }

  const titre = d.title || "Camille";
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: d.body || "",
      icon: "/icon",
      badge: "/icon",
      // Deux alertes du même type se remplacent au lieu de s'empiler : après
      // une nuit, on veut l'état actuel, pas quarante bannières.
      tag: (d.data && d.data.type) || "camille",
      renotify: true,
      data: d.data || {},
    })
  );
});

// Clic sur la notification : on réutilise un onglet Camille déjà ouvert plutôt
// que d'en empiler un nouveau à chaque alerte.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.href) || "/dashboard/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(cible);
          return c.focus();
        }
      }
      return self.clients.openWindow(cible);
    })
  );
});
