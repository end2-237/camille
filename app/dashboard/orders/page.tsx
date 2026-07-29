// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/orders/page.tsx
// Gestion des commandes issues du flux WhatsApp : suivi, statut, localisation.
// Mêmes actions que l'app mobile — répondre, marquer traitée, annuler.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { authHeaders } from "@/lib/auth-client";

type Item = { name: string; variant?: string; qty?: number; price?: number; currency?: string };
type Order = {
  id: string; ref: string; agent_id: string; status: string;
  items: Item[] | string; total: number; currency: string; note?: string | null;
  customer_name?: string | null; contact_phone?: string | null;
  address?: string | null; place_label?: string | null;
  lat?: number | null; lng?: number | null;
  created_at: string;
};
type Agent = { id: string; identity?: { name?: string } };

const TABS = [
  { key: "nouvelle", label: "Nouvelles" },
  { key: "traitee", label: "Traitées" },
  { key: "annulee", label: "Annulées" },
];

const STATUS_BG: Record<string, string> = {
  nouvelle: "#101012", traitee: "#0e9d63", annulee: "#c0392b",
};

// Aperçu carto sans clé d'API : on calcule la tuile OpenStreetMap qui contient
// le point, et on place le marqueur à sa position exacte dans cette tuile.
const TILE = 256;
const ZOOM = 16;

function tileOf(lat: number, lng: number) {
  const n = 2 ** ZOOM;
  const x = ((lng + 180) / 360) * n;
  const la = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n;
  return { tx: Math.floor(x), ty: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

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
      await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      setOrders((p) => (p || []).map((x) => (x.id === o.id ? { ...x, status } : x)));
    } catch (e) { setErr((e as Error).message); }
  }

  const counts = useMemo(() => ({
    nouvelle: (orders || []).filter((o) => (o.status || "nouvelle") === "nouvelle").length,
    traitee: (orders || []).filter((o) => o.status === "traitee").length,
    annulee: (orders || []).filter((o) => o.status === "annulee").length,
  }), [orders]);

  const list = (orders || []).filter((o) => (o.status || "nouvelle") === tab);
  const caTotal = (orders || [])
    .filter((o) => o.status === "traitee")
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

      {/* Récapitulatif */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 22 }}>
        <Kpi label="Nouvelles" value={String(counts.nouvelle)} hint="à traiter" accent={counts.nouvelle > 0} />
        <Kpi label="Traitées" value={String(counts.traitee)} hint="confirmées" />
        <Kpi label="Montant traité" value={money(caTotal, (orders || [])[0]?.currency)} hint="hors annulées" />
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "1px solid var(--cl-line)", background: tab === t.key ? "#101012" : "#fff",
              color: tab === t.key ? "#fff" : "var(--cl-sub)" }}>
            {t.label} · {counts[t.key as keyof typeof counts]}
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
          {list.map((o) => <OrderCard key={o.id} order={o} onChange={change} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order: o, onChange }: { order: Order; onChange: (o: Order, s: string) => void }) {
  const items: Item[] = Array.isArray(o.items)
    ? o.items
    : (() => { try { return JSON.parse(String(o.items || "[]")); } catch { return []; } })();

  const phone = String(o.contact_phone || "").replace(/@c\.us$/, "");
  const hasGeo = o.lat != null && o.lng != null;
  const lieu = o.place_label || o.address || (hasGeo ? `${Number(o.lat).toFixed(5)}, ${Number(o.lng).toFixed(5)}` : "");

  return (
    <div style={{ border: "1px solid var(--cl-line)", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 16, padding: 16, flexWrap: "wrap" }}>
        {/* Détail */}
        <div style={{ flex: "1 1 320px", minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <strong style={{ fontSize: 15, color: "var(--cl-ink)" }}>n° {o.ref}</strong>
            <span style={{ background: STATUS_BG[o.status] || "#101012", color: "#fff", borderRadius: 999,
              padding: "2px 10px", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>
              {String(o.status || "nouvelle").toUpperCase()}
            </span>
            {o.note && (
              <span style={{ background: "#F3F7E4", color: "#4A6B00", borderRadius: 999,
                padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                {o.note}
              </span>
            )}
          </div>

          <div style={{ marginBottom: 8 }}>
            {items.map((it, i) => (
              <div key={i} style={{ fontSize: 13.5, color: "var(--cl-ink)" }}>
                {i + 1}. {it.name}{it.variant ? ` — ${it.variant}` : ""} ×{it.qty || 1}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--cl-ink)" }}>{money(o.total, o.currency)}</div>
          <div style={{ fontSize: 12, color: "var(--cl-sub)", marginTop: 3 }}>
            {o.customer_name ? `${o.customer_name} · ` : ""}{phone} ·{" "}
            {new Date(o.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {phone && (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                  background: "#E4F8EC", color: "#0e6b45", textDecoration: "none" }}>
                Répondre sur WhatsApp
              </a>
            )}
            {o.status !== "traitee" && (
              <button onClick={() => onChange(o, "traitee")}
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: "none", background: "#101012", color: "#fff" }}>
                Marquer traitée
              </button>
            )}
            {o.status !== "annulee" && (
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
            {hasGeo && <MapPreview lat={Number(o.lat)} lng={Number(o.lng)} />}
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
          </div>
        )}
      </div>
    </div>
  );
}

function MapPreview({ lat, lng }: { lat: number; lng: number }) {
  const height = 120;
  const { tx, ty, fx, fy } = tileOf(lat, lng);
  const uris = [-1, 0, 1].map((d) => `https://tile.openstreetmap.org/${ZOOM}/${tx + d}/${ty}.png`);
  return (
    <div style={{ position: "relative", height, overflow: "hidden", background: "#E8E8E8",
      border: "1px solid var(--cl-line)", borderBottom: "none", borderRadius: "10px 10px 0 0" }}>
      <div style={{ display: "flex", position: "absolute", top: -(fy * TILE - height / 2), left: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {uris.map((u) => <img key={u} src={u} alt="" width={TILE} height={TILE} />)}
      </div>
      <div style={{ position: "absolute", left: TILE + fx * TILE - 7, top: height / 2 - 20, fontSize: 22 }}>📍</div>
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
