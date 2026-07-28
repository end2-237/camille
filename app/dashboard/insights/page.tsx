// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/insights/page.tsx
// OUTIL INTERNE — qualité du modèle : précision, cohérence, zones de friction.
// Analyse par DISCUSSION entière (pas message par message).
// L'API renvoie 403 si le compte n'est pas listé dans INSIGHTS_ADMIN_EMAILS.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback } from "react";
import { authHeaders } from "@/lib/auth-client";

type Funnel = { etape: string; conversations: number; pourcentage: number };
type Cause = { cause: string; conversations: number; exemples: string[] };
type Sig = { signature: string; count: number; issue: string };
type Conf = { paire: string; count: number };

type Data = {
  error?: string; note?: string; empty?: boolean;
  precision_modele?: number; tours_analyses?: number; tours_corriges?: number;
  conversations?: number; avec_friction?: number; taux_friction?: number;
  entonnoir?: Funnel[]; causes?: Cause[]; signatures?: Sig[];
  confusions?: Conf[]; questions_sans_reponse?: { question: string; count: number }[];
};

const STEP_LABEL: Record<string, string> = {
  contact: "Premier contact", decouverte: "Découverte", interet: "Intérêt produit",
  question: "Question (prix, stock…)", panier: "Panier", commande: "Commande",
};
const CAUSE_LABEL: Record<string, string> = {
  intention_mal_comprise: "Intention mal comprise (modèle)",
  client_se_repete: "Le client se répète (réponse peu claire)",
  produit_introuvable: "Produit introuvable (catalogue ou recherche)",
  correction_explicite: "Le client corrige l'agent",
  abandon_apres_interet: "Abandon après intérêt",
  passage_humain: "Demande un humain (cas non couvert)",
};

export default function InsightsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState("30d");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/analytics/conversations?period=${period}`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setData(r.ok ? d : { error: d.error || `Erreur ${r.status}` });
    } catch (e) {
      setData({ error: (e as Error).message });
    } finally { setBusy(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const funnel = data?.entonnoir ?? [];
  const maxConv = Math.max(1, ...funnel.map((f) => f.conversations));
  const precision = data?.precision_modele ?? null;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--cl-ink)" }}>Qualité du modèle</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["7d", "30d", "90d"].map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "1px solid var(--cl-line)", background: period === p ? "#101012" : "#fff",
                color: period === p ? "#fff" : "var(--cl-sub)" }}>
              {p}
            </button>
          ))}
          <button onClick={load} disabled={busy}
            style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "1px solid var(--cl-line)", background: "#fff", color: "var(--cl-ink)" }}>
            {busy ? "…" : "Actualiser"}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--cl-sub)", marginBottom: 20 }}>
        Outil interne — analyse chaque discussion dans son ensemble pour mesurer la précision
        et la cohérence de l&apos;agent. Non visible par les clients.
      </p>

      {data?.error && (
        <div style={{ padding: 16, borderRadius: 12, background: "#FDECEC", color: "#c0392b", fontSize: 13.5 }}>
          {data.error}
        </div>
      )}

      {!data?.error && (
        <>
          {/* KPIs qualité */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
            <Kpi label="Précision du modèle" value={precision != null ? `${precision}%` : "—"}
                 hint={`${data?.tours_corriges ?? 0} tours corrigés / ${data?.tours_analyses ?? 0}`}
                 danger={precision != null && precision < 85} />
            <Kpi label="Discussions analysées" value={String(data?.conversations ?? 0)} hint={period} />
            <Kpi label="Avec friction" value={`${data?.taux_friction ?? 0}%`}
                 hint={`${data?.avec_friction ?? 0} discussions`} danger={(data?.taux_friction ?? 0) >= 40} />
          </div>

          {/* Entonnoir */}
          <Section title="Parcours — où les discussions décrochent">
            {funnel.map((f, i) => {
              const prev = i > 0 ? funnel[i - 1].conversations : f.conversations;
              const drop = prev > 0 ? Math.round(((prev - f.conversations) / prev) * 100) : 0;
              const bigDrop = i > 0 && drop >= 40;
              return (
                <div key={f.etape} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: "var(--cl-ink)", fontWeight: 600 }}>{STEP_LABEL[f.etape] || f.etape}</span>
                    <span style={{ color: "var(--cl-sub)" }}>{f.conversations} · {f.pourcentage}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: "#EEE", overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((f.conversations / maxConv) * 100)}%`, height: 10,
                      background: bigDrop ? "#e74c3c" : "#0e9d63" }} />
                  </div>
                  {bigDrop && (
                    <div style={{ fontSize: 11.5, color: "#c0392b", marginTop: 4 }}>
                      ↓ {drop}% des discussions s&apos;arrêtent à cette étape
                    </div>
                  )}
                </div>
              );
            })}
            {!funnel.length && <Empty />}
          </Section>

          {/* Confusions du modèle : LLM -> intention retenue */}
          <Section title="Erreurs d'intention du modèle (proposée → retenue)">
            <p style={{ fontSize: 12.5, color: "var(--cl-sub)", marginBottom: 12 }}>
              Chaque ligne est une correction appliquée par l&apos;Ancrage. Plus le compte est élevé,
              plus le modèle se trompe systématiquement sur ce cas — c&apos;est une règle à ajouter ou un prompt à ajuster.
            </p>
            {(data?.confusions ?? []).map((c) => (
              <div key={c.paire} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 12px", borderRadius: 8, background: "#F7F7F8", marginBottom: 6 }}>
                <code style={{ fontSize: 12.5, color: "var(--cl-ink)" }}>{c.paire}</code>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#c0392b" }}>×{c.count}</span>
              </div>
            ))}
            {!(data?.confusions ?? []).length && <Empty />}
          </Section>

          {/* Causes de friction */}
          <Section title="Causes de friction (par discussion)">
            {(data?.causes ?? []).map((c) => (
              <div key={c.cause} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--cl-line)", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 13.5, color: "var(--cl-ink)" }}>{CAUSE_LABEL[c.cause] || c.cause}</strong>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{c.conversations} disc.</span>
                </div>
                {(c.exemples ?? []).slice(0, 2).map((ex, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--cl-sub)", marginTop: 5, fontStyle: "italic" }}>« {ex} »</div>
                ))}
              </div>
            ))}
            {!(data?.causes ?? []).length && <Empty />}
          </Section>

          {/* Scénarios répétés */}
          <Section title="Scénarios qui se répètent (signatures)">
            {(data?.signatures ?? []).map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cl-line)", marginBottom: 6 }}>
                <code style={{ fontSize: 12.5 }}>{s.signature}</code>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.issue === "abandon" ? "#c0392b" : "var(--cl-sub)" }}>
                  ×{s.count}
                </span>
              </div>
            ))}
            {!(data?.signatures ?? []).length && <Empty />}
          </Section>

          {/* Demandes sans réponse */}
          <Section title="Demandes restées sans réponse">
            {(data?.questions_sans_reponse ?? []).map((q, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: "#c0392b", minWidth: 34 }}>×{q.count}</span>
                <span style={{ color: "var(--cl-ink)" }}>{q.question}</span>
              </div>
            ))}
            {!(data?.questions_sans_reponse ?? []).length && <Empty />}
          </Section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--cl-line)", background: "#fff" }}>
      <div style={{ fontSize: 12, color: "var(--cl-sub)" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: danger ? "#c0392b" : "var(--cl-ink)" }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--cl-sub)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26, padding: 18, borderRadius: 14, border: "1px solid var(--cl-line)", background: "#fff" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--cl-ink)", marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 13, color: "var(--cl-sub)" }}>Aucune donnée sur la période.</div>;
}
