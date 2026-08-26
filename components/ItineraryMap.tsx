"use client";

// ─────────────────────────────────────────────────────────────────────────────
// L'itinéraire, dans l'application.
//
// Le bouton envoyait le vendeur sur Google Maps : il quittait Camille, perdait
// la commande de vue, et revenait à la main. Le trajet s'affiche maintenant
// ici — tracé, distance, durée — calculé par OSRM côté serveur.
//
// Le lien vers une application de navigation reste offert en second : sur la
// route, un livreur a besoin d'une voix qui lui dise où tourner.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Loader2, Navigation, X } from "lucide-react";

type Point = { lat: number; lng: number };

type Itinerary =
  | { ok: true; distance_m: number; duration_s: number; from: Point; to: Point; points: Point[] }
  | { ok: false; reason: string; to?: Point };

const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
const mn = (s: number) => (s < 60 ? "moins d'une minute" : `${Math.round(s / 60)} min`);

const REASONS: Record<string, string> = {
  no_customer_position: "Ce client n'a pas partagé sa position : seule l'adresse écrite est connue.",
  no_shop_position: "La position de la boutique n'est pas renseignée — complète-la dans Config.",
  router_unavailable: "Le calculateur d'itinéraire ne répond pas. Réessaie dans un instant.",
  no_route: "Aucune route trouvée entre la boutique et ce point.",
  error: "Le trajet n'a pas pu être calculé.",
};

export default function ItineraryMap({
  orderId,
  reference,
  address,
  onClose,
}: {
  orderId: string;
  reference?: string;
  address?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Itinerary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { authHeaders } = await import("@/lib/auth-client");
        const r = await fetch(`/api/orders/${orderId}/itinerary`, { headers: { ...authHeaders() } });
        const d = (await r.json()) as Itinerary;
        if (!alive) return;
        if (!r.ok) throw new Error("Itinéraire indisponible");
        setData(d);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (!data || !data.ok || !holder.current || map.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holder.current) return;

      const instance = L.map(holder.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("/api/tiles/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);

      const dot = (color: string, ring: string) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:22px;height:22px;border-radius:999px;background:${color};border:3px solid ${ring};box-shadow:0 4px 12px rgba(0,0,0,.35)"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

      L.marker([data.from.lat, data.from.lng], { icon: dot("#C6F24E", "#101012"), title: "Boutique" }).addTo(instance);
      L.marker([data.to.lat, data.to.lng], { icon: dot("#101012", "#ffffff"), title: "Client" }).addTo(instance);

      const line = data.points.length > 1 ? data.points : [data.from, data.to];
      const path = L.polyline(
        line.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#101012", weight: 5, opacity: 0.85 },
      ).addTo(instance);

      instance.fitBounds(path.getBounds(), { padding: [28, 28] });
      map.current = instance;
      window.setTimeout(() => instance.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  const to = data && (data.ok ? data.to : data.to);
  const mapsHref = to
    ? `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`
    : address
      ? `https://www.google.com/maps/search/${encodeURIComponent(address)}`
      : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <button
        onClick={onClose}
        aria-label="Fermer"
        style={{ position: "absolute", inset: 0, background: "rgba(16,16,18,.55)", border: "none", cursor: "pointer" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Itinéraire de livraison"
        style={{ position: "relative", width: "100%", maxWidth: 720, background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.3)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--cl-line)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
              Itinéraire {reference ? `— commande ${reference}` : ""}
            </h2>
            {address && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--cl-sub)" }}>{address}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ display: "flex", height: 34, width: 34, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "1px solid var(--cl-line)", background: "#fff", cursor: "pointer" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!data && !error && (
          <p style={{ display: "flex", alignItems: "center", gap: 8, padding: 32, fontSize: 13.5, color: "var(--cl-sub)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Calcul du trajet…
          </p>
        )}

        {error && <p style={{ padding: 24, fontSize: 13.5, color: "#c0392b" }}>{error}</p>}

        {data && !data.ok && (
          <p style={{ padding: 24, fontSize: 13.5, color: "var(--cl-sub)" }}>
            {REASONS[data.reason] ?? REASONS.error}
          </p>
        )}

        {data && data.ok && (
          <>
            <div ref={holder} style={{ height: 360, width: "100%", background: "#E8E8E8" }} />
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                {km(data.distance_m)} · {mn(data.duration_s)} de route
                <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--cl-sub)" }}>
                  Estimation OSRM, hors circulation.
                </span>
              </p>
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, border: "1px solid var(--cl-line)", fontSize: 12.5, fontWeight: 600, color: "var(--cl-ink)", textDecoration: "none" }}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Navigation guidée
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
