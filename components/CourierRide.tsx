"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La course, vue du guidon.
//
// Un livreur n'a pas besoin d'un tableau de bord : il lui faut l'adresse, le
// téléphone du client, le trajet, et un bouton pour dire que c'est remis.
//
// Dès qu'il démarre, son téléphone suit sa position : le point avance sur la
// carte, la route se recalcule depuis là où il est, et la distance restante
// fond. C'est ce qui distingue un itinéraire d'une simple carte — on voit
// qu'on est en train de rouler vers le client.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/lib/auth-client";
import { toast } from "sonner";
import { Check, Loader2, MapPin, Navigation, Phone, Play, Square, X } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Ride = {
  id: string; ref: string; agent_id: string; shop: string;
  total: number; currency: string; items_count: number;
  customer_name: string | null; phone: string; address: string | null;
  note: string | null; company: string | null; payment_method: string | null;
  lat: number | null; lng: number | null;
  shop_lat: number | null; shop_lng: number | null;
  scheduled_at: string | null; picked_up_at: string | null; mine: boolean;
};

type Point = { lat: number; lng: number };
type Route = { ok: true; distance_m: number; duration_s: number; from: Point; to: Point; points: Point[] }
           | { ok: false; reason: string; to?: Point; from?: Point };

const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
const mn = (s: number) => (s < 60 ? "moins d'une minute" : `${Math.round(s / 60)} min`);
const money = (n: number, c: string) => `${Number(n || 0).toLocaleString("fr-FR")} ${c || "XAF"}`;

const RAISONS: Record<string, string> = {
  no_customer_position: "Ce client n'a pas partagé sa position : suis l'adresse écrite.",
  no_start: "On n'arrive pas à situer ton départ. Démarre la course pour donner ta position.",
  router_unavailable: "Le calculateur de trajet ne répond pas. Réessaie dans un instant.",
  no_route: "Aucune route trouvée jusqu'à ce point.",
  error: "Le trajet n'a pas pu être calculé.",
};

/** À vol d'oiseau : sert à décider s'il faut redemander une route. */
function metres(a: Point, b: Point) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function CourierRide({ ride, onClose, onDelivered }: {
  ride: Ride; onClose: () => void; onDelivered: (id: string) => void;
}) {
  const [route, setRoute] = useState<Route | null>(null);
  const [me, setMe] = useState<Point | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);

  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const meMarker = useRef<any>(null);
  const line = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const pushed = useRef(0);         // dernier envoi de position au serveur
  const routedFrom = useRef<Point | null>(null);

  // ── Le trajet, depuis là où l'on est ─────────────────────────────────────
  const loadRoute = useCallback(async (from: Point | null) => {
    try {
      const q = from ? `?from=${from.lat},${from.lng}` : "";
      const r = await fetch(`/api/courier/orders/${ride.id}/itinerary${q}`, { headers: { ...authHeaders() } });
      const d = (await r.json()) as Route;
      setRoute(d);
      if (from) routedFrom.current = from;
    } catch {
      setRoute({ ok: false, reason: "error" });
    }
  }, [ride.id]);

  useEffect(() => { loadRoute(null); }, [loadRoute]);

  // ── La carte ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!route || !route.ok || !holder.current || map.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holder.current) return;

      const instance = L.map(holder.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);

      const dot = (color: string, ring: string, size = 22) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:${color};border:3px solid ${ring};box-shadow:0 4px 12px rgba(0,0,0,.35)"></span>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

      L.marker([route.to.lat, route.to.lng], { icon: dot("#101012", "#ffffff"), title: "Client" }).addTo(instance);
      meMarker.current = L.marker([route.from.lat, route.from.lng], { icon: dot("#2563EB", "#ffffff", 18), title: "Moi" }).addTo(instance);

      const pts = route.points.length > 1 ? route.points : [route.from, route.to];
      line.current = L.polyline(pts.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#2563EB", weight: 6, opacity: 0.85 }).addTo(instance);

      instance.fitBounds(line.current.getBounds(), { padding: [30, 30] });
      map.current = instance;
      window.setTimeout(() => instance.invalidateSize(), 120);
    })();

    return () => { cancelled = true; };
  }, [route]);

  // Le tracé se met à jour sans reconstruire la carte : sinon elle sauterait
  // à chaque nouveau point.
  useEffect(() => {
    if (!map.current || !route || !route.ok || !line.current) return;
    const pts = route.points.length > 1 ? route.points : [route.from, route.to];
    line.current.setLatLngs(pts.map((p: Point) => [p.lat, p.lng]));
  }, [route]);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    map.current?.remove();
    map.current = null;
  }, []);

  // ── Démarrer : le téléphone suit, la route se refait ─────────────────────
  function start() {
    if (!navigator.geolocation) return toast.error("Ce téléphone ne partage pas sa position.");
    setRunning(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(point);

        // Le point avance, et la carte le suit.
        if (meMarker.current) meMarker.current.setLatLng([point.lat, point.lng]);
        if (map.current) map.current.panTo([point.lat, point.lng], { animate: true });

        // Recalcul du trajet quand on a vraiment avancé : inutile de demander
        // une route à chaque frémissement du GPS.
        if (!routedFrom.current || metres(routedFrom.current, point) > 120) loadRoute(point);

        // Et le commerçant voit où en est son livreur.
        const now = Date.now();
        if (now - pushed.current > 15000) {
          pushed.current = now;
          fetch("/api/courier/position", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ ...point, agentId: ride.agent_id }),
          }).catch(() => {});
        }
      },
      () => toast.error("Position indisponible. Active la localisation."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    // Prendre la course : la commande porte désormais son nom.
    if (!ride.mine) {
      fetch(`/api/courier/orders/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "take" }),
      }).catch(() => {});
    }
  }

  function stop() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setRunning(false);
  }

  async function deliver() {
    if (!confirm(`Confirmer la remise de la commande ${ride.ref} ?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/courier/orders/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "delivered" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de marquer la livraison");
      toast.success(`Commande ${ride.ref} livrée.`);
      stop();
      onDelivered(ride.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const dest = route && (route.ok ? route.to : route.to);
  const navHref = dest ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving` : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#fff", display: "flex", flexDirection: "column" }}>
      {/* En-tête : ce qu'il faut savoir avant de partir */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--cl-line)", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 16 }}>n° {ride.ref}</strong>
            <span style={{ fontSize: 12, color: "var(--cl-sub)" }}>{ride.items_count} article(s) · {money(ride.total, ride.currency)}</span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 600 }}>
            {ride.customer_name || "Client"}{ride.company ? ` · ${ride.company}` : ""}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--cl-sub)" }}>
            <MapPin className="inline w-3 h-3" /> {ride.address || "Adresse non précisée"}
          </p>
        </div>
        <button onClick={() => { stop(); onClose(); }} aria-label="Fermer"
          style={{ border: "1px solid var(--cl-line)", background: "#fff", borderRadius: 999, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* La carte prend tout ce qui reste : c'est elle qu'on regarde. */}
      <div style={{ position: "relative", flex: 1, minHeight: 240, background: "#E8E8E8" }}>
        <div ref={holder} style={{ position: "absolute", inset: 0 }} />
        {route && !route.ok && (
          <p style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontSize: 13.5, color: "var(--cl-sub)" }}>
            {RAISONS[route.reason] ?? RAISONS.error}
          </p>
        )}
        {!route && (
          <p style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13.5, color: "var(--cl-sub)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Calcul du trajet…
          </p>
        )}
      </div>

      {/* Le bandeau du bas : distance restante et les trois gestes utiles */}
      <div style={{ borderTop: "1px solid var(--cl-line)", padding: "12px 16px 16px", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <strong style={{ fontSize: 15 }}>
              {route?.ok ? `${km(route.distance_m)} · ${mn(route.duration_s)}` : "Trajet indisponible"}
            </strong>
            <div style={{ fontSize: 11.5, color: "var(--cl-sub)" }}>
              {running
                ? me
                  ? "Position suivie — la route se recalcule pendant que tu roules."
                  : "En attente du GPS…"
                : "Démarre la course pour suivre ta position."}
            </div>
          </div>
          {running ? (
            <button onClick={stop}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 999, border: "1px solid var(--cl-line)", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Square className="w-3.5 h-3.5" /> Pause
            </button>
          ) : (
            <button onClick={start}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 999, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Play className="w-3.5 h-3.5" /> Démarrer
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ride.phone && (
            <a href={`tel:${ride.phone}`}
              style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--cl-line)", fontSize: 13, fontWeight: 700, color: "var(--cl-ink)", textDecoration: "none" }}>
              <Phone className="w-3.5 h-3.5" /> Appeler
            </a>
          )}
          {navHref && (
            <a href={navHref} target="_blank" rel="noreferrer"
              style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--cl-line)", fontSize: 13, fontWeight: 700, color: "var(--cl-ink)", textDecoration: "none" }}>
              <Navigation className="w-3.5 h-3.5" /> Guidage vocal
            </a>
          )}
        </div>

        <button onClick={deliver} disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 16px", borderRadius: 12, border: "none", background: "#101012", color: "#C6F24E", fontSize: 14.5, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Marquer comme livrée
        </button>
      </div>
    </div>
  );
}
