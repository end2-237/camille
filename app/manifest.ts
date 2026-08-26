import type { MetadataRoute } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// Le manifeste — ce qui fait de Camille une application installable.
//
// Sans lui, « Ajouter à l'écran d'accueil » sur iPhone crée un raccourci qui
// s'ouvre comme un onglet : Safari n'y donne pas le push, et le dashboard
// annonçait « navigateur non compatible » à un commerçant qui avait pourtant
// fait ce qu'on lui demandait. Le push web d'iOS n'existe que pour une
// application installée, en display standalone.
//
// start_url pointe le dashboard : on installe Camille pour surveiller ses
// commandes, pas pour relire la page d'accueil.
// ─────────────────────────────────────────────────────────────────────────────

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Camille — Agents IA par Buyticle",
    short_name: "Camille",
    description:
      "Vos commandes, vos agents et vos livraisons — notifiés même quand l'application est fermée.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16141A",
    theme_color: "#16141A",
    lang: "fr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/camille-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/camille-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/camille-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
