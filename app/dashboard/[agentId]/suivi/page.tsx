"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Suivi des livraisons — l'espace vendeur.
//
// Deux colonnes, comme le modèle : à gauche la pile des expéditions, dépliable,
// avec le fil des étapes et le livreur ; à droite la carte, qui montre le
// trajet et où en est le colis. C'est l'écran qu'on ouvre quand un client
// appelle pour demander « c'est où ? ».
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { authHeaders } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  ArrowUp, Check, ChevronDown, ChevronUp, Copy, MessageCircle, Package,
  Phone, Search, Truck,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TrackingMap = dynamic(() => import("@/components/TrackingMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full" style={{ background: "#EDEDF2" }} />,
});

type Etape = { at: string; label: string; kind: string };
type Envoi = {
  id: string; ref: string; status: string;
  created_at: string; scheduled_at: string | null; delivered_at: string | null;
  items_count: number; total: number; currency: string;
  customer_name: string | null; phone: string; company: string | null;
  to: string | null; from: string | null;
  lat: number | null; lng: number | null; shop_lat: number | null; shop_lng: number | null;
  timeline: Etape[];
  courier: { name: string; phone: string | null; lat: number | null; lng: number | null; last_seen_at: string | null } | null;
};

const VIOLET = "#7C5AF8";

const heure = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
const jour = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "—";

/** L'état de l'expédition, dit en deux mots et coloré comme tel. */
const ETAT: Record<string, { texte: string; fond: string; encre: string }> = {
  nouvelle:      { texte: "À TRAITER",   fond: "#F3F7E4", encre: "#4A6B00" },
  en_traitement: { texte: "EN CUISINE",  fond: "#FDF1DC", encre: "#8A5A00" },
  traitee:       { texte: "EN CUISINE",  fond: "#FDF1DC", encre: "#8A5A00" },
  en_livraison:  { texte: "EN COURS",    fond: "rgba(124,90,248,.12)", encre: VIOLET },
  livree:        { texte: "LIVRÉE",      fond: "#E4F8EC", encre: "#0e6b45" },
};
const etat = (s: string) => ETAT[s] ?? ETAT.nouvelle;

export default function SuiviPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [envois, setEnvois] = useState<Envoi[] | null>(null);
  const [total, setTotal] = useState(0);
  const [warning, setWarning] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("");
  const [copie, setCopie] = useState<string | null>(null);
  const [trajet, setTrajet] = useState<{ points: { lat: number; lng: number }[] } | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/${agentId}/tracking`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setWarning(d.error || "");
      setEnvois(d.shipments ?? []);
      setTotal(d.total ?? 0);
      // La première expédition en cours s'ouvre d'elle-même : c'est celle
      // qu'on vient regarder.
      setOuvert((o) => o ?? (d.shipments ?? []).find((s: Envoi) => s.status === "en_livraison")?.id ?? null);
    } catch (e) {
      setWarning((e as Error).message);
      setEnvois([]);
    }
  }, [agentId]);

  useEffect(() => { charger(); }, [charger]);

  // Une course avance pendant qu'on la regarde.
  useEffect(() => {
    const t = setInterval(charger, 30_000);
    return () => clearInterval(t);
  }, [charger]);

  const liste = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (!q) return envois ?? [];
    return (envois ?? []).filter((s) =>
      [s.ref, s.customer_name, s.to, s.company, s.phone].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [envois, filtre]);

  const actif = useMemo(() => (envois ?? []).find((s) => s.id === ouvert) ?? null, [envois, ouvert]);

  // Le tracé vient d'OSRM, par le même chemin que l'itinéraire du livreur.
  useEffect(() => {
    if (!actif) { setTrajet(null); return; }
    let vivant = true;
    fetch(`/api/orders/${actif.id}/itinerary`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => { if (vivant) setTrajet(d?.ok ? { points: d.points ?? [] } : { points: [] }); })
      .catch(() => vivant && setTrajet({ points: [] }));
    return () => { vivant = false; };
  }, [actif]);

  function copier(ref: string) {
    navigator.clipboard?.writeText(ref);
    setCopie(ref);
    setTimeout(() => setCopie(null), 1600);
  }

  return (
    <div className="flex" style={{ height: "calc(100vh - 52px)", background: "#fff" }}>
      {/* ── Colonne des expéditions ──────────────────────────────────────── */}
      <aside
        className="flex w-[320px] shrink-0 flex-col overflow-y-auto"
        style={{ borderRight: "1px solid #EDEDF2" }}
      >
        <div className="px-4 pb-3 pt-4">
          <form
            onSubmit={(e) => { e.preventDefault(); setFiltre(recherche); }}
            className="flex items-center gap-2"
          >
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Numéro de commande"
              className="h-[38px] min-w-0 flex-1 rounded-[9px] px-3 text-[13px] outline-none"
              style={{ border: "1px solid #E6E6EC", color: "#101012" }}
            />
            <button
              type="submit"
              className="flex h-[38px] items-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-semibold text-white"
              style={{ background: VIOLET }}
            >
              Suivre <Search className="h-[15px] w-[15px]" />
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px]" style={{ color: "#8A8790" }}>Total des colis :</span>
            <strong className="text-[13px]" style={{ color: "#101012" }}>{total}</strong>
          </div>
        </div>

        {warning && (
          <p className="mx-4 mb-3 rounded-[9px] p-3 text-[12.5px]" style={{ background: "#FDF7E7", color: "#8A5A00" }}>
            {warning}
          </p>
        )}

        <div className="flex flex-col gap-3 px-4 pb-5">
          {envois === null ? (
            <p className="text-[13px]" style={{ color: "#8A8790" }}>Chargement…</p>
          ) : liste.length === 0 ? (
            <p className="rounded-[10px] p-6 text-center text-[13px]"
              style={{ border: "1px dashed #E6E6EC", color: "#8A8790" }}>
              Aucune expédition.
            </p>
          ) : (
            liste.map((s) => {
              const deplie = s.id === ouvert;
              return (
                <article
                  key={s.id}
                  className="rounded-[10px] bg-white"
                  style={{
                    border: `1px solid ${deplie ? "rgba(124,90,248,.55)" : "#EDEDF2"}`,
                    boxShadow: deplie ? "0 8px 24px rgba(124,90,248,.14)" : "none",
                  }}
                >
                  {/* En-tête de la carte */}
                  <button
                    onClick={() => setOuvert(deplie ? null : s.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px]"
                      style={{ background: "#F4F4F6" }}
                    >
                      <Package className="h-[17px] w-[17px]" style={{ color: "#5B5766" }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10.5px]" style={{ color: "#9A97A0" }}>Numéro de commande</span>
                      <span className="block truncate text-[13px] font-bold" style={{ color: "#101012" }}>{s.ref}</span>
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); copier(s.ref); }}
                      className="shrink-0 p-1"
                      style={{ color: "#9A97A0" }}
                      aria-label="Copier le numéro"
                    >
                      {copie === s.ref ? <Check className="h-[15px] w-[15px]" /> : <Copy className="h-[15px] w-[15px]" />}
                    </span>
                    {deplie
                      ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "#9A97A0" }} />
                      : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#9A97A0" }} />}
                  </button>

                  {deplie && (
                    <div className="px-3 pb-3">
                      <Ligne label="Commande passée le :" valeur={jour(s.created_at)} />
                      <Ligne label="À livrer à :" valeur={heure(s.scheduled_at ?? s.delivered_at)} />
                      <Ligne label="Nombre d'articles :" valeur={`${s.items_count}×`} />

                      {/* Le bloc de livraison, encadré comme dans le modèle */}
                      <div className="mt-3 rounded-[10px]" style={{ border: "1px solid #EDEDF2" }}>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <Truck className="h-[17px] w-[17px]" style={{ color: "#101012" }} />
                          <strong className="flex-1 text-[13px]" style={{ color: "#101012" }}>Informations de livraison</strong>
                          <span
                            className="rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-[.4px]"
                            style={{ background: etat(s.status).fond, color: etat(s.status).encre }}
                          >
                            {etat(s.status).texte}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                          <Adresse label="Vers" valeur={s.to} />
                          <Adresse label="Depuis" valeur={s.from} />
                        </div>

                        {/* Le fil des étapes */}
                        <div className="px-3 pb-1">
                          {s.timeline.map((e, i) => {
                            const dernier = i === s.timeline.length - 1;
                            return (
                              <div key={`${e.kind}-${i}`} className="flex gap-3">
                                <span className="w-[34px] shrink-0 pt-[3px] text-right text-[10.5px]" style={{ color: "#9A97A0" }}>
                                  {heure(e.at)}
                                </span>
                                <span className="flex flex-col items-center">
                                  <span
                                    className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white"
                                    style={{ border: `2px solid ${VIOLET}` }}
                                  >
                                    {dernier
                                      ? <Package className="h-[10px] w-[10px]" style={{ color: VIOLET }} />
                                      : <ArrowUp className="h-[11px] w-[11px]" style={{ color: VIOLET }} />}
                                  </span>
                                  {!dernier && <span className="w-[2px] flex-1" style={{ background: "#E4DCFD" }} />}
                                </span>
                                <span className="flex-1 pb-3.5 text-[12px] leading-[1.35]" style={{ color: "#3B3946" }}>
                                  {e.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Le livreur, joignable en un geste */}
                        {s.courier && (
                          <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderTop: "1px solid #EDEDF2" }}>
                            <span
                              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                              style={{ background: "rgba(124,90,248,.14)", color: VIOLET }}
                            >
                              {s.courier.name.trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-bold" style={{ color: "#101012" }}>{s.courier.name}</span>
                              <span className="block text-[10.5px]" style={{ color: "#9A97A0" }}>Livreur</span>
                            </span>
                            {s.courier.phone && (
                              <>
                                <a href={`https://wa.me/${s.courier.phone}`} target="_blank" rel="noreferrer"
                                  aria-label="Écrire au livreur"
                                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                                  style={{ background: "#F4F4F6", color: "#5B5766" }}>
                                  <MessageCircle className="h-[14px] w-[14px]" />
                                </a>
                                <a href={`tel:${s.courier.phone}`} aria-label="Appeler le livreur"
                                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                                  style={{ background: "#F4F4F6", color: "#5B5766" }}>
                                  <Phone className="h-[14px] w-[14px]" />
                                </a>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Ce que le client paie, et qui il est : le vendeur en a
                          besoin, le modèle ne l'avait pas. */}
                      <div className="mt-2.5 flex items-center justify-between text-[12px]" style={{ color: "#8A8790" }}>
                        <span className="truncate">
                          {s.customer_name || "Client"}{s.company ? ` · ${s.company}` : ""}
                        </span>
                        <strong style={{ color: "#101012" }}>
                          {Number(s.total).toLocaleString("fr-FR")} {s.currency}
                        </strong>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </aside>

      {/* ── La carte ─────────────────────────────────────────────────────── */}
      <TrackingMap
        className="flex-1"
        points={trajet?.points ?? []}
        from={actif?.shop_lat != null && actif?.shop_lng != null ? { lat: actif.shop_lat, lng: actif.shop_lng } : null}
        to={actif?.lat != null && actif?.lng != null ? { lat: actif.lat, lng: actif.lng } : null}
        courier={
          actif?.courier?.lat != null && actif?.courier?.lng != null
            ? { lat: actif.courier.lat, lng: actif.courier.lng }
            : null
        }
      />
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between py-[3.5px]">
      <span className="text-[12.5px]" style={{ color: "#8A8790" }}>{label}</span>
      <strong className="text-[12.5px]" style={{ color: "#101012" }}>{valeur}</strong>
    </div>
  );
}

function Adresse({ label, valeur }: { label: string; valeur: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px]" style={{ color: "#9A97A0" }}>{label}</div>
      <div className="truncate text-[12px]" style={{ color: "#101012" }} title={valeur ?? ""}>
        {valeur || "—"}
      </div>
    </div>
  );
}
