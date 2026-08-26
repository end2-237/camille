"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La carte du suivi : le trajet, et où en est le colis.
//
// Le tracé est coupé à la position du livreur : ce qui est parcouru passe en
// violet clair, ce qui reste en violet plein. C'est ce qui fait qu'on lit la
// course d'un coup d'œil au lieu de chercher le point sur une ligne uniforme.
//
// Fond de carte CARTO (données OpenStreetMap) : le rendu clair du modèle, sans
// clé d'API. tile.openstreetmap.org refuse les clients applicatifs.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Point = { lat: number; lng: number };

const VIOLET = "#7C5AF8";
const VIOLET_PALE = "#C9BAFB";

/** Le point du tracé le plus proche du livreur : c'est là qu'on coupe. */
function couper(points: Point[], at: Point) {
  let best = 0, bestD = Infinity;
  points.forEach((p, i) => {
    const d = (p.lat - at.lat) ** 2 + (p.lng - at.lng) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

export default function TrackingMap({
  from, to, courier, points, className = "",
}: {
  from: Point | null;
  to: Point | null;
  courier: Point | null;
  points: Point[];
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const couche = useRef<any>(null);
  const [pret, setPret] = useState(false);

  // La carte se crée une fois ; seuls ses calques changent ensuite.
  useEffect(() => {
    let annule = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (annule || !holder.current || map.current) return;

      const instance = L.map(holder.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView([4.05, 9.7], 13);

      L.tileLayer("https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
      }).addTo(instance);

      couche.current = L.layerGroup().addTo(instance);
      map.current = instance;
      setPret(true);
      window.setTimeout(() => instance.invalidateSize(), 120);
    })();

    return () => {
      annule = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pret || !map.current || !couche.current) return;
    let annule = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (annule) return;
      const groupe = couche.current;
      groupe.clearLayers();

      const trace = points.length > 1 ? points : from && to ? [from, to] : [];

      if (trace.length > 1) {
        const coupe = courier ? couper(trace, courier) : 0;
        const parcouru = trace.slice(0, Math.max(coupe + 1, 1));
        const restant = trace.slice(Math.max(coupe, 0));

        if (parcouru.length > 1) {
          L.polyline(parcouru.map((p) => [p.lat, p.lng] as [number, number]), {
            color: VIOLET_PALE, weight: 5, opacity: 1, lineCap: "round", lineJoin: "round",
          }).addTo(groupe);
        }
        L.polyline(restant.map((p) => [p.lat, p.lng] as [number, number]), {
          color: VIOLET, weight: 5, opacity: 1, lineCap: "round", lineJoin: "round",
        }).addTo(groupe);
      }

      // Départ : la pastille pleine, marqueur classique du point de collecte.
      if (from) {
        L.marker([from.lat, from.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:${VIOLET};box-shadow:0 6px 16px rgba(124,90,248,.45)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>
            </span>`,
            iconSize: [34, 34], iconAnchor: [17, 17],
          }),
        }).addTo(groupe);
      }

      // Arrivée : l'anneau creux, qui dit « pas encore atteint ».
      if (to) {
        L.marker([to.lat, to.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:block;width:18px;height:18px;border-radius:999px;background:#fff;border:3px solid ${VIOLET};box-shadow:0 2px 8px rgba(0,0,0,.18)"></span>`,
            iconSize: [18, 18], iconAnchor: [9, 9],
          }),
        }).addTo(groupe);
      }

      // Le livreur : la pastille en mouvement, dans son halo.
      if (courier) {
        L.marker([courier.lat, courier.lng], {
          zIndexOffset: 500,
          icon: L.divIcon({
            className: "",
            html: `<span style="display:flex;align-items:center;justify-content:center;width:58px;height:58px;border-radius:999px;background:rgba(124,90,248,.18)">
              <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;background:${VIOLET};box-shadow:0 6px 16px rgba(124,90,248,.5)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
              </span></span>`,
            iconSize: [58, 58], iconAnchor: [29, 29],
          }),
        }).addTo(groupe);
      }

      const tout = [...trace, ...(from ? [from] : []), ...(to ? [to] : []), ...(courier ? [courier] : [])];
      if (tout.length) {
        map.current.fitBounds(tout.map((p) => [p.lat, p.lng]), { padding: [70, 70], maxZoom: 16 });
      }
    })();

    return () => { annule = true; };
  }, [pret, points, from, to, courier]);

  const bouton =
    "flex h-[34px] w-[34px] items-center justify-center bg-white text-[#5B5766] transition hover:text-[#101012]";

  return (
    // « isolate » : les boutons de la carte se rangent dans ce cadre, et non
    // par-dessus la barre du haut ou le tiroir de navigation.
    <div className={`relative isolate overflow-hidden ${className}`}>
      <div ref={holder} className="absolute inset-0" style={{ background: "#EDEDF2" }} />

      {/* Les commandes de la carte, posées comme dans le modèle : plein écran
          en haut à droite, zoom et recentrage en bas à droite. */}
      <button
        onClick={() => holder.current?.parentElement?.requestFullscreen?.().catch(() => {})}
        aria-label="Plein écran"
        className={`${bouton} absolute right-4 top-4 z-[500] rounded-[9px] shadow-[0_2px_10px_rgba(16,16,18,.14)]`}
      >
        <Maximize2 className="h-4 w-4" />
      </button>

      <div className="absolute bottom-4 right-4 z-[500] flex flex-col items-end gap-2">
        <button
          onClick={() => {
            navigator.geolocation?.getCurrentPosition((p) =>
              map.current?.setView([p.coords.latitude, p.coords.longitude], 15));
          }}
          aria-label="Ma position"
          className={`${bouton} rounded-[9px] shadow-[0_2px_10px_rgba(16,16,18,.14)]`}
          style={{ color: VIOLET }}
        >
          <Crosshair className="h-4 w-4" />
        </button>
        <div className="overflow-hidden rounded-[9px] shadow-[0_2px_10px_rgba(16,16,18,.14)]">
          <button onClick={() => map.current?.zoomIn()} aria-label="Zoomer" className={bouton}>
            <Plus className="h-4 w-4" />
          </button>
          <div className="h-px w-full bg-[#EDEDF2]" />
          <button onClick={() => map.current?.zoomOut()} aria-label="Dézoomer" className={bouton}>
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
