"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Suivi des livraisons — l'espace vendeur.
//
// Deux colonnes : à gauche la pile des expéditions, dépliable, avec le fil des
// étapes et le livreur ; à droite la carte, qui montre le trajet et où en est
// le colis. C'est l'écran qu'on ouvre quand un client appelle pour demander
// « c'est où ? ».
//
// Le dessin vit dans components/tracking.tsx : l'écran du livreur est le même,
// aux boutons près.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { authHeaders } from "@/lib/auth-client";
import { MessageCircle, Phone } from "lucide-react";
import {
  Adresse, BlocLivraison, Carte, Ecran, EnTete, GRIS, GRIS_PALE, Ligne, Rien,
  VIOLET, heure, jour, type Etape,
} from "@/components/tracking";

const TrackingMap = dynamic(() => import("@/components/TrackingMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full" style={{ background: "#EDEDF2" }} />,
});

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

export default function SuiviPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [envois, setEnvois] = useState<Envoi[] | null>(null);
  const [total, setTotal] = useState(0);
  const [warning, setWarning] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("");
  const [trajet, setTrajet] = useState<{ lat: number; lng: number }[]>([]);

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
    if (!actif) { setTrajet([]); return; }
    let vivant = true;
    fetch(`/api/orders/${actif.id}/itinerary`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => { if (vivant) setTrajet(d?.ok ? (d.points ?? []) : []); })
      .catch(() => vivant && setTrajet([]));
    return () => { vivant = false; };
  }, [actif]);

  return (
    <Ecran
      aside={
        <>
          <EnTete
            valeur={recherche}
            onChange={setRecherche}
            onSubmit={() => setFiltre(recherche)}
            placeholder="Numéro de commande"
            bouton="Suivre"
            compteur="Total des colis :"
            valeurCompteur={total}
          />

          {warning && (
            <p className="mx-4 mb-3 rounded-[9px] p-3 text-[12.5px]" style={{ background: "#FDF7E7", color: "#8A5A00" }}>
              {warning}
            </p>
          )}

          <div className="flex flex-col gap-3 px-4 pb-5">
            {envois === null ? (
              <p className="text-[13px]" style={{ color: GRIS }}>Chargement…</p>
            ) : liste.length === 0 ? (
              <Rien texte="Aucune expédition." />
            ) : (
              liste.map((s) => (
                <Carte
                  key={s.id}
                  reference={s.ref}
                  deplie={s.id === ouvert}
                  onToggle={() => setOuvert(s.id === ouvert ? null : s.id)}
                >
                  <Ligne label="Commande passée le :" valeur={jour(s.created_at)} />
                  <Ligne label="À livrer à :" valeur={heure(s.scheduled_at ?? s.delivered_at)} />
                  <Ligne label="Nombre d'articles :" valeur={`${s.items_count}×`} />

                  <BlocLivraison
                    status={s.status}
                    vers={s.to}
                    depuis={s.from}
                    etapes={s.timeline}
                    pied={
                      s.courier ? (
                        <div className="flex items-center gap-2.5 px-3 py-2.5">
                          <span
                            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                            style={{ background: "rgba(124,90,248,.14)", color: VIOLET }}
                          >
                            {s.courier.name.trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold" style={{ color: "#101012" }}>{s.courier.name}</span>
                            <span className="block text-[10.5px]" style={{ color: GRIS_PALE }}>Livreur</span>
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
                      ) : null
                    }
                  />

                  {/* Qui paie, et combien : le vendeur en a besoin. */}
                  <div className="mt-2.5 flex items-center justify-between text-[12px]" style={{ color: GRIS }}>
                    <span className="truncate">
                      {s.customer_name || "Client"}{s.company ? ` · ${s.company}` : ""}
                    </span>
                    <strong style={{ color: "#101012" }}>
                      {Number(s.total).toLocaleString("fr-FR")} {s.currency}
                    </strong>
                  </div>
                </Carte>
              ))
            )}
          </div>
        </>
      }
      carte={
        <TrackingMap
          className="h-full w-full"
          points={trajet}
          from={actif?.shop_lat != null && actif?.shop_lng != null ? { lat: actif.shop_lat, lng: actif.shop_lng } : null}
          to={actif?.lat != null && actif?.lng != null ? { lat: actif.lat, lng: actif.lng } : null}
          courier={
            actif?.courier?.lat != null && actif?.courier?.lng != null
              ? { lat: actif.courier.lat, lng: actif.courier.lng }
              : null
          }
        />
      }
    />
  );
}
