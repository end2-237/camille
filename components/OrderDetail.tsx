"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le détail complet d'une commande.
//
// La liste répond à « qu'est-ce que je dois préparer ». Elle laissait de côté
// tout le reste : l'heure exacte à laquelle la commande est tombée, le créneau
// demandé par le client, le moyen de paiement qu'il a annoncé, le détail des
// frais, ce qu'on sait déjà de lui. Autant d'informations enregistrées mais
// jamais montrées au vendeur — c'est ce que cette fiche répare.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bike, Building2, CalendarClock, CircleDot, Clock, CreditCard, FileText, Inbox, MapPin, MessageCircle,
  Navigation, PackageCheck, Phone, ShoppingBag, Timer, UserRound, X,
} from "lucide-react";
import { authHeaders } from "@/lib/auth-client";
import { statusLabel } from "@/lib/orderStatus";

const ItineraryMap = dynamic(() => import("@/components/ItineraryMap"), { ssr: false });

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OrderItem = { name: string; variant?: string; qty?: number; price?: number; image?: string };
export type OrderRow = {
  id: string; ref: string; agent_id: string; status: string;
  items: OrderItem[] | string; total: number; currency: string; note?: string | null;
  customer_name?: string | null; contact_phone?: string | null;
  address?: string | null; place_label?: string | null;
  lat?: number | null; lng?: number | null;
  delivery_fee?: number | null; source?: string | null;
  payment_method?: string | null; fulfillment?: string | null; promo_code?: string | null;
  company_code?: string | null; company_name?: string | null;
  scheduled_at?: string | null; processing_at?: string | null;
  dispatched_at?: string | null; delivered_at?: string | null;
  doc_number?: string | null; doc_url?: string | null;
  shop_lat?: number | null; shop_lng?: number | null; shop_name?: string | null;
  created_at: string;
};
type Contact = {
  display_name?: string | null; email?: string | null; company?: string | null;
  orders_count?: number | null; last_order_at?: string | null;
};

const money = (n: unknown, cur?: string) => `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} ${!cur || cur === "XAF" ? "FCFA" : cur}`;

const dateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

const shortTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

/** « il y a 12 min » : le vendeur veut savoir si c'est chaud. */
function ago(v?: string | null) {
  if (!v) return "";
  const m = Math.floor((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

const parseItems = (v: OrderRow["items"]): OrderItem[] =>
  Array.isArray(v) ? v : (() => { try { return JSON.parse(String(v || "[]")); } catch { return []; } })();

const cleanPhone = (p?: string | null) => String(p || "").replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");
const isRealPhone = (p: string) => /^\d{8,14}$/.test(p);

const ST: Record<string, { bg: string; fg: string }> = {
  nouvelle:      { bg: "#FDF1DC", fg: "#9A6510" },
  en_traitement: { bg: "#F0EBFF", fg: "#6442E8" },
  traitee:       { bg: "#F0EBFF", fg: "#6442E8" },
  en_livraison:  { bg: "#E6EEFD", fg: "#1D4ED8" },
  livree:        { bg: "#E4F6EA", fg: "#1E7A3A" },
  annulee:       { bg: "#FBEAE6", fg: "#A63D28" },
};

/** Les suites possibles, dans l'ordre du cycle de vie. La première est le geste principal. */
type Suite = { status: string; label: string; Icone: React.ElementType; principal?: boolean };
const NEXT: Record<string, Suite[]> = {
  nouvelle:      [{ status: "en_traitement", label: "Mettre en traitement", Icone: Timer, principal: true }],
  en_traitement: [{ status: "en_livraison", label: "Partie en livraison", Icone: Bike, principal: true },
                  { status: "livree", label: "Marquer livrée", Icone: PackageCheck }],
  traitee:       [{ status: "en_livraison", label: "Partie en livraison", Icone: Bike, principal: true },
                  { status: "livree", label: "Marquer livrée", Icone: PackageCheck }],
  en_livraison:  [{ status: "livree", label: "Marquer livrée", Icone: PackageCheck, principal: true }],
};

const RESSORT = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 } as const;

export default function OrderDetail({
  order: base,
  onClose,
  onChange,
}: {
  order: OrderRow;
  onClose: () => void;
  onChange: (order: OrderRow, status: string) => void;
}) {
  const [order, setOrder] = useState<OrderRow>(base);
  const [customer, setCustomer] = useState<Contact | null>(null);
  const [itinerary, setItinerary] = useState(false);
  const [loading, setLoading] = useState(true);

  // La liste est déjà à l'écran : on l'affiche tout de suite, puis on complète
  // avec ce que seule la fiche détaillée connaît.
  useEffect(() => {
    let alive = true;
    fetch(`/api/orders/${base.id}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.order) return;
        setOrder((prev) => ({ ...prev, ...d.order }));
        setCustomer(d.customer ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [base.id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);

  const items = parseItems(order.items);
  const phone = cleanPhone(order.contact_phone);
  const hasGeo = order.lat != null && order.lng != null;
  const lieu = order.place_label || order.address || (hasGeo ? `${Number(order.lat).toFixed(5)}, ${Number(order.lng).toFixed(5)}` : "");
  const fee = Number(order.delivery_fee || 0);
  const sousTotal = items.reduce((s, i) => s + Number(i.price || 0) * (Number(i.qty) || 1), 0);
  const st = ST[order.status] || ST.nouvelle;
  const retrait = order.fulfillment === "retrait";

  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  const etapes = [
    { label: "Commande reçue", at: order.created_at, Icone: Inbox },
    { label: "En préparation", at: order.processing_at, Icone: Timer },
    { label: "En livraison", at: order.dispatched_at, Icone: Bike },
    { label: "Livrée", at: order.delivered_at, Icone: PackageCheck },
  ];
  const annulee = order.status === "annulee";

  // Rendu à la racine du document : dans la feuille du tableau de bord, la
  // fiche passerait sous la barre de navigation.
  if (!monte) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div key="voile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        className="fixed inset-0 z-[90] flex items-end justify-end sm:items-stretch sm:p-3"
        style={{ background: "rgba(25,23,27,0.38)" }}>
        <motion.aside initial={{ x: 48, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 48, opacity: 0 }} transition={RESSORT}
          className="od-panneau flex w-full flex-col overflow-hidden rounded-t-[30px] sm:max-w-[600px] sm:rounded-[30px]">

          {/* En-tête */}
          <div className="px-6 pb-4 pt-5" style={{ background: "linear-gradient(150deg, #F4F0FF 0%, #fff 70%)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Commande</p>
                <h2 className="truncate text-[26px] font-medium tracking-[-0.03em]" style={{ color: "var(--cl-ink)" }}>n° {order.ref}</h2>
              </div>
              <button onClick={onClose} aria-label="Fermer"
                className="od-rond flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium" style={{ background: st.bg, color: st.fg }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.fg }} />{statusLabel(order.status)}
              </span>
              <span className="rounded-full px-3 py-1 text-[12.5px]" style={{ background: "#fff", color: "var(--cl-ink-soft)", boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}>
                {order.source === "site" ? "Site web" : "WhatsApp"}
              </span>
              <span className="rounded-full px-3 py-1 text-[12.5px]" style={{ background: "#fff", color: "var(--cl-ink-soft)", boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}>
                {retrait ? "Retrait en boutique" : "Livraison"}
              </span>
              <span className="ml-auto text-[24px] font-semibold tracking-[-0.02em] tabular-nums" style={{ color: "var(--cl-ink)" }}>{money(order.total, order.currency)}</span>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6 pt-2 sm:px-5">
            {/* Quand — l'information qui manquait le plus */}
            <Bloc titre="Quand" Icone={Clock}>
              <Ligne label="Commande reçue" valeur={dateTime(order.created_at)} sous={ago(order.created_at)} fort />
              <Ligne label={retrait ? "Retrait demandé" : "Livraison demandée"}
                valeur={order.scheduled_at ? dateTime(order.scheduled_at) : "Dès que possible"} fort={!!order.scheduled_at}
                accent={order.scheduled_at ? "ambre" : undefined} />
            </Bloc>

            {/* Articles */}
            <Bloc titre={`Articles · ${items.length}`} Icone={ShoppingBag}>
              <ul className="space-y-2">
                {items.map((it, i) => {
                  const q = Number(it.qty) || 1;
                  const u = Number(it.price) || 0;
                  return (
                    <li key={i} className="flex items-center gap-3 rounded-[18px] p-2 pr-3" style={{ background: "#FAF9FC" }}>
                      <div className="relative flex-shrink-0">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image} alt="" className="h-12 w-12 rounded-[14px] object-cover" />
                        ) : <div className="h-12 w-12 rounded-[14px]" style={{ background: "#EEEBF4" }} />}
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[10.5px] font-semibold text-white" style={{ background: "var(--cl-ink)" }}>{q}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[14px] font-medium leading-snug" style={{ color: "var(--cl-ink)" }}>{it.name}</p>
                        <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{it.variant ? `${it.variant} · ` : ""}{money(u, order.currency)} l&apos;unité</p>
                      </div>
                      <span className="whitespace-nowrap text-[14px] font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>{money(u * q, order.currency)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 space-y-1 rounded-[18px] p-3.5" style={{ background: "#FAF9FC" }}>
                <Ligne label="Sous-total" valeur={money(sousTotal, order.currency)} compact />
                <Ligne label="Livraison" valeur={fee > 0 ? money(fee, order.currency) : "Offerte"} compact />
                <div className="mt-1.5 flex items-baseline justify-between border-t pt-2.5" style={{ borderColor: "var(--cl-line-soft)" }}>
                  <span className="text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>Total</span>
                  <span className="text-[20px] font-semibold tabular-nums" style={{ color: "var(--cl-ink)" }}>{money(order.total, order.currency)}</span>
                </div>
              </div>
            </Bloc>

            {/* Paiement — annoncé par le client, jamais encaissé ici */}
            <Bloc titre="Paiement" Icone={CreditCard}>
              <Ligne label="Moyen annoncé" valeur={order.payment_method || "Non précisé"} fort={!!order.payment_method} />
              {order.promo_code && <Ligne label="Code promo" valeur={order.promo_code} />}
              {order.note && <Ligne label="Note" valeur={order.note} />}
              <p className="mt-2 rounded-[14px] px-3 py-2 text-[12px] leading-snug" style={{ background: "#F4F0FF", color: "#4B32B5" }}>
                Camille n&apos;encaisse rien : le client annonce comment il paiera, vous confirmez avec lui.
              </p>
              {order.doc_url && (
                <a href={order.doc_url} target="_blank" rel="noreferrer"
                  className="mt-2.5 inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium"
                  style={{ background: "#F4F2F7", color: "var(--cl-ink)" }}>
                  <FileText className="h-4 w-4" /> Bon de commande {order.doc_number ? `n° ${order.doc_number}` : ""}
                </a>
              )}
            </Bloc>

            {/* L'entreprise qui paie, quand un employé a commandé avec son code */}
            {(order.company_name || order.company_code) && (
              <Bloc titre="Compte entreprise" Icone={Building2}>
                <Ligne label="Entreprise" valeur={order.company_name || "—"} fort />
                <Ligne label="Code" valeur={order.company_code || "—"} />
                <p className="mt-2 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>C&apos;est l&apos;entreprise qui règle, pas l&apos;employé.</p>
              </Bloc>
            )}

            {/* Client */}
            <Bloc titre="Client" Icone={UserRound}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                  style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                  {(order.customer_name || customer?.display_name || "C").trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>{order.customer_name || customer?.display_name || "Client"}</p>
                  <p className="truncate text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                    {phone || "Numéro inconnu"}{customer?.orders_count ? ` · ${customer.orders_count} commande${customer.orders_count > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                {phone && isRealPhone(phone) && (
                  <>
                    <a href={`tel:${phone}`} aria-label="Appeler" className="od-rond flex h-10 w-10 items-center justify-center rounded-full"><Phone className="h-4 w-4" /></a>
                    <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"
                      className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "#E4F6EA", color: "#1E6A37" }}><MessageCircle className="h-4 w-4" /></a>
                  </>
                )}
              </div>
              {(customer?.email || customer?.company || customer?.last_order_at) && (
                <div className="mt-3 space-y-1">
                  {customer?.email && <Ligne label="E-mail" valeur={customer.email} compact />}
                  {customer?.company && <Ligne label="Entreprise" valeur={customer.company} compact />}
                  {customer?.last_order_at && <Ligne label="Dernière commande" valeur={shortTime(customer.last_order_at)} compact />}
                </div>
              )}
            </Bloc>

            {/* Livraison */}
            <Bloc titre={retrait ? "Retrait" : "Livraison"} Icone={MapPin}>
              <p className="flex items-start gap-2 text-[14px]" style={{ color: lieu ? "var(--cl-ink)" : "var(--cl-ink-faint)" }}>
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
                {lieu || (retrait ? "Le client vient chercher sa commande" : "Pas d'adresse sur cette commande")}
              </p>
              {hasGeo && (
                <>
                  <div className="mt-3 overflow-hidden rounded-[20px]">
                    <MapPreview lat={Number(order.lat)} lng={Number(order.lng)} height={150} radius="20px" />
                  </div>
                  <button onClick={() => setItinerary(true)}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13.5px] font-medium"
                    style={{ background: "#F4F2F7", color: "var(--cl-ink)" }}>
                    <Navigation className="h-4 w-4" /> Lancer l&apos;itinéraire
                  </button>
                </>
              )}
            </Bloc>

            {/* Suivi */}
            <Bloc titre="Suivi" Icone={CalendarClock}>
              {etapes.map((sp, i) => {
                const on = !!sp.at;
                const dernier = i === etapes.length - 1;
                const couleur = annulee ? "#C2504B" : "var(--cl-accent)";
                return (
                  <div key={sp.label} className="flex gap-3">
                    <div className="flex w-7 flex-col items-center">
                      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...RESSORT, delay: 0.12 + i * 0.06 }}
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ background: on ? couleur : "#fff", color: on ? "#fff" : "#C9C4D2", boxShadow: on ? "none" : "inset 0 0 0 1.5px #E2DEE9" }}>
                        {on ? <sp.Icone className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
                      </motion.span>
                      {!dernier && <span className="my-1 w-[2px] flex-1 rounded-full" style={{ minHeight: 14, background: on ? "#D9CEFF" : "#ECE9F1" }} />}
                    </div>
                    <div className={dernier ? "pt-1" : "pb-3 pt-1"}>
                      <p className="text-[14px]" style={{ color: on ? "var(--cl-ink)" : "var(--cl-ink-faint)", fontWeight: on ? 500 : 400 }}>{sp.label}</p>
                      <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{on ? shortTime(sp.at) : "En attente"}</p>
                    </div>
                  </div>
                );
              })}
              {annulee && <p className="mt-2 text-[13px] font-medium" style={{ color: "#A63D28" }}>Commande annulée</p>}
            </Bloc>

            {loading && <p className="px-2 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Chargement du détail…</p>}
          </div>

          {/* Les gestes, toujours à portée */}
          <div className="flex flex-wrap items-center gap-2 border-t px-5 py-4" style={{ borderColor: "var(--cl-line-soft)" }}>
            {(NEXT[order.status] || []).map((a) => (
              <motion.button key={a.status} whileTap={{ scale: 0.97 }}
                onClick={() => { setOrder((o) => ({ ...o, status: a.status })); onChange(order, a.status); }}
                className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium"
                style={a.principal ? { background: "var(--cl-ink)", color: "#fff" } : { background: "#F4F2F7", color: "var(--cl-ink)" }}>
                <a.Icone className="h-4 w-4" /> {a.label}
              </motion.button>
            ))}
            {order.status !== "annulee" && order.status !== "livree" && (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => { setOrder((o) => ({ ...o, status: "annulee" })); onChange(order, "annulee"); }}
                className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium"
                style={{ background: "#fff", color: "#A63D28", boxShadow: "inset 0 0 0 1px #F0D2CB" }}>
                <X className="h-4 w-4" /> Annuler
              </motion.button>
            )}
            <button onClick={onClose} className="ml-auto hidden h-11 items-center rounded-full px-4 text-[14px] sm:inline-flex" style={{ color: "var(--cl-ink-soft)" }}>Fermer</button>
          </div>
        </motion.aside>

        {itinerary && (
          <ItineraryMap orderId={String(order.id)} reference={order.ref} address={lieu} onClose={() => setItinerary(false)} />
        )}
      </motion.div>
      <style>{`
        .od-panneau { background: #fff; max-height: 94dvh; box-shadow: -20px 0 60px rgba(25,23,27,0.18); }
        @media (min-width: 640px) { .od-panneau { max-height: none; height: 100%; } }
        .od-rond { background: #fff; color: var(--cl-ink); box-shadow: inset 0 0 0 1px var(--cl-line); }
      `}</style>
    </AnimatePresence>,
    document.body
  );
}

function Bloc({ titre, Icone, children }: { titre: string; Icone: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] p-4" style={{ boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}>
      <p className="mb-3 flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--cl-ink-faint)" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
          <Icone className="h-3.5 w-3.5" />
        </span>
        {titre}
      </p>
      {children}
    </section>
  );
}

function Ligne({ label, valeur, sous, fort, compact, accent }: {
  label: string; valeur: string; sous?: string; fort?: boolean; compact?: boolean; accent?: "ambre";
}) {
  return (
    <div className={"flex items-baseline justify-between gap-4 " + (compact ? "py-0.5" : "py-1.5")}>
      <span className="flex-shrink-0 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>{label}</span>
      <span className="text-right">
        <span className={"text-[13.5px] " + (fort ? "font-medium" : "")}
          style={accent === "ambre" ? { color: "#8A5A00", background: "#FDF1DC", padding: "2px 10px", borderRadius: 999 } : { color: "var(--cl-ink)" }}>
          {valeur}
        </span>
        {sous && <span className="block text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{sous}</span>}
      </span>
    </div>
  );
}

// Aperçu carto sans clé d'API : on calcule la tuile qui contient le point et on
// place le marqueur à sa position exacte dedans.
// Tuiles servies par Camille (/api/tiles), comme la carte du suivi.
const TILE = 256;
const ZOOM = 16;
const TILE_HOST = "/api/tiles";

export function MapPreview({ lat, lng, height = 120, radius = "10px" }: {
  lat: number; lng: number; height?: number; radius?: string;
}) {
  const n = 2 ** ZOOM;
  const x = ((lng + 180) / 360) * n;
  const la = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n;
  const tx = Math.floor(x), ty = Math.floor(y), fx = x - tx, fy = y - ty;
  const uris = [-1, 0, 1].map((d) => `${TILE_HOST}/${ZOOM}/${tx + d}/${ty}.png`);

  return (
    <div style={{ position: "relative", height, overflow: "hidden", background: "#EDEDF2", borderRadius: radius }}>
      <div style={{ display: "flex", position: "absolute", top: -(fy * TILE - height / 2), left: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {uris.map((u) => <img key={u} src={u} alt="" width={TILE} height={TILE} />)}
      </div>
      <div style={{ position: "absolute", left: TILE + fx * TILE - 14, top: height / 2 - 14, width: 28, height: 28, borderRadius: 999,
        background: "rgba(124,90,248,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 14, height: 14, borderRadius: 999, background: "#7C5AF8", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(70,40,190,.4)" }} />
      </div>
      <div style={{ position: "absolute", right: 4, bottom: 1, fontSize: 8, color: "#5A5A5A" }}>
        © OpenStreetMap
      </div>
    </div>
  );
}
