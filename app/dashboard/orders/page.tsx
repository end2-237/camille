// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/orders/page.tsx
// Gestion des commandes issues du flux WhatsApp : suivi, statut, localisation.
// Mêmes actions que l'app mobile — répondre, marquer traitée, annuler.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { authHeaders } from "@/lib/auth-client";
import dynamic from "next/dynamic";

import OrderDetail, { MapPreview } from "@/components/OrderDetail";

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

// Cycle de vie : à traiter → en traitement → livrée. "traitee" est l'ancien
// statut des commandes créées avant le suivi ; on l'affiche comme "en traitement".
const ST: Record<string, { label: string; bg: string; fg: string }> = {
  nouvelle:      { label: "À traiter",     bg: "#F3F7E4", fg: "#4A6B00" },
  en_traitement: { label: "En traitement", bg: "#FDF1DC", fg: "#8A5A00" },
  traitee:       { label: "En traitement", bg: "#FDF1DC", fg: "#8A5A00" },
  livree:        { label: "Livrée",        bg: "#E4F8EC", fg: "#0e6b45" },
  annulee:       { label: "Annulée",       bg: "#FDECEC", fg: "#c0392b" },
};
const stOf = (s?: string) => ST[s || "nouvelle"] || ST.nouvelle;

const TABS: { key: string; label: string; match: (s?: string) => boolean }[] = [
  { key: "nouvelle", label: "À traiter", match: (s) => !s || s === "nouvelle" },
  { key: "encours",  label: "En cours",  match: (s) => s === "en_traitement" || s === "traitee" },
  { key: "livree",   label: "Livrées",   match: (s) => s === "livree" },
  { key: "annulee",  label: "Annulées",  match: (s) => s === "annulee" },
];

// WhatsApp adresse parfois les contacts par LID : un identifiant interne, pas
// un numéro. Les LID observés font 15 chiffres ou plus ; aucun numéro mobile
// réel n'atteint cette longueur. Un lien wa.me construit dessus est mort.
const isRealPhone = (p: string) => /^\d{8,14}$/.test(p);

function money(n: number, cur?: string) {
  return `${Number(n || 0).toLocaleString("fr-FR")} ${cur || "XAF"}`;
}

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

  useEffect(() => {
    fetch("/api/agents", { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => setAgents(Array.isArray(d.agents) ? d.agents : []))
      .catch(() => {});
  }, []);

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

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--cl-ink)" }}>Commandes</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
              border: "1px solid var(--cl-line)", background: "#fff", color: "var(--cl-ink)" }}>
            <option value="">Tous les agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.identity?.name || a.id.slice(0, 8)}</option>)}
          </select>
          <button onClick={load} disabled={busy}
            style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "1px solid var(--cl-line)", background: "#fff", color: "var(--cl-ink)" }}>
            {busy ? "…" : "Actualiser"}
          </button>
          <button
            onClick={() => {
              setDiag(null);
              fetch("/api/orders/doc-diagnostic", { headers: { ...authHeaders() } })
                .then((r) => r.json()).then(setDiag)
                .catch((e) => setDiag({ ready: false, checks: [{ ok: false, label: "Diagnostic", detail: e.message }] }));
            }}
            style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "1px solid var(--cl-line)", background: "#fff", color: "var(--cl-sub)" }}>
            Vérifier le bon de commande
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--cl-sub)", marginBottom: 20 }}>
        Commandes enregistrées depuis les conversations WhatsApp. Aucun paiement n&apos;est encaissé ici :
        vous confirmez avec le client, puis vous marquez la commande traitée.
      </p>

      {err && (
        <div style={{ padding: 16, borderRadius: 12, background: "#FDECEC", color: "#c0392b", fontSize: 13.5, marginBottom: 18 }}>
          {err}
        </div>
      )}

      {diag && (
        <div style={{ padding: 16, borderRadius: 12, marginBottom: 18, fontSize: 13,
          border: `1px solid ${diag.ready ? "#B7E4C7" : "#F3D5A5"}`,
          background: diag.ready ? "#E4F8EC" : "#FDF7E7" }}>
          <strong style={{ display: "block", marginBottom: 8 }}>
            {diag.ready
              ? "Tout est prêt — le bon de commande partira au client."
              : "Configuration incomplète — voici ce qui manque :"}
          </strong>
          {diag.checks.map((c, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              {c.ok ? "✅" : "❌"} {c.label}
              {c.detail && <span style={{ color: "var(--cl-sub)" }}> — {c.detail}</span>}
              {!c.ok && c.fix && (
                <div style={{ marginLeft: 20, color: "#8A5A00", fontSize: 12 }}>→ {c.fix}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Récapitulatif */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 22 }}>
        <Kpi label="À traiter" value={String(counts.nouvelle)} hint="en attente" accent={counts.nouvelle > 0} />
        <Kpi label="En traitement" value={String(counts.encours)} hint="en cours" />
        <Kpi label="Livrées" value={String(counts.livree)} hint={money(caTotal, (orders || [])[0]?.currency)} />
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "1px solid var(--cl-line)", background: tab === t.key ? "#101012" : "#fff",
              color: tab === t.key ? "#fff" : "var(--cl-sub)" }}>
            {t.label} · {counts[t.key] ?? 0}
          </button>
        ))}
      </div>

      {orders === null ? (
        <p style={{ fontSize: 13.5, color: "var(--cl-sub)" }}>Chargement…</p>
      ) : list.length === 0 ? (
        <div style={{ padding: 28, borderRadius: 14, border: "1px dashed var(--cl-line)", textAlign: "center",
          fontSize: 13.5, color: "var(--cl-sub)" }}>
          Aucune commande dans cet onglet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((o) => <OrderCard key={o.id} order={o} onChange={change} onOpen={setDetail} />)}
        </div>
      )}

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

function OrderCard({ order: o, onChange, onOpen }: {
  order: Order; onChange: (o: Order, s: string) => void; onOpen: (o: Order) => void;
}) {
  const items: Item[] = Array.isArray(o.items)
    ? o.items
    : (() => { try { return JSON.parse(String(o.items || "[]")); } catch { return []; } })();

  const phone = String(o.contact_phone || "").replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");
  const hasGeo = o.lat != null && o.lng != null;
  // L'itinéraire s'ouvre dans la page, sur la commande concernée.
  const [itinerary, setItinerary] = useState(false);
  const lieu = o.place_label || o.address || (hasGeo ? `${Number(o.lat).toFixed(5)}, ${Number(o.lng).toFixed(5)}` : "");

  return (
    <div style={{ border: "1px solid var(--cl-line)", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 16, padding: 16, flexWrap: "wrap" }}>
        {/* Détail */}
        <div style={{ flex: "1 1 320px", minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <strong style={{ fontSize: 15, color: "var(--cl-ink)" }}>n° {o.ref}</strong>
            <span style={{ background: stOf(o.status).bg, color: stOf(o.status).fg, borderRadius: 999,
              padding: "2px 10px", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>
              {stOf(o.status).label.toUpperCase()}
            </span>
            {o.note && (
              <span style={{ background: "#F3F7E4", color: "#4A6B00", borderRadius: 999,
                padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                {o.note}
              </span>
            )}
          </div>

          <div style={{ marginBottom: 8 }}>
            {items.map((it, i) => {
              const q = it.qty || 1, u = Number(it.price || 0);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
                  borderBottom: i === items.length - 1 ? "none" : "1px solid #F2F2F2" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" width={40} height={40}
                        style={{ borderRadius: 8, objectFit: "cover", background: "#F4F4F4" }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "#F4F4F4" }} />
                    )}
                    <span style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18,
                      borderRadius: 9, background: "#101012", color: "#C6F24E", fontSize: 10, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                      border: "2px solid #fff" }}>{q}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--cl-ink)" }}>{it.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--cl-sub)" }}>
                      {it.variant ? `${it.variant} · ` : ""}{money(u, o.currency)} l&apos;unité
                    </div>
                  </div>
                  <strong style={{ fontSize: 13.5, color: "var(--cl-ink)", whiteSpace: "nowrap" }}>{money(u * q, o.currency)}</strong>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--cl-ink)" }}>{money(o.total, o.currency)}</div>
          <div style={{ fontSize: 12, color: "var(--cl-sub)", marginTop: 3 }}>
            {o.customer_name ? `${o.customer_name} · ` : ""}{phone} · commandée le{" "}
            {new Date(o.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
          {/* Le créneau demandé : c'est lui qui dicte l'ordre de préparation. */}
          {o.scheduled_at && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8A5A00", marginTop: 3 }}>
              ⏰ À {o.fulfillment === "retrait" ? "retirer" : "livrer"}{" "}
              {new Date(o.scheduled_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          {o.company_name && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginTop: 3 }}>
              🏢 {o.company_name} · {o.company_code}
            </div>
          )}
          {o.payment_method && (
            <div style={{ fontSize: 12, color: "var(--cl-sub)", marginTop: 3 }}>
              💳 {o.payment_method}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={() => onOpen(o)}
              style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: "1px solid var(--cl-line)", background: "#fff", color: "var(--cl-ink)" }}>
              Voir le détail
            </button>
            {phone && isRealPhone(phone) && (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                  background: "#E4F8EC", color: "#0e6b45", textDecoration: "none" }}>
                Répondre sur WhatsApp
              </a>
            )}
            {phone && !isRealPhone(phone) && (
              <span title="Commande enregistrée avant la résolution des identifiants WhatsApp"
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                  background: "#F1F1F1", color: "var(--cl-sub)" }}>
                Numéro indisponible
              </span>
            )}
            {(!o.status || o.status === "nouvelle") && (
              <button onClick={() => onChange(o, "en_traitement")}
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: "none", background: "#101012", color: "#fff" }}>
                Mettre en traitement
              </button>
            )}
            {(o.status === "en_traitement" || o.status === "traitee") && (
              <button onClick={() => onChange(o, "livree")}
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: "none", background: "#C6F24E", color: "#101012" }}>
                Marquer livrée
              </button>
            )}
            {o.status !== "annulee" && o.status !== "livree" && (
              <button onClick={() => onChange(o, "annulee")}
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: "1px solid var(--cl-line)", background: "#fff", color: "#c0392b" }}>
                Annuler
              </button>
            )}
          </div>
        </div>

        {/* Livraison */}
        {lieu && (
          <div style={{ flex: "0 1 260px", minWidth: 220 }}>
            {hasGeo && <MapPreview lat={Number(o.lat)} lng={Number(o.lng)} radius="10px 10px 0 0" />}
            <a
              href={hasGeo
                ? `https://www.google.com/maps?q=${o.lat},${o.lng}`
                : `https://www.google.com/maps/search/${encodeURIComponent(lieu)}`}
              target="_blank" rel="noreferrer"
              style={{ display: "block", fontSize: 12, color: "var(--cl-ink)", textDecoration: "none",
                padding: "8px 10px", background: "#FAFAFA", border: "1px solid var(--cl-line)",
                borderTop: hasGeo ? "none" : "1px solid var(--cl-line)",
                borderRadius: hasGeo ? "0 0 10px 10px" : 10 }}>
              📍 {lieu}
            </a>
            {hasGeo && (
              <button
                onClick={() => setItinerary(true)}
                style={{ display: "block", width: "100%", textAlign: "center", marginTop: 8, padding: "9px 12px",
                  borderRadius: 999, background: "#2563EB", color: "#fff", fontSize: 12.5,
                  fontWeight: 700, border: "none", cursor: "pointer" }}>
                Lancer l&apos;itinéraire
              </button>
            )}
          </div>
        )}

        {/* Suivi : chaque étape franchie porte son horodatage réel */}
        <div style={{ flex: "0 1 220px", minWidth: 200 }}>
          <Tracking order={o} />
        </div>
      </div>

      {itinerary && (
        <ItineraryMap
          orderId={String(o.id)}
          reference={o.ref}
          address={lieu}
          onClose={() => setItinerary(false)}
        />
      )}
    </div>
  );
}

function Tracking({ order: o }: { order: Order }) {
  const cancelled = o.status === "annulee";
  const steps = [
    { key: "recue",  label: "Commande reçue", at: o.created_at },
    { key: "traite", label: "En traitement",  at: o.processing_at },
    { key: "livree", label: "Livrée",         at: o.delivered_at },
  ];
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cl-sub)", letterSpacing: 0.3, marginBottom: 8 }}>SUIVI</div>
      {steps.map((sp, i) => {
        const on = !!sp.at;
        const last = i === steps.length - 1;
        return (
          <div key={sp.key} style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
              <div style={{ width: 11, height: 11, borderRadius: 6, marginTop: 3,
                background: on ? (cancelled ? "#c0392b" : "#C6F24E") : "#E4E4E4",
                border: on ? "none" : "1px solid #D8D8D8" }} />
              {!last && <div style={{ width: 2, flex: 1, minHeight: 18, background: on ? "#C6F24E" : "#EEE" }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? "var(--cl-ink)" : "var(--cl-sub)" }}>{sp.label}</div>
              <div style={{ fontSize: 11, color: "var(--cl-sub)" }}>
                {on ? new Date(sp.at as string).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "En attente"}
              </div>
            </div>
          </div>
        );
      })}
      {cancelled && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: "#c0392b" }}>Commande annulée</div>}
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--cl-line)", borderRadius: 14, padding: 16,
      background: accent ? "#101012" : "#fff" }}>
      <div style={{ fontSize: 11.5, color: accent ? "rgba(255,255,255,0.6)" : "var(--cl-sub)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: accent ? "#C6F24E" : "var(--cl-ink)" }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: accent ? "rgba(255,255,255,0.5)" : "var(--cl-sub)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
