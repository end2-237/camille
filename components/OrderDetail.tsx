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
import dynamic from "next/dynamic";
import { authHeaders } from "@/lib/auth-client";
import { statusLabel } from "@/lib/orderStatus";
import { X } from "lucide-react";

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

const money = (n: unknown, cur?: string) => `${Number(n || 0).toLocaleString("fr-FR")} ${cur || "XAF"}`;

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
  nouvelle:      { bg: "#F3F7E4", fg: "#4A6B00" },
  en_traitement: { bg: "#FDF1DC", fg: "#8A5A00" },
  traitee:       { bg: "#FDF1DC", fg: "#8A5A00" },
  en_livraison:  { bg: "#E7F0FD", fg: "#1D4ED8" },
  livree:        { bg: "#E4F8EC", fg: "#0e6b45" },
  annulee:       { bg: "#FDECEC", fg: "#c0392b" },
};

/** Les suites possibles, dans l'ordre du cycle de vie. */
const NEXT: Record<string, { status: string; label: string; bg: string; fg: string }[]> = {
  nouvelle:      [{ status: "en_traitement", label: "Mettre en traitement", bg: "#101012", fg: "#fff" }],
  en_traitement: [{ status: "en_livraison", label: "Partie en livraison", bg: "#2563EB", fg: "#fff" },
                  { status: "livree", label: "Marquer livrée", bg: "#C6F24E", fg: "#101012" }],
  traitee:       [{ status: "en_livraison", label: "Partie en livraison", bg: "#2563EB", fg: "#fff" },
                  { status: "livree", label: "Marquer livrée", bg: "#C6F24E", fg: "#101012" }],
  en_livraison:  [{ status: "livree", label: "Marquer livrée", bg: "#C6F24E", fg: "#101012" }],
};

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

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,16,18,.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}
      className="sm:!items-center sm:!p-6"
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 720,
        maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.22)" }}>

        {/* En-tête */}
        <div style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "18px 20px 12px",
          borderBottom: "1px solid var(--cl-line)", display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 17, color: "var(--cl-ink)" }}>Commande n° {order.ref}</strong>
          <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: "2px 10px",
            fontSize: 10.5, fontWeight: 800, letterSpacing: .3 }}>
            {statusLabel(order.status).toUpperCase()}
          </span>
          <span style={{ background: "#F4F4F5", color: "var(--cl-sub)", borderRadius: 999,
            padding: "2px 10px", fontSize: 10.5, fontWeight: 700 }}>
            {order.source === "site" ? "SITE WEB" : "WHATSAPP"}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Fermer"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--cl-sub)" }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 18 }}>

          {/* Quand — l'information qui manquait le plus */}
          <Block title="Quand">
            <Line label="Commande reçue" value={`${dateTime(order.created_at)} · ${ago(order.created_at)}`} strong />
            <Line
              label={retrait ? "Retrait demandé" : "Livraison demandée"}
              value={order.scheduled_at ? dateTime(order.scheduled_at) : "Dès que possible"}
              strong={!!order.scheduled_at}
            />
          </Block>

          {/* Articles */}
          <Block title={`Articles · ${items.length}`}>
            {items.map((it, i) => {
              const q = Number(it.qty) || 1;
              const u = Number(it.price) || 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
                  borderBottom: i === items.length - 1 ? "none" : "1px solid #F2F2F2" }}>
                  <span style={{ minWidth: 26, height: 22, borderRadius: 6, background: "#101012", color: "#C6F24E",
                    fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {q}×
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--cl-ink)" }}>{it.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--cl-sub)" }}>
                      {it.variant ? `${it.variant} · ` : ""}{money(u, order.currency)} l&apos;unité
                    </div>
                  </div>
                  <strong style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>{money(u * q, order.currency)}</strong>
                </div>
              );
            })}
            <div style={{ marginTop: 10, borderTop: "1px solid var(--cl-line)", paddingTop: 10 }}>
              <Line label="Sous-total" value={money(sousTotal, order.currency)} />
              <Line label="Livraison" value={fee > 0 ? money(fee, order.currency) : "Offerte"} />
              <Line label="Total" value={money(order.total, order.currency)} strong big />
            </div>
          </Block>

          {/* Paiement — annoncé par le client, jamais encaissé ici */}
          <Block title="Paiement">
            <Line label="Moyen annoncé" value={order.payment_method || "Non précisé"} strong={!!order.payment_method} />
            {order.promo_code && <Line label="Code promo" value={order.promo_code} />}
            {order.note && <Line label="Note" value={order.note} />}
            <p style={{ marginTop: 6, fontSize: 11.5, color: "var(--cl-sub)" }}>
              Camille n&apos;encaisse rien : le client annonce comment il paiera, vous confirmez avec lui.
            </p>
            {order.doc_url && (
              <a href={order.doc_url} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#2563EB" }}>
                Bon de commande {order.doc_number ? `n° ${order.doc_number}` : ""} →
              </a>
            )}
          </Block>

          {/* L'entreprise qui paie, quand un employé a commandé avec son code */}
          {(order.company_name || order.company_code) && (
            <Block title="Compte entreprise">
              <Line label="Entreprise" value={order.company_name || "—"} strong />
              <Line label="Code" value={order.company_code || "—"} />
              <p style={{ marginTop: 6, fontSize: 11.5, color: "var(--cl-sub)" }}>
                Commande rattachée au compte de l&apos;entreprise : c&apos;est elle qui règle, pas l&apos;employé.
              </p>
            </Block>
          )}

          {/* Client */}
          <Block title="Client">
            <Line label="Nom" value={order.customer_name || customer?.display_name || "—"} strong />
            <Line label="Téléphone" value={phone || "—"} />
            {customer?.email && <Line label="E-mail" value={customer.email} />}
            {customer?.company && <Line label="Entreprise" value={customer.company} />}
            {!!customer?.orders_count && (
              <Line
                label="Historique"
                value={`${customer.orders_count} commande(s)${customer.last_order_at ? ` · dernière ${shortTime(customer.last_order_at)}` : ""}`}
              />
            )}
            {phone && isRealPhone(phone) && (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 8, padding: "8px 16px", borderRadius: 999,
                  fontSize: 12.5, fontWeight: 700, background: "#E4F8EC", color: "#0e6b45", textDecoration: "none" }}>
                Répondre sur WhatsApp
              </a>
            )}
          </Block>

          {/* Livraison */}
          <Block title={retrait ? "Retrait" : "Livraison"}>
            <Line label="Mode" value={retrait ? "Le client vient chercher" : "Livraison à l'adresse"} />
            <Line label="Adresse" value={lieu || "—"} strong={!!lieu} />
            {hasGeo && <Line label="Position" value={`${Number(order.lat).toFixed(5)}, ${Number(order.lng).toFixed(5)}`} />}
            {hasGeo && (
              <>
                <div style={{ marginTop: 10 }}>
                  <MapPreview lat={Number(order.lat)} lng={Number(order.lng)} />
                </div>
                <button onClick={() => setItinerary(true)}
                  style={{ marginTop: 8, width: "100%", padding: "9px 12px", borderRadius: 999, border: "none",
                    background: "#2563EB", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  Lancer l&apos;itinéraire
                </button>
              </>
            )}
          </Block>

          {/* Suivi */}
          <Block title="Suivi">
            {[
              { label: "Commande reçue", at: order.created_at },
              { label: "En préparation", at: order.processing_at },
              { label: "En livraison", at: order.dispatched_at },
              { label: "Livrée", at: order.delivered_at },
            ].map((sp, i, all) => (
              <div key={sp.label} style={{ display: "flex", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 6, marginTop: 3,
                    background: sp.at ? (order.status === "annulee" ? "#c0392b" : "#C6F24E") : "#E4E4E4",
                    border: sp.at ? "none" : "1px solid #D8D8D8" }} />
                  {i < all.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: sp.at ? "#C6F24E" : "#EEE" }} />}
                </div>
                <div style={{ paddingBottom: i < all.length - 1 ? 8 : 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: sp.at ? 700 : 500, color: sp.at ? "var(--cl-ink)" : "var(--cl-sub)" }}>
                    {sp.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cl-sub)" }}>{sp.at ? shortTime(sp.at) : "En attente"}</div>
                </div>
              </div>
            ))}
            {order.status === "annulee" && (
              <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: "#c0392b" }}>Commande annulée</div>
            )}
          </Block>

          {loading && <div style={{ fontSize: 11.5, color: "var(--cl-sub)" }}>Chargement du détail…</div>}
        </div>

        {/* Actions */}
        <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid var(--cl-line)",
          padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(NEXT[order.status] || []).map((a) => (
            <button key={a.status}
              onClick={() => { setOrder((o) => ({ ...o, status: a.status })); onChange(order, a.status); }}
              style={{ padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: 12.5, fontWeight: 700, background: a.bg, color: a.fg }}>
              {a.label}
            </button>
          ))}
          {order.status !== "annulee" && order.status !== "livree" && (
            <button onClick={() => { setOrder((o) => ({ ...o, status: "annulee" })); onChange(order, "annulee"); }}
              style={{ padding: "9px 16px", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                border: "1px solid var(--cl-line)", background: "#fff", color: "#c0392b" }}>
              Annuler
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            style={{ padding: "9px 16px", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              border: "1px solid var(--cl-line)", background: "#fff", color: "var(--cl-sub)" }}>
            Fermer
          </button>
        </div>
      </div>

      {itinerary && (
        <ItineraryMap orderId={String(order.id)} reference={order.ref} address={lieu} onClose={() => setItinerary(false)} />
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .4, color: "var(--cl-sub)", marginBottom: 8 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ border: "1px solid var(--cl-line)", borderRadius: 12, padding: 14 }}>{children}</div>
    </section>
  );
}

function Line({ label, value, strong, big }: { label: string; value: string; strong?: boolean; big?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "3px 0" }}>
      <span style={{ fontSize: 12.5, color: "var(--cl-sub)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: big ? 15 : 13, fontWeight: strong || big ? 700 : 500, color: "var(--cl-ink)", textAlign: "right" }}>
        {value}
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
    <div style={{ position: "relative", height, overflow: "hidden", background: "#E8E8E8",
      border: "1px solid var(--cl-line)", borderRadius: radius }}>
      <div style={{ display: "flex", position: "absolute", top: -(fy * TILE - height / 2), left: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {uris.map((u) => <img key={u} src={u} alt="" width={TILE} height={TILE} />)}
      </div>
      <div style={{ position: "absolute", left: TILE + fx * TILE - 7, top: height / 2 - 20, fontSize: 22 }}>📍</div>
      <div style={{ position: "absolute", right: 4, bottom: 1, fontSize: 8, color: "#5A5A5A" }}>
        © OpenStreetMap
      </div>
    </div>
  );
}
