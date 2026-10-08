// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/orders/page.tsx
// Gestion des commandes issues du flux WhatsApp : suivi, statut, localisation.
// Mêmes actions que l'app mobile — répondre, marquer traitée, annuler.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useAgentCourantOptionnel } from "@/components/dashboard/coquille/AgentCourant";
import { useEffect, useState, useCallback, useMemo } from "react";
import { authHeaders } from "@/lib/auth-client";
import dynamic from "next/dynamic";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bike, CalendarClock, Building2, ChevronRight, CreditCard, FileCheck2, Inbox, MapPin, MessageCircle, Navigation,
  PackageCheck, RefreshCw, Timer, Wallet, X, Check, CircleDot,
} from "lucide-react";
import OrderDetail, { MapPreview } from "@/components/OrderDetail";
import {
  Bandeau, Bouton, BoutonRond, Filtres, LienBouton, Pastille, Squelettes, StylesUI, Tuile, Vide, apparait, type Ton,
} from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

// La carte ne se charge que si le vendeur ouvre un itinéraire.
const ItineraryMap = dynamic(() => import("@/components/ItineraryMap"), { ssr: false });

type Item = { name: string; variant?: string; qty?: number; price?: number; currency?: string; image?: string };
type Order = {
  id: string; ref: string; agent_id: string; status: string;
  items: Item[] | string; total: number; currency: string; note?: string | null;
  customer_name?: string | null; contact_phone?: string | null;
  address?: string | null; place_label?: string | null;
  lat?: number | null; lng?: number | null;
  processing_at?: string | null; dispatched_at?: string | null; delivered_at?: string | null;
  scheduled_at?: string | null; delivery_fee?: number | null; source?: string | null;
  payment_method?: string | null; fulfillment?: string | null; promo_code?: string | null;
  company_code?: string | null; company_name?: string | null;
  doc_number?: string | null; doc_url?: string | null;
  shop_lat?: number | null; shop_lng?: number | null;
  created_at: string;
};
type Agent = { id: string; identity?: { name?: string } };

// Cycle de vie : à traiter → en traitement → (en livraison) → livrée.
// "traitee" est l'ancien statut des commandes créées avant le suivi ; on
// l'affiche comme "en traitement".
const ST: Record<string, { label: string; ton: Ton }> = {
  nouvelle:      { label: "À traiter",     ton: "ambre" },
  en_traitement: { label: "En traitement", ton: "violet" },
  traitee:       { label: "En traitement", ton: "violet" },
  en_livraison:  { label: "En livraison",  ton: "bleu" },
  livree:        { label: "Livrée",        ton: "vert" },
  annulee:       { label: "Annulée",       ton: "rouge" },
};
const stOf = (s?: string) => ST[s || "nouvelle"] || ST.nouvelle;

type Onglet = "nouvelle" | "encours" | "livree" | "annulee";
const TABS: { key: Onglet; label: string; match: (s?: string) => boolean }[] = [
  { key: "nouvelle", label: "À traiter", match: (s) => !s || s === "nouvelle" },
  { key: "encours",  label: "En cours",  match: (s) => s === "en_traitement" || s === "traitee" || s === "en_livraison" },
  { key: "livree",   label: "Livrées",   match: (s) => s === "livree" },
  { key: "annulee",  label: "Annulées",  match: (s) => s === "annulee" },
];

// WhatsApp adresse parfois les contacts par LID : un identifiant interne, pas
// un numéro. Les LID observés font 15 chiffres ou plus ; aucun numéro mobile
// réel n'atteint cette longueur. Un lien wa.me construit dessus est mort.
const isRealPhone = (p: string) => /^\d{8,14}$/.test(p);

function money(n: number, cur?: string) {
  const c = cur || "XAF";
  return `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} ${c === "XAF" ? "FCFA" : c}`;
}
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [tab, setTab] = useState("nouvelle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [diag, setDiag] = useState<{ ready: boolean; checks: { ok: boolean; label: string; detail?: string; fix?: string }[] } | null>(null);
  // La commande ouverte en fiche détaillée.
  const [detail, setDetail] = useState<Order | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/orders${agentId ? `?agentId=${agentId}` : ""}`, { headers: { ...authHeaders() } });
      const d = await r.json();
      if (d.error) setErr(d.error);
      setOrders(Array.isArray(d.orders) ? d.orders : []);
    } catch (e) {
      setErr((e as Error).message); setOrders([]);
    } finally { setBusy(false); }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  // Le bouton flottant de la coquille : « cette page, pour cet agent ».
  const coquille = useAgentCourantOptionnel();
  useEffect(() => { if (coquille?.bascule) setAgentId(coquille.bascule.id); }, [coquille?.bascule]);
  // À l'arrivée, la page montre l'agent annoncé dans le titre ; le sélecteur
  // de la page permet toujours de revenir à « tous les agents ».
  const agentCoquille = coquille?.agent?.id;
  const [suitCoquille, setSuitCoquille] = useState(true);
  useEffect(() => {
    if (suitCoquille && agentCoquille) { setAgentId(agentCoquille); setSuitCoquille(false); }
  }, [agentCoquille, suitCoquille]);

  useEffect(() => {
    fetch("/api/agents", { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => setAgents(Array.isArray(d.agents) ? d.agents : []))
      .catch(() => {});
  }, []);

  // Les photos des articles, retrouvées par nom dans le catalogue.
  //
  // Les commandes passées avant que l'image soit stockée dans la ligne n'en
  // ont pas, et le vendeur voyait une vignette vide — alors que la photo
  // existe dans son catalogue. Elle n'est pas décorative : c'est ce qui permet
  // de reconnaître l'article d'un coup d'œil au moment de le préparer.
  //
  // La clé inclut l'agent : deux commerçants peuvent vendre un article du même
  // nom, et montrer la photo du voisin serait pire que pas de photo.
  useEffect(() => {
    if (!orders?.length) return;
    const ids = [...new Set(orders.map((o) => o.agent_id).filter(Boolean))];
    let vivant = true;
    Promise.all(
      ids.map((id) =>
        fetch(`/api/agents/${id}/products`, { headers: { ...authHeaders() } })
          .then((r) => r.json())
          .then((d) => ({ id, produits: (d?.products ?? []) as { name?: string; image_url?: string }[] }))
          .catch(() => ({ id, produits: [] as { name?: string; image_url?: string }[] }))
      )
    ).then((lots) => {
      if (!vivant) return;
      const m: Record<string, string> = {};
      for (const { id, produits } of lots) {
        for (const p of produits) {
          if (p?.name && p.image_url) m[`${id}|${String(p.name).toLowerCase()}`] = p.image_url;
        }
      }
      setPhotos(m);
    });
    return () => { vivant = false; };
  }, [orders]);

  async function change(o: Order, status: string) {
    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      const d = await r.json().catch(() => ({}));
      const fresh = d?.order || { ...o, status };
      setOrders((p) => (p || []).map((x) => (x.id === o.id ? { ...x, ...fresh } : x)));
    } catch (e) { setErr((e as Error).message); }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    TABS.forEach((t) => { c[t.key] = (orders || []).filter((o) => t.match(o.status)).length; });
    return c;
  }, [orders]);

  const list = (orders || []).filter((o) => (TABS.find((t) => t.key === tab) || TABS[0]).match(o.status));
  const caTotal = (orders || [])
    .filter((o) => o.status === "livree")
    .reduce((s, o) => s + Number(o.total || 0), 0);

  const livrees = (orders || []).filter((o) => o.status === "livree");
  const devise = (orders || [])[0]?.currency;
  const panier = livrees.length ? caTotal / livrees.length : 0;

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />

      {/* ── Les chiffres : chaque tuile ouvre son onglet ───────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Tuile rang={0} icone={Inbox} titre="À traiter" valeur={counts.nouvelle ?? 0} fort={(counts.nouvelle ?? 0) > 0}
          sous={(counts.nouvelle ?? 0) > 0 ? "attendent votre confirmation" : "rien en attente"} onClick={() => setTab("nouvelle")} actif={tab === "nouvelle"} />
        <Tuile rang={1} icone={Timer} titre="En cours" valeur={counts.encours ?? 0} sous="en préparation ou en route" onClick={() => setTab("encours")} actif={tab === "encours"} />
        <Tuile rang={2} icone={PackageCheck} titre="Livrées" valeur={counts.livree ?? 0} sous={money(caTotal, devise)} onClick={() => setTab("livree")} actif={tab === "livree"} />
        <Tuile rang={3} icone={Wallet} titre="Panier moyen" valeur={livrees.length ? money(panier, devise).replace(/\s(FCFA|XAF)$/, "") : "—"} sous={livrees.length ? "FCFA par commande livrée" : "aucune livraison encore"} />
      </div>

      {/* ── La barre d'outils ─────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Filtres id="commandes" label="Filtrer les commandes" valeur={tab} onChange={setTab}
          options={TABS.map((t) => ({ cle: t.key, libelle: t.label, compte: counts[t.key] ?? 0, alerte: t.key === "nouvelle" }))} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Agent</span>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
              className="h-10 cursor-pointer appearance-none rounded-full bg-white py-0 pl-4 pr-9 text-[13.5px]"
              style={{ boxShadow: "inset 0 0 0 1px var(--cl-line)", color: "var(--cl-ink)" }}>
              <option value="">Tous les agents</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.identity?.name || a.id.slice(0, 8)}</option>)}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90" style={{ color: "var(--cl-ink-faint)" }} />
          </label>
          <BoutonRond icone={RefreshCw} label="Actualiser" onClick={load} disabled={busy} tourne={busy} />
          <Bouton variante="doux" icone={FileCheck2}
            onClick={() => {
              setDiag(null);
              fetch("/api/orders/doc-diagnostic", { headers: { ...authHeaders() } })
                .then((r) => r.json()).then(setDiag)
                .catch((e) => setDiag({ ready: false, checks: [{ ok: false, label: "Diagnostic", detail: e.message }] }));
            }}>
            Vérifier le bon de commande
          </Bouton>
        </div>
      </div>

      <p className="mt-3 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>
        Commandes prises dans les conversations WhatsApp. Rien n&apos;est encaissé ici : vous confirmez avec le client, puis vous faites avancer la commande.
      </p>

      <div className="mt-4 space-y-3">
        {err && <Bandeau ton="rouge">{err}</Bandeau>}
        {diag && (
          <Bandeau ton={diag.ready ? "vert" : "ambre"}
            titre={diag.ready ? "Tout est prêt : le bon de commande partira au client." : "Configuration incomplète : voici ce qui manque."}
            action={<button onClick={() => setDiag(null)} aria-label="Fermer" className="opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>}>
            <ul className="mt-2 space-y-1.5">
              {diag.checks.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  {c.ok ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <X className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  <span>
                    {c.label}{c.detail && <span className="opacity-75"> · {c.detail}</span>}
                    {!c.ok && c.fix && <span className="block text-[12.5px] opacity-80">{c.fix}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Bandeau>
        )}
      </div>

      <div className="mt-5">
        {orders === null ? (
          <Squelettes n={3} hauteur={190} />
        ) : list.length === 0 ? (
          <Vide doodle="unboxing"
            titre={tab === "nouvelle" ? "Aucune commande à traiter." : tab === "encours" ? "Rien en préparation." : tab === "livree" ? "Pas encore de livraison." : "Aucune commande annulée."}
            texte="Les commandes passées dans WhatsApp arrivent ici dès que le client confirme son panier." />
        ) : (
          <motion.div layout className="grid gap-4">
            <AnimatePresence initial={false}>
              {list.map((o, i) => <OrderCard key={o.id} rang={i} order={o} onChange={change} onOpen={setDetail} photos={photos} />)}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {detail && (
        <OrderDetail
          order={detail}
          onClose={() => setDetail(null)}
          onChange={(o, status) => change(o as Order, status)}
        />
      )}
    </div>
  );
}

// ── Une commande ────────────────────────────────────────────────────────────

/** Le geste suivant d'une commande, selon où elle en est. */
function suivante(s?: string): { statut: string; libelle: string; icone: React.ElementType } | null {
  if (!s || s === "nouvelle") return { statut: "en_traitement", libelle: "Mettre en traitement", icone: Timer };
  if (s === "en_traitement" || s === "traitee" || s === "en_livraison") return { statut: "livree", libelle: "Marquer livrée", icone: PackageCheck };
  return null;
}

function OrderCard({ order: o, onChange, onOpen, photos = {}, rang = 0 }: {
  order: Order; onChange: (o: Order, s: string) => void; onOpen: (o: Order) => void;
  photos?: Record<string, string>; rang?: number;
}) {
  const brutes: Item[] = Array.isArray(o.items)
    ? o.items
    : (() => { try { return JSON.parse(String(o.items || "[]")); } catch { return []; } })();
  // La ligne porte sa photo depuis peu ; avant, on la retrouve au catalogue.
  const items: Item[] = brutes.map((it) => ({
    ...it,
    image: it.image || photos[`${o.agent_id}|${String(it.name || "").toLowerCase()}`] || undefined,
  }));

  const phone = String(o.contact_phone || "").replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");
  const hasGeo = o.lat != null && o.lng != null;
  // L'itinéraire s'ouvre dans la page, sur la commande concernée.
  const [itinerary, setItinerary] = useState(false);
  const lieu = o.place_label || o.address || (hasGeo ? `${Number(o.lat).toFixed(5)}, ${Number(o.lng).toFixed(5)}` : "");
  const st = stOf(o.status);
  const next = suivante(o.status);
  const retrait = o.fulfillment === "retrait";

  return (
    <motion.article layout {...apparait(rang)} exit={{ opacity: 0, scale: 0.98 }}
      className="ui-carte overflow-hidden rounded-[28px]">
      {/* En-tête : référence, état, client, montant */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-5 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <span className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>n° {o.ref}</span>
          <Pastille ton={st.ton} point>{st.label}</Pastille>
          {retrait && <Pastille ton="gris">À retirer</Pastille>}
          {o.note && <Pastille ton="violet">{o.note}</Pastille>}
        </div>
        <div className="text-right">
          <p className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums" style={{ color: "var(--cl-ink)" }}>{money(o.total, o.currency)}</p>
          <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{quand(o.created_at)}</p>
        </div>
      </div>

      <div className="grid gap-5 px-5 pb-5 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        {/* Articles et client */}
        <div className="min-w-0">
          <ul className="space-y-2">
            {items.map((it, i) => {
              const q = it.qty || 1, u = Number(it.price || 0);
              return (
                <li key={i} className="flex items-center gap-3 rounded-[18px] p-2 pr-3" style={{ background: "#FAF9FC" }}>
                  <div className="relative flex-shrink-0">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" width={48} height={48} className="h-12 w-12 rounded-[14px] object-cover" style={{ background: "#EEE" }} />
                    ) : (
                      <div className="h-12 w-12 rounded-[14px]" style={{ background: "#EEEBF4" }} />
                    )}
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[10.5px] font-semibold text-white"
                      style={{ background: "var(--cl-ink)" }}>{q}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{it.name}</p>
                    <p className="truncate text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                      {it.variant ? `${it.variant} · ` : ""}{money(u, o.currency)} l&apos;unité
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[13.5px] font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>{money(u * q, o.currency)}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: "var(--cl-ink-soft)" }}>
            <span className="font-medium" style={{ color: "var(--cl-ink)" }}>{o.customer_name || "Client"}</span>
            {phone && <span>{phone}</span>}
            {o.payment_method && <span className="inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {o.payment_method}</span>}
            {o.company_name && <span className="inline-flex items-center gap-1" style={{ color: "#1D4ED8" }}><Building2 className="h-3.5 w-3.5" /> {o.company_name} · {o.company_code}</span>}
          </div>
          {/* Le créneau demandé : c'est lui qui dicte l'ordre de préparation. */}
          {o.scheduled_at && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium" style={{ background: "#FDF1DC", color: "#8A5A00" }}>
              <CalendarClock className="h-3.5 w-3.5" />
              À {retrait ? "retirer" : "livrer"} {new Date(o.scheduled_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Livraison */}
        <div className="min-w-0">
          {lieu ? (
            <div className="overflow-hidden rounded-[20px]" style={{ boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}>
              {hasGeo && <MapPreview lat={Number(o.lat)} lng={Number(o.lng)} radius="20px 20px 0 0" height={110} />}
              <a href={hasGeo ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : `https://www.google.com/maps/search/${encodeURIComponent(lieu)}`}
                target="_blank" rel="noreferrer" className="flex items-start gap-2 px-3.5 py-3 text-[12.5px] hover:underline" style={{ color: "var(--cl-ink)" }}>
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} /> {lieu}
              </a>
              {hasGeo && (
                <div className="px-3 pb-3">
                  <Bouton variante="doux" icone={Navigation} className="w-full" onClick={() => setItinerary(true)}>Lancer l&apos;itinéraire</Bouton>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[90px] items-center justify-center rounded-[20px] px-4 text-center text-[12.5px]" style={{ background: "#FAF9FC", color: "var(--cl-ink-faint)" }}>
              {retrait ? "Retrait en boutique" : "Pas d'adresse sur cette commande"}
            </div>
          )}
        </div>

        {/* Suivi : chaque étape franchie porte son horodatage réel */}
        <Tracking order={o} />
      </div>

      {/* Les gestes */}
      <div className="flex flex-wrap items-center gap-2 border-t px-5 py-4 sm:px-6" style={{ borderColor: "var(--cl-line-soft)" }}>
        {next && (
          <Bouton variante="encre" icone={next.icone} onClick={() => onChange(o, next.statut)}>{next.libelle}</Bouton>
        )}
        {phone && isRealPhone(phone) ? (
          <LienBouton variante="vert" icone={MessageCircle} href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">Répondre sur WhatsApp</LienBouton>
        ) : phone ? (
          <span title="Commande enregistrée avant la résolution des identifiants WhatsApp"
            className="inline-flex h-10 items-center rounded-full px-4 text-[13px]" style={{ background: "#F4F2F7", color: "var(--cl-ink-faint)" }}>
            Numéro indisponible
          </span>
        ) : null}
        <Bouton variante="clair" icone={ChevronRight} onClick={() => onOpen(o)}>Voir le détail</Bouton>
        {o.status !== "annulee" && o.status !== "livree" && (
          <Bouton variante="danger" icone={X} className="sm:ml-auto" onClick={() => onChange(o, "annulee")}>Annuler</Bouton>
        )}
      </div>

      {itinerary && (
        <ItineraryMap orderId={String(o.id)} reference={o.ref} address={lieu} onClose={() => setItinerary(false)} />
      )}
    </motion.article>
  );
}

function Tracking({ order: o }: { order: Order }) {
  const cancelled = o.status === "annulee";
  const steps = [
    { key: "recue",  label: "Reçue",         at: o.created_at,    Icone: Inbox },
    { key: "traite", label: "En traitement", at: o.processing_at, Icone: Timer },
    ...(o.dispatched_at || o.status === "en_livraison" ? [{ key: "route", label: "En livraison", at: o.dispatched_at ?? null, Icone: Bike }] : []),
    { key: "livree", label: "Livrée",        at: o.delivered_at,  Icone: PackageCheck },
  ];
  return (
    <div className="min-w-0 rounded-[20px] p-4" style={{ background: "#FAF9FC" }}>
      <p className="mb-3 text-[11.5px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--cl-ink-faint)" }}>Suivi</p>
      {steps.map((sp, i) => {
        const on = !!sp.at;
        const last = i === steps.length - 1;
        const couleur = cancelled ? "#C2504B" : "var(--cl-accent)";
        return (
          <div key={sp.key} className="flex gap-3">
            <div className="flex w-6 flex-col items-center">
              <motion.span initial={false} animate={{ scale: on ? 1 : 0.85 }} transition={RESSORT}
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: on ? couleur : "#fff", color: on ? "#fff" : "#C9C4D2", boxShadow: on ? "none" : "inset 0 0 0 1.5px #E2DEE9" }}>
                {on ? <sp.Icone className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
              </motion.span>
              {!last && <span className="my-1 w-[2px] flex-1 rounded-full" style={{ minHeight: 14, background: on ? "#D9CEFF" : "#ECE9F1" }} />}
            </div>
            <div className={last ? "" : "pb-2.5"}>
              <p className="text-[13px]" style={{ color: on ? "var(--cl-ink)" : "var(--cl-ink-faint)", fontWeight: on ? 500 : 400 }}>{sp.label}</p>
              <p className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>{on ? quand(sp.at as string) : "En attente"}</p>
            </div>
          </div>
        );
      })}
      {cancelled && <p className="mt-2 text-[12px] font-medium" style={{ color: "#A63D28" }}>Commande annulée</p>}
    </div>
  );
}
