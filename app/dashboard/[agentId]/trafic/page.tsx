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
import { motion } from "framer-motion";
import { authHeaders } from "@/lib/auth-client";
import { Check, Code2, Copy, Eye, Globe2, Info, MonitorSmartphone, MousePointerClick, Package, Percent, RefreshCw, ShoppingBag, Users, FileText } from "lucide-react";
import { Bandeau, BoutonRond, Filtres, Pastille, StylesUI, Tuile, apparait } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

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

  // Lue après le montage : le serveur ne connaît pas l'adresse du site, et un
  // texte différent entre serveur et navigateur casse l'hydratation.
  const [base, setBase] = useState("");
  useEffect(() => { setBase(window.location.origin); }, []);
  const snippet = `<script src="${base}/api/public/v1/track" data-key="cam_pk_…" defer></script>`;

  const t = data?.totals;
  const maxView = Math.max(1, ...(data?.series ?? []).map((s) => s.views));
  const serie = data?.series ?? [];
  // Sur 90 jours, une étiquette par barre ne tient pas : on n'en garde qu'une
  // sur quelques-unes, la barre seule suffit entre deux.
  const pas = Math.max(1, Math.ceil(serie.length / 7));

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />

      {/* ── La période, le direct, l'actualisation ────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-full">
          <Filtres id="trafic-periode" label="Période" valeur={String(days)} onChange={(v) => setDays(Number(v))}
            options={RANGES.map((r) => ({ cle: String(r.days), libelle: r.label }))} />
        </div>
        <div className="flex items-center gap-2">
          {!!t?.online && (
            <Pastille ton="vert">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#1E7A3A" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#1E7A3A" }} />
              </span>
              {t.online} en ligne
            </Pastille>
          )}
          <BoutonRond icone={RefreshCw} label="Actualiser" tourne={loading} onClick={load} />
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-[14px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
        Ce que fait le site branché à Camille : qui vient, par où, ce qu&apos;on y regarde,
        et combien de visites finissent en commande.
      </p>

      {data && !data.ready && (
        <div className="mt-4"><Bandeau ton="ambre">{data.error || "Mesure indisponible."}</Bandeau></div>
      )}

      {/* ── Les chiffres ──────────────────────────────────────────────────── */}
      {t ? (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Tuile rang={0} icone={Users} titre="Visiteurs" valeur={nf(t.visitors)} sous={`${nf(t.sessions)} visite(s)`} />
          <Tuile rang={1} icone={Eye} titre="Pages vues" valeur={nf(t.views)} sous={t.visitors ? `${(t.views / t.visitors).toFixed(1)} par visiteur` : "—"} />
          <Tuile rang={2} icone={ShoppingBag} titre="Commandes du site" valeur={nf(t.orders)} sous={money(t.revenue)} fort />
          <Tuile rang={3} icone={Percent} titre="Conversion" valeur={`${t.conversion} %`} sous={`${nf(t.carts)} panier(s) · ${nf(t.checkouts)} paiement(s) entamé(s)`} />
        </div>
      ) : loading && !data ? (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="ui-squelette h-[124px] rounded-[26px]" style={{ animationDelay: `${i * 120}ms` }} />)}
        </div>
      ) : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* ── Colonne principale : la courbe et les classements ─────────────── */}
        {t && data ? (
          <div className="min-w-0 space-y-5">
            {/* Courbe simple : une barre par jour, la hauteur dit tout. */}
            <motion.section {...apparait(4)} className="ui-carte rounded-[28px] p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[17px] font-medium tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>Fréquentation, jour par jour</h2>
                <span className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>pages vues</span>
              </div>
              {serie.length === 0 ? (
                <p className="mt-4 rounded-[20px] px-4 py-6 text-center text-[13.5px]" style={{ background: "#FAF9FC", color: "var(--cl-ink-faint)" }}>
                  Aucune visite mesurée sur la période.
                </p>
              ) : (
                <div className={`mt-5 flex h-[190px] items-end ${serie.length > 31 ? "gap-[2px]" : serie.length > 14 ? "gap-1" : "gap-2"}`}>
                  {serie.map((s, i) => (
                    <div key={s.day} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                      <span className="whitespace-nowrap text-[11px] font-medium tabular-nums opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--cl-accent-deep)" }}>
                        {nf(s.views)}
                      </span>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: Math.max(4, (s.views / maxView) * 130) }}
                        transition={{ ...RESSORT, delay: Math.min(i, 30) * 0.012 }}
                        className="trafic-barre w-full max-w-[44px] rounded-full"
                        title={`${dayLabel(s.day)} — ${nf(s.views)} pages vues, ${nf(s.visitors)} visiteurs`}
                      />
                      <span className="h-4 max-w-full truncate text-[10.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                        {i % pas === 0 ? dayLabel(s.day) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>

            <div className="grid gap-5 md:grid-cols-2">
              <Table rang={5} icone={FileText} title="Pages les plus vues" empty="Rien encore."
                rows={data.pages.map((p) => ({ label: p.path, value: nf(p.views), n: p.views }))} />
              <Table rang={6} icone={Globe2} title="D'où viennent les visiteurs" empty="Rien encore."
                rows={data.sources.map((s) => ({ label: s.source, value: nf(s.visitors), n: s.visitors }))} />
              <Table rang={7} icone={Package} title="Produits les plus consultés" empty="Le site n'envoie pas encore d'événement « produit consulté »."
                rows={data.products.map((p) => ({ label: p.name, value: nf(p.views), n: p.views }))} />
              <Table rang={8} icone={MonitorSmartphone} title="Appareils" empty="Rien encore."
                rows={data.devices.map((d) => ({ label: d.device, value: nf(d.visitors), n: d.visitors }))} />
            </div>
          </div>
        ) : <div className="hidden lg:block" />}

        {/* Installation : une ligne à coller, valable pour n'importe quel site. */}
        <motion.aside {...apparait(5)} className="ui-carte min-w-0 rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-24">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
              <Code2 className="h-[18px] w-[18px]" />
            </span>
            <h2 className="pt-2 text-[17px] font-medium leading-tight tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>Brancher la mesure sur un site</h2>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
            Colle cette ligne avant <Code>&lt;/body&gt;</Code>, avec la clé de lecture de l&apos;agent
            (Intégrations → clé <Code>cam_pk_…</Code>). Elle suit aussi les sites qui changent
            de page sans recharger.
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-[22px] p-2 pl-4" style={{ background: "#FAF9FC" }}>
            <code className="min-w-0 flex-1 py-2 font-mono text-[12px] leading-relaxed" style={{ color: "var(--cl-ink)", overflowWrap: "anywhere" }}>{snippet}</code>
            <BoutonRond
              icone={copied ? Check : Copy}
              label={copied ? "Copié" : "Copier"}
              style={copied ? { background: "#E4F6EA", color: "#1E7A3A", boxShadow: "none" } : undefined}
              onClick={() => {
                navigator.clipboard?.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            />
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-[20px] p-4 text-[12.5px] leading-relaxed" style={{ background: "#F7F4FF", color: "var(--cl-ink-soft)" }}>
            <MousePointerClick className="mt-[3px] h-4 w-4 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
            <p className="min-w-0">
              Le site peut aussi signaler ses propres moments : <Code>camille(&quot;product_view&quot;, {"{ name: \"Poulet DG\" }"})</Code>,
              <Code> camille(&quot;add_to_cart&quot;)</Code>, <Code>camille(&quot;checkout_start&quot;)</Code>.
            </p>
          </div>
          <p className="mt-3 flex items-start gap-2 px-1 text-[12px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
            <Info className="mt-[3px] h-3.5 w-3.5 flex-shrink-0" />
            Aucun cookie, aucune adresse IP : le visiteur n&apos;est qu&apos;un identifiant aléatoire.
          </p>
        </motion.aside>
      </div>

      <style jsx global>{`
        .trafic-barre { background: #DCD2FD; transition: background-color .2s ease; }
        .group:hover .trafic-barre { background: var(--cl-accent); }
      `}</style>
    </div>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-full px-1.5 py-0.5 font-mono text-[11.5px]" style={{ background: "#F1EFF4", color: "var(--cl-ink)", overflowWrap: "anywhere" }}>{children}</code>
);

function Table({ title, rows, empty, icone: Icone, rang = 0 }: {
  title: string; rows: { label: string; value: string; n: number }[]; empty: string;
  icone: React.ElementType; rang?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n || 0));
  return (
    <motion.section {...apparait(rang)} className="ui-carte min-w-0 rounded-[28px] p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
          <Icone className="h-4 w-4" />
        </span>
        <h2 className="min-w-0 truncate text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-[18px] px-4 py-4 text-[13px] leading-relaxed" style={{ background: "#FAF9FC", color: "var(--cl-ink-faint)" }}>{empty}</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="relative overflow-hidden rounded-full">
              {/* La jauge derrière la ligne : on compare d'un coup d'œil. */}
              <motion.span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full" style={{ background: "#F3EFFE" }}
                initial={{ width: 0 }} animate={{ width: `${Math.max(6, ((r.n || 0) / max) * 100)}%` }} transition={{ ...RESSORT, delay: Math.min(i, 10) * 0.03 }} />
              <span className="relative flex items-center justify-between gap-3 px-3.5 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--cl-ink)" }} title={r.label}>{r.label}</span>
                <span className="flex-shrink-0 font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>{r.value}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
