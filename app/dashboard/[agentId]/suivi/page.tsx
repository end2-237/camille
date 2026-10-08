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
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bike, Check, ChevronDown, Copy, MapPin, MessageCircle, Package, PackageCheck, Phone, Search, Store, Truck, X } from "lucide-react";
import { heure, jour, type Etape } from "@/components/tracking";
import { Bandeau, Filtres, Pastille, Squelettes, StylesUI, Tuile, Vide, apparait, type Ton } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

const TrackingMap = dynamic(() => import("@/components/TrackingMap"), {
  ssr: false,
  loading: () => <div className="ui-squelette h-full w-full" />,
});

const ETATS: Record<string, { texte: string; ton: Ton }> = {
  nouvelle:      { texte: "À préparer",   ton: "ambre" },
  en_traitement: { texte: "En préparation", ton: "violet" },
  traitee:       { texte: "En préparation", ton: "violet" },
  en_livraison:  { texte: "En route",     ton: "bleu" },
  livree:        { texte: "Livrée",       ton: "vert" },
};
const etatDe = (s: string) => ETATS[s] ?? ETATS.nouvelle;

type Filtre = "toutes" | "route" | "preparer" | "livree";
const DANS: Record<Filtre, (s: string) => boolean> = {
  toutes: () => true,
  route: (s) => s === "en_livraison",
  preparer: (s) => s === "nouvelle" || s === "en_traitement" || s === "traitee",
  livree: (s) => s === "livree",
};

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
  const [vue, setVue] = useState<Filtre>("toutes");
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
    return (envois ?? []).filter((s) => DANS[vue](s.status)).filter((s) => !q ||
      [s.ref, s.customer_name, s.to, s.company, s.phone].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [envois, filtre, vue]);

  const compte = (f: Filtre) => (envois ?? []).filter((s) => DANS[f](s.status)).length;

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
    <div className="py-6 lg:py-8">
      <StylesUI />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Tuile rang={0} icone={Package} titre="Colis" valeur={total} sous="sur la période" />
        <Tuile rang={1} icone={Truck} titre="En route" valeur={compte("route")} fort={compte("route") > 0} sous="avec un livreur" onClick={() => setVue("route")} actif={vue === "route"} />
        <Tuile rang={2} icone={Store} titre="À préparer" valeur={compte("preparer")} sous="en boutique" onClick={() => setVue("preparer")} actif={vue === "preparer"} />
        <Tuile rang={3} icone={PackageCheck} titre="Livrés" valeur={compte("livree")} sous="arrivés chez le client" onClick={() => setVue("livree")} actif={vue === "livree"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── La carte, en tête sur téléphone ───────────────────────────────── */}
        <motion.div {...apparait(2)} className="suivi-carte relative overflow-hidden rounded-[30px] lg:order-2">
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
          <AnimatePresence>
            {actif && (
              <motion.div key={actif.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={RESSORT}
                className="pointer-events-none absolute left-4 top-4 z-[500] flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-4 shadow-lg backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                  <Package className="h-4 w-4" />
                </span>
                <span className="text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>n° {actif.ref}</span>
                <Pastille ton={etatDe(actif.status).ton} point>{etatDe(actif.status).texte}</Pastille>
              </motion.div>
            )}
          </AnimatePresence>
          {!actif && (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[500] rounded-full bg-white/95 px-4 py-2.5 text-center text-[13px] shadow-lg" style={{ color: "var(--cl-ink-soft)" }}>
              Ouvrez une expédition pour voir son trajet.
            </div>
          )}
        </motion.div>

        {/* ── La pile des expéditions ───────────────────────────────────────── */}
        <section className="min-w-0 lg:order-1">
          <form onSubmit={(e) => { e.preventDefault(); setFiltre(recherche); }} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
            <input value={recherche} onChange={(e) => { setRecherche(e.target.value); if (!e.target.value) setFiltre(""); }}
              placeholder="Numéro de commande, client, adresse…" className="ui-champ" style={{ paddingLeft: 42, paddingRight: 44 }} />
            {recherche && (
              <button type="button" aria-label="Effacer" onClick={() => { setRecherche(""); setFiltre(""); }}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full" style={{ color: "var(--cl-ink-faint)" }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          <div className="mt-3">
            <Filtres id="suivi" label="Filtrer les expéditions" valeur={vue} onChange={setVue}
              options={[
                { cle: "toutes", libelle: "Toutes", compte: compte("toutes") },
                { cle: "route", libelle: "En route", compte: compte("route") },
                { cle: "preparer", libelle: "À préparer", compte: compte("preparer") },
                { cle: "livree", libelle: "Livrées", compte: compte("livree") },
              ]} />
          </div>

          {warning && <div className="mt-3"><Bandeau ton="ambre">{warning}</Bandeau></div>}

          <div className="mt-4">
            {envois === null ? (
              <Squelettes n={4} hauteur={76} />
            ) : liste.length === 0 ? (
              <Vide doodle="float" titre={filtre ? "Aucune expédition ne correspond." : "Aucune expédition ici."}
                texte="Les commandes à livrer apparaissent ici dès qu'elles sont confirmées." />
            ) : (
              <motion.div layout className="space-y-3">
                {liste.map((s, i) => (
                  <Expedition key={s.id} envoi={s} rang={i} deplie={s.id === ouvert} onToggle={() => setOuvert(s.id === ouvert ? null : s.id)} />
                ))}
              </motion.div>
            )}
          </div>
        </section>
      </div>

      <style jsx global>{`
        .suivi-carte { height: 42vh; min-height: 280px; background: #EDEDF2; box-shadow: inset 0 0 0 1px var(--cl-line-soft); }
        @media (min-width: 1024px) { .suivi-carte { position: sticky; top: 96px; height: calc(100dvh - 130px); min-height: 460px; } }
      `}</style>
    </div>
  );
}

// ── Une expédition ──────────────────────────────────────────────────────────

function Expedition({ envoi: s, deplie, onToggle, rang }: { envoi: Envoi; deplie: boolean; onToggle: () => void; rang: number }) {
  const [copie, setCopie] = useState(false);
  const e = etatDe(s.status);
  return (
    <motion.article layout {...apparait(rang)} className="ui-carte overflow-hidden rounded-[26px]"
      style={deplie ? { borderColor: "var(--cl-accent)", boxShadow: "0 16px 36px rgba(124,90,248,0.14)" } : undefined}>
      <button onClick={onToggle} aria-expanded={deplie} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
          {s.status === "en_livraison" ? <Bike className="h-5 w-5" /> : <Package className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold" style={{ color: "var(--cl-ink)" }}>n° {s.ref}</span>
            <span role="button" tabIndex={0} aria-label="Copier le numéro"
              onClick={(ev) => { ev.stopPropagation(); navigator.clipboard?.writeText(s.ref); setCopie(true); setTimeout(() => setCopie(false), 1600); }}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F4F2F7]" style={{ color: "var(--cl-ink-faint)" }}>
              {copie ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </span>
          </span>
          <span className="block truncate text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
            {s.customer_name || "Client"} · {jour(s.created_at)}
          </span>
        </span>
        <Pastille ton={e.ton} point>{e.texte}</Pastille>
        <motion.span animate={{ rotate: deplie ? 180 : 0 }} transition={RESSORT} style={{ color: "var(--cl-ink-faint)" }}>
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {deplie && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={RESSORT} className="overflow-hidden">
            <div className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Passée le", jour(s.created_at)],
                  ["À livrer à", heure(s.scheduled_at ?? s.delivered_at)],
                  ["Articles", `${s.items_count}×`],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-[16px] px-3 py-2.5" style={{ background: "#FAF9FC" }}>
                    <p className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>{l}</p>
                    <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{v}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-start gap-2 rounded-[16px] px-3 py-2.5" style={{ background: "#FAF9FC" }}>
                  <Store className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--cl-ink-faint)" }} />
                  <span className="min-w-0"><span className="block text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>Depuis</span>
                    <span className="block truncate text-[13px]" style={{ color: "var(--cl-ink)" }} title={s.from ?? ""}>{s.from || "—"}</span></span>
                </div>
                <div className="flex items-start gap-2 rounded-[16px] px-3 py-2.5" style={{ background: "#FAF9FC" }}>
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
                  <span className="min-w-0"><span className="block text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>Vers</span>
                    <span className="block truncate text-[13px]" style={{ color: "var(--cl-ink)" }} title={s.to ?? ""}>{s.to || "—"}</span></span>
                </div>
              </div>

              {s.timeline.length > 0 && (
                <div className="rounded-[18px] px-3 pt-3" style={{ boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}>
                  {s.timeline.map((et: Etape, i: number) => {
                    const dernier = i === s.timeline.length - 1;
                    return (
                      <div key={`${et.kind}-${i}`} className="flex gap-3">
                        <span className="w-10 flex-shrink-0 pt-1 text-right text-[11.5px] tabular-nums" style={{ color: "var(--cl-ink-faint)" }}>{heure(et.at)}</span>
                        <span className="flex flex-col items-center">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full"
                            style={{ background: dernier ? "var(--cl-accent)" : "var(--cl-accent-soft)", color: dernier ? "#fff" : "var(--cl-accent-deep)" }}>
                            {dernier ? <Package className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                          </span>
                          {!dernier && <span className="my-1 w-[2px] flex-1 rounded-full" style={{ background: "#E4DCFD" }} />}
                        </span>
                        <span className="flex-1 pb-3.5 pt-0.5 text-[13px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>{et.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {s.courier && (
                <div className="flex items-center gap-3 rounded-[18px] p-3" style={{ background: "#F4F0FF" }}>
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: "var(--cl-accent)" }}>
                    {s.courier.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{s.courier.name}</span>
                    <span className="block text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Livreur</span>
                  </span>
                  {s.courier.phone && (
                    <>
                      <a href={`https://wa.me/${s.courier.phone}`} target="_blank" rel="noreferrer" aria-label="Écrire au livreur"
                        className="ui-rond flex h-10 w-10 items-center justify-center rounded-full"><MessageCircle className="h-4 w-4" /></a>
                      <a href={`tel:${s.courier.phone}`} aria-label="Appeler le livreur"
                        className="ui-rond flex h-10 w-10 items-center justify-center rounded-full"><Phone className="h-4 w-4" /></a>
                    </>
                  )}
                </div>
              )}

              {/* Qui paie, et combien : le vendeur en a besoin. */}
              <div className="flex items-center justify-between rounded-[16px] px-3 py-2.5" style={{ background: "#FAF9FC" }}>
                <span className="truncate text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>
                  {s.customer_name || "Client"}{s.company ? ` · ${s.company}` : ""}
                </span>
                <strong className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--cl-ink)" }}>
                  {Number(s.total).toLocaleString("fr-FR")} {s.currency === "XAF" ? "FCFA" : s.currency}
                </strong>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
