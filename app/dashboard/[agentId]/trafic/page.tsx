"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Trafic — ce qui se passe sur le site branché à Camille.
//
// Un marchand qui intègre son site voyait ses commandes, jamais ses visites :
// impossible de distinguer « personne ne vient » de « tout le monde repart du
// panier ». Cette page répond aux quatre questions qu'il se pose vraiment :
// combien de monde, d'où, quelles pages, et combien ont commandé.
//
// Rien n'est propre à un métier : n'importe quel site colle la balise et
// apparaît ici.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";
import { Check, Copy, Info, Loader2, RefreshCw } from "lucide-react";

type Traffic = {
  ready: boolean;
  error?: string;
  days: number;
  totals: {
    views: number; visitors: number; sessions: number; carts: number;
    checkouts: number; orders: number; revenue: number; conversion: number; online: number;
  };
  series: { day: string; views: number; visitors: number }[];
  pages: { path: string; views: number; visitors: number }[];
  sources: { source: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  products: { name: string; views: number }[];
};

const RANGES = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
];

const nf = (n: number) => Number(n || 0).toLocaleString("fr-FR");
const money = (n: number) => `${nf(n)} XAF`;

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export default function TraficPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Traffic | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/site-traffic?days=${days}`, { headers: { ...authHeaders() } });
      setData(await r.json());
    } catch (e) {
      setData({ ready: false, error: (e as Error).message } as Traffic);
    } finally {
      setLoading(false);
    }
  }, [agentId, days]);

  useEffect(() => { load(); }, [load]);

  // Le compteur des visiteurs présents ne vaut que s'il est frais.
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<script src="${base}/api/public/v1/track" data-key="cam_pk_…" defer></script>`;

  const t = data?.totals;
  const maxView = Math.max(1, ...(data?.series ?? []).map((s) => s.views));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Trafic du site</h1>
          <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-[var(--cl-sub)]">
            Ce que fait le site branché à Camille : qui vient, par où, ce qu&apos;on y regarde,
            et combien de visites finissent en commande.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!!t?.online && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F8EC] px-3 py-1.5 text-[12.5px] font-semibold text-[#0e6b45]">
              <span className="h-2 w-2 rounded-full bg-[#0e9d63]" />
              {t.online} en ligne
            </span>
          )}
          <button
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--cl-line)] bg-white px-4 text-[12.5px] font-semibold"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </button>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              days === r.days ? "bg-[#101012] text-white" : "bg-[#F4F4F5] text-[var(--cl-sub)] hover:bg-[#EAEAEB]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {data && !data.ready && (
        <div className="mt-5 rounded-2xl border border-[#F3D5A5] bg-[#FDF7E7] p-4 text-[13px] text-[#8A5A00]">
          {data.error || "Mesure indisponible."}
        </div>
      )}

      {t && (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Visiteurs" value={nf(t.visitors)} hint={`${nf(t.sessions)} visite(s)`} />
            <Kpi label="Pages vues" value={nf(t.views)} hint={t.visitors ? `${(t.views / t.visitors).toFixed(1)} par visiteur` : "—"} />
            <Kpi label="Commandes du site" value={nf(t.orders)} hint={money(t.revenue)} accent />
            <Kpi label="Conversion" value={`${t.conversion} %`} hint={`${nf(t.carts)} panier(s) · ${nf(t.checkouts)} paiement(s) entamé(s)`} />
          </section>

          {/* Courbe simple : une barre par jour, la hauteur dit tout. */}
          <section className="mt-5 rounded-2xl border border-[var(--cl-line)] bg-white p-5">
            <h2 className="text-[14px] font-semibold">Fréquentation, jour par jour</h2>
            {data.series.length === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--cl-sub)]">
                Aucune visite mesurée sur la période.
              </p>
            ) : (
              <div className="mt-4 flex h-[160px] items-end gap-1.5">
                {data.series.map((s) => (
                  <div key={s.day} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[10.5px] font-semibold text-[var(--cl-sub)] opacity-0 transition group-hover:opacity-100">
                      {nf(s.views)}
                    </span>
                    <div
                      className="w-full rounded-t-[4px] bg-[#101012] transition group-hover:bg-[#C6F24E]"
                      style={{ height: `${Math.max(3, (s.views / maxView) * 118)}px` }}
                      title={`${dayLabel(s.day)} — ${nf(s.views)} pages vues, ${nf(s.visitors)} visiteurs`}
                    />
                    <span className="truncate text-[10px] text-[var(--cl-sub)]">{dayLabel(s.day)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Table
              title="Pages les plus vues"
              empty="Rien encore."
              rows={data.pages.map((p) => ({ label: p.path, value: nf(p.views) }))}
            />
            <Table
              title="D'où viennent les visiteurs"
              empty="Rien encore."
              rows={data.sources.map((s) => ({ label: s.source, value: nf(s.visitors) }))}
            />
            <Table
              title="Produits les plus consultés"
              empty="Le site n'envoie pas encore d'événement « produit consulté »."
              rows={data.products.map((p) => ({ label: p.name, value: nf(p.views) }))}
            />
            <Table
              title="Appareils"
              empty="Rien encore."
              rows={data.devices.map((d) => ({ label: d.device, value: nf(d.visitors) }))}
            />
          </div>
        </>
      )}

      {/* Installation : une ligne à coller, valable pour n'importe quel site. */}
      <section className="mt-6 rounded-2xl border border-[var(--cl-line)] bg-white p-5">
        <h2 className="text-[14px] font-semibold">Brancher la mesure sur un site</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--cl-sub)]">
          Colle cette ligne avant <code>&lt;/body&gt;</code>, avec la clé de lecture de l&apos;agent
          (Intégrations → clé <code>cam_pk_…</code>). Elle suit aussi les sites qui changent
          de page sans recharger.
        </p>
        <div className="mt-3 flex items-start gap-2">
          <code className="flex-1 overflow-auto rounded-lg bg-[var(--cl-bg-soft)] p-3 text-[11.5px]">{snippet}</code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--cl-line)] px-3 text-[12px] font-semibold"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--cl-sub)]">
          <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          Le site peut aussi signaler ses propres moments : <code>camille(&quot;product_view&quot;, {"{ name: \"Poulet DG\" }"})</code>,
          <code> camille(&quot;add_to_cart&quot;)</code>, <code>camille(&quot;checkout_start&quot;)</code>.
          Aucun cookie, aucune adresse IP : le visiteur n&apos;est qu&apos;un identifiant aléatoire.
        </p>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--cl-line)", background: accent ? "#101012" : "#fff" }}
    >
      <div className="text-[11.5px] font-semibold" style={{ color: accent ? "rgba(255,255,255,.6)" : "var(--cl-sub)" }}>
        {label}
      </div>
      <div className="mt-1 text-[26px] font-bold" style={{ color: accent ? "#C6F24E" : "var(--cl-ink)" }}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11.5px]" style={{ color: accent ? "rgba(255,255,255,.5)" : "var(--cl-sub)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Table({ title, rows, empty }: { title: string; rows: { label: string; value: string }[]; empty: string }) {
  return (
    <section className="rounded-2xl border border-[var(--cl-line)] bg-white p-5">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--cl-sub)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-[var(--cl-ink)]">{r.label}</span>
              <span className="shrink-0 font-semibold">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
