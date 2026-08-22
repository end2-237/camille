// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/v1/track — le mouchard, en une balise à coller.
//
//   <script src="https://camille…/api/public/v1/track" data-key="cam_pk_…" defer></script>
//
// Rien à installer, rien à construire : le marchand colle cette ligne dans son
// site (WordPress, Wix, Shopify, un site fait main) et son trafic apparaît dans
// Camille. Pour un site en React qui change de page sans recharger, le script
// suit aussi l'historique du navigateur.
//
// Le site qui préfère tout piloter appelle directement /api/public/v1/events.
//
// Aucun cookie, aucune IP, aucun identifiant partagé entre domaines : un
// identifiant aléatoire vit dans le stockage local du visiteur, et rien
// d'autre ne sort.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;

  const js = `(function () {
  var s = document.currentScript;
  var key = (s && s.getAttribute("data-key")) || "";
  if (!key) { console.warn("[camille] data-key manquant sur la balise de mesure"); return; }
  var api = ${JSON.stringify(base)} + "/api/public/v1/events";

  function id(k, ttl) {
    try {
      var raw = localStorage.getItem(k);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.v && o.t && Date.now() - o.t < ttl) {
          o.t = Date.now(); localStorage.setItem(k, JSON.stringify(o));
          return o.v;
        }
      }
    } catch (e) {}
    var v = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(k, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
    return v;
  }

  var visitor = id("cml_v", 30 * 864e5);   // 30 jours
  var session = id("cml_s", 30 * 6e4);     // 30 minutes d'inactivité

  function send(ev) {
    ev.visitor = visitor; ev.session = session;
    ev.locale = (navigator.language || "").slice(0, 12);
    var body = JSON.stringify({ events: [ev] });
    try {
      // sendBeacon ne porte pas d'en-tête : la clé passe en paramètre.
      if (navigator.sendBeacon) {
        var ok = navigator.sendBeacon(api + "?key=" + encodeURIComponent(key), new Blob([body], { type: "text/plain" }));
        if (ok) return;
      }
    } catch (e) {}
    fetch(api, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "text/plain", "X-Camille-Key": key },
      body: body,
    }).catch(function () {});
  }

  function view() {
    send({ kind: "page_view", path: location.pathname + location.search,
           title: document.title, referrer: document.referrer });
  }

  // Navigation sans rechargement (React, Vue, Next…) : on suit l'historique.
  var push = history.pushState;
  history.pushState = function () { push.apply(this, arguments); setTimeout(view, 0); };
  addEventListener("popstate", function () { setTimeout(view, 0); });

  view();
  // Le site peut envoyer ses propres événements : camille("add_to_cart", {…})
  window.camille = function (kind, meta) { send({ kind: kind, path: location.pathname, meta: meta || {} }); };
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
