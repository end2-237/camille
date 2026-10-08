// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/insights/page.tsx
// OUTIL INTERNE — qualité du modèle : précision, cohérence, zones de friction.
// Analyse par DISCUSSION entière (pas message par message).
// L'API renvoie 403 si le compte n'est pas administrateur (is_admin).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Filter, MessageCircleQuestion, MessagesSquare, Repeat, RefreshCw, ShieldCheck, Split, Target,
} from "lucide-react";
import { authHeaders } from "@/lib/auth-client";
import { Bandeau, BoutonRond, Filtres, Pastille, Squelettes, StylesUI, Tuile, Vide, apparait } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

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

/** Les périodes proposées : la clé part telle quelle à l'API. */
const PERIODES = [
  { cle: "7d", libelle: "7 jours" },
  { cle: "30d", libelle: "30 jours" },
  { cle: "90d", libelle: "90 jours" },
];

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
  const libellePeriode = PERIODES.find((p) => p.cle === period)?.libelle ?? period;

  const confusions = data?.confusions ?? [];
  const causes = data?.causes ?? [];
  const signatures = data?.signatures ?? [];
  const questions = data?.questions_sans_reponse ?? [];
  const precisionFaible = precision != null && precision < 85;
  const frictionForte = (data?.taux_friction ?? 0) >= 40;

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />

      {/* ── En-tête : de quoi il s'agit, et sur quelle période ──────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Pastille ton="violet"><ShieldCheck className="h-3.5 w-3.5" /> Outil interne</Pastille>
          <p className="min-w-0 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
            Non visible par les clients.
          </p>
        </div>
        <div className="flex min-w-0 max-w-full items-center gap-2">
          <Filtres id="insights-periode" label="Période" valeur={period} onChange={setPeriod} options={PERIODES} />
          <BoutonRond icone={RefreshCw} label="Actualiser" onClick={load} disabled={busy} tourne={busy} />
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
        Analyse chaque discussion dans son ensemble pour mesurer la précision
        et la cohérence de l&apos;agent.
      </p>

      <div className="mt-6">
        {data?.error ? (
          <Bandeau ton="rouge">{data.error}</Bandeau>
        ) : data === null ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => <div key={i} className="ui-squelette h-[130px] rounded-[26px]" style={{ animationDelay: `${i * 120}ms` }} />)}
            </div>
            <Squelettes n={2} hauteur={220} />
          </div>
        ) : (
          <>
            {/* ── KPIs qualité ─────────────────────────────────────────────── */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Tuile rang={0} fort icone={Target} titre="Précision du modèle"
                valeur={precision != null ? `${precision}%` : "—"}
                sous={
                  <span className="flex flex-wrap items-center gap-1.5">
                    {data?.tours_corriges ?? 0} tours corrigés / {data?.tours_analyses ?? 0}
                    {precisionFaible && <Pastille ton="rouge" point>Sous 85 %</Pastille>}
                  </span>
                } />
              <Tuile rang={1} icone={MessagesSquare} titre="Discussions analysées"
                valeur={String(data?.conversations ?? 0)} sous={`Sur ${libellePeriode}`} />
              <Tuile rang={2} icone={Activity} titre="Avec friction"
                valeur={<span style={{ color: frictionForte ? "#A63D28" : undefined }}>{data?.taux_friction ?? 0}%</span>}
                sous={
                  <span className="flex flex-wrap items-center gap-1.5">
                    {data?.avec_friction ?? 0} discussions
                    {frictionForte && <Pastille ton="rouge" point>Élevé</Pastille>}
                  </span>
                } />
            </div>

            {data?.note && <div className="mt-4"><Bandeau ton="violet">{data.note}</Bandeau></div>}

            {data?.empty ? (
              <div className="mt-6">
                <Vide doodle="meditating" titre="Rien à analyser sur la période."
                  texte="Dès que l'agent aura mené quelques discussions, leur qualité s'affichera ici." />
              </div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="min-w-0 space-y-6">
                  {/* ── Entonnoir ───────────────────────────────────────────── */}
                  <Section rang={3} icone={Filter} title="Parcours — où les discussions décrochent">
                    <div className="space-y-4">
                      {funnel.map((f, i) => {
                        const prev = i > 0 ? funnel[i - 1].conversations : f.conversations;
                        const drop = prev > 0 ? Math.round(((prev - f.conversations) / prev) * 100) : 0;
                        const bigDrop = i > 0 && drop >= 40;
                        return (
                          <div key={f.etape}>
                            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                              <span className="min-w-0 truncate font-medium" style={{ color: "var(--cl-ink)" }}>{STEP_LABEL[f.etape] || f.etape}</span>
                              <span className="flex-shrink-0 tabular-nums" style={{ color: "var(--cl-ink-faint)" }}>{f.conversations} · {f.pourcentage}%</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full" style={{ background: "#F1EFF4" }}>
                              <motion.div className="h-full rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round((f.conversations / maxConv) * 100)}%` }}
                                transition={{ ...RESSORT, delay: Math.min(i, 8) * 0.05 }}
                                style={{ background: bigDrop ? "linear-gradient(90deg, #E8907D, #C2504B)" : "linear-gradient(90deg, #8F75F6, #B6A4FA)" }} />
                            </div>
                            {bigDrop && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "#A63D28" }}>
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {drop}% des discussions s&apos;arrêtent à cette étape
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {!funnel.length && <Empty />}
                  </Section>

                  {/* ── Causes de friction ─────────────────────────────────── */}
                  <Section rang={5} icone={AlertTriangle} title="Causes de friction (par discussion)">
                    <div className="space-y-2.5">
                      {causes.map((c) => (
                        <div key={c.cause} className="rounded-[20px] p-4" style={{ background: "#FAF9FC" }}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{CAUSE_LABEL[c.cause] || c.cause}</p>
                            <Pastille ton="ambre">{c.conversations} disc.</Pastille>
                          </div>
                          {(c.exemples ?? []).slice(0, 2).map((ex, i) => (
                            <p key={i} className="mt-2 rounded-[14px] bg-white px-3 py-2 text-[12.5px] italic leading-relaxed break-words" style={{ color: "var(--cl-ink-soft)" }}>
                              « {ex} »
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                    {!causes.length && <Empty />}
                  </Section>
                </div>

                <div className="min-w-0 space-y-6">
                  {/* ── Confusions du modèle : LLM -> intention retenue ────── */}
                  <Section rang={4} icone={Split} title="Erreurs d'intention du modèle (proposée → retenue)">
                    <p className="-mt-1 mb-4 text-[12.5px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
                      Chaque ligne est une correction appliquée par l&apos;Ancrage. Plus le compte est élevé,
                      plus le modèle se trompe systématiquement sur ce cas — c&apos;est une règle à ajouter ou un prompt à ajuster.
                    </p>
                    <div className="space-y-2">
                      {confusions.map((c) => (
                        <LigneCompte key={c.paire} texte={c.paire} compte={c.count} ton="rouge" />
                      ))}
                    </div>
                    {!confusions.length && <Empty />}
                  </Section>

                  {/* ── Scénarios répétés ─────────────────────────────────── */}
                  <Section rang={6} icone={Repeat} title="Scénarios qui se répètent (signatures)">
                    <div className="space-y-2">
                      {signatures.map((s, i) => (
                        <LigneCompte key={i} texte={s.signature} compte={s.count} ton={s.issue === "abandon" ? "rouge" : "gris"} />
                      ))}
                    </div>
                    {!signatures.length && <Empty />}
                  </Section>

                  {/* ── Demandes sans réponse ─────────────────────────────── */}
                  <Section rang={7} icone={MessageCircleQuestion} title="Demandes restées sans réponse">
                    <ul className="divide-y" style={{ borderColor: "var(--cl-line-soft)" }}>
                      {questions.map((q, i) => (
                        <li key={i} className="flex items-center gap-3 py-2.5 text-[13px]" style={{ borderColor: "var(--cl-line-soft)" }}>
                          <span className="w-12 flex-shrink-0"><Pastille ton="rouge">×{q.count}</Pastille></span>
                          <span className="min-w-0 break-words" style={{ color: "var(--cl-ink)" }}>{q.question}</span>
                        </li>
                      ))}
                    </ul>
                    {!questions.length && <Empty />}
                  </Section>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Une paire ou une signature technique, avec le nombre de fois où elle revient. */
function LigneCompte({ texte, compte, ton }: { texte: string; compte: number; ton: "rouge" | "gris" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] px-4 py-2.5" style={{ background: "#FAF9FC" }}>
      <code className="min-w-0 break-all font-mono text-[12.5px]" style={{ color: "var(--cl-ink)" }}>{texte}</code>
      <Pastille ton={ton}>×{compte}</Pastille>
    </div>
  );
}

function Section({ title, icone: Icone, rang = 0, children }: {
  title: string; icone: React.ElementType; rang?: number; children: React.ReactNode;
}) {
  return (
    <motion.section {...apparait(rang)} className="rounded-[28px] bg-white p-5 sm:p-6" style={{ border: "1px solid var(--cl-line-soft)" }}>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
          <Icone className="h-4 w-4" />
        </span>
        <h2 className="min-w-0 text-[16px] font-medium leading-snug tracking-[-0.015em]" style={{ color: "var(--cl-ink)" }}>{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function Empty() {
  return (
    <p className="rounded-[18px] px-4 py-5 text-center text-[13px]" style={{ background: "#FAF9FC", color: "var(--cl-ink-faint)" }}>
      Aucune donnée sur la période.
    </p>
  );
}
