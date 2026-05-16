// ─────────────────────────────────────────────────────────────────────────────
// app/pricing/page.tsx — Camille by Buyticle
// Plans chargés depuis /api/plans (base de données) — zéro valeur hardcodée.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import Link                             from "next/link";
import {
  Check, Minus, Sparkles, Zap, MessageCircle, Brain,
  BarChart3, Users, Target, Megaphone, Image, ChevronDown,
  ChevronUp, Info, RefreshCw,
} from "lucide-react";
import type { DbPlan, DbCapability } from "@/lib/plans-db";

// ── Icon map (icon field stocké en DB → composant lucide) ─────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  MessageCircle, Brain, Zap, Target, Sparkles,
  BarChart3, Megaphone, Users, Image,
};

function CapIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] ?? Zap;
  return <Icon className={className} style={style} />;
}

// ── FAQ (statique — pas besoin de DB) ────────────────────────────────────────

const FAQ = [
  {
    q: "Qu'est-ce qu'un token ?",
    a: "Un token est l'unité de mesure utilisée par les modèles d'IA. En français, 1 token ≈ 0,75 mot. Un message WhatsApp moyen consomme entre 400 et 800 tokens (prompt + réponse du bot). L'historique de conversation et les capacités avancées augmentent ce nombre.",
  },
  {
    q: "Pourquoi facturer en tokens plutôt qu'en messages ?",
    a: "La consommation réelle dépend de la complexité des échanges. Un bot avec historique de 200 messages consomme 4× plus de tokens qu'un bot sans contexte. La facturation au token est donc plus juste pour vous.",
  },
  {
    q: "Que se passe-t-il si je dépasse ma limite mensuelle ?",
    a: "Le bot cesse de répondre automatiquement et envoie un message poli à vos contacts. Vous êtes alerté dans le dashboard dès 80% de consommation. Vous pouvez upgrader votre plan à tout moment pour rétablir le service immédiatement.",
  },
  {
    q: "Quels opérateurs Mobile Money sont acceptés ?",
    a: "Le paiement est traité par Monetbil. MTN Mobile Money, Orange Money, Wave, Airtel Money et la plupart des opérateurs d'Afrique centrale et de l'Ouest sont acceptés.",
  },
  {
    q: "Puis-je changer de plan à tout moment ?",
    a: "Oui. L'upgrade est immédiat dès confirmation du paiement. Votre nouveau quota de tokens est disponible instantanément. Il n'y a pas d'engagement minimum.",
  },
  {
    q: "Quel modèle IA est utilisé ?",
    a: "Actuellement Llama 3.1 8B via Groq — ultra-rapide pour WhatsApp. Les intégrations GPT-4o (OpenAI) et Claude (Anthropic) arrivent bientôt sur les plans Pro et Enterprise.",
  },
];

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, index, allPlanIds }: {
  plan:       DbPlan;
  index:      number;
  allPlanIds: string[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spot", "1");
  }
  function onMouseLeave() { cardRef.current?.style.setProperty("--spot", "0"); }

  const isFree       = plan.price_xaf === 0;
  const isEnterprise = plan.price_xaf === -1;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative flex flex-col rounded-2xl overflow-hidden"
      style={{
        ["--mx" as string]: "50%",
        ["--my" as string]: "50%",
        ["--spot" as string]: "0",
        background: plan.highlight ? "rgba(212,175,55,0.04)" : "var(--bg-elevated)",
        border: `1px solid ${plan.highlight ? "rgba(212,175,55,0.32)" : "var(--border-subtle)"}`,
        boxShadow: plan.highlight
          ? "0 0 0 1px rgba(212,175,55,0.16), 0 24px 60px rgba(212,175,55,0.08)"
          : "0 4px 24px rgba(0,0,0,0.18)",
      }}
    >
      {/* Spotlight */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{ background: "radial-gradient(circle 260px at var(--mx) var(--my), rgba(212,175,55,0.07) 0%, transparent 70%)", opacity: "var(--spot)" }} />

      {plan.badge && (
        <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(212,175,55,0.15)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.28)" }}>
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-disabled)" }}>
          {plan.label}
        </p>
        {isFree ? (
          <p className="font-good-timing text-3xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>Gratuit</p>
        ) : isEnterprise ? (
          <p className="font-good-timing text-2xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>Sur devis</p>
        ) : (
          <div>
            <span className="font-good-timing text-2xl font-bold leading-none"
              style={{ color: plan.highlight ? "var(--color-gold)" : "var(--text-primary)" }}>
              {plan.price_xaf.toLocaleString("fr-FR")}
            </span>
            <span className="text-[10px] ml-1.5 uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>XAF / mois</span>
          </div>
        )}
        <p className="text-xs leading-relaxed mt-2.5" style={{ color: "var(--text-tertiary)" }}>{plan.description}</p>

        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.12)", color: "var(--color-gold)" }}>
          <Zap className="w-2.5 h-2.5" />
          {plan.tokens_label}
          <span style={{ color: "var(--text-disabled)", fontWeight: 400 }}>· {plan.conv_estimate}</span>
        </div>
      </div>

      {/* Features */}
      <ul className="flex-1 px-6 py-5 space-y-2.5">
        {plan.features.map((f, fi) => (
          <li key={fi} className="flex items-center gap-2.5">
            {f.included
              ? <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
              : <Minus className="w-3.5 h-3.5 flex-shrink-0 opacity-20" style={{ color: "var(--text-disabled)" }} />}
            <span className="text-xs" style={{ color: f.included ? "var(--text-secondary)" : "var(--text-disabled)", opacity: f.included ? 1 : 0.45 }}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="px-6 pb-6">
        <Link href={plan.cta_href}
          className="block w-full text-center py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          style={
            plan.highlight
              ? { background: "linear-gradient(135deg,#D4AF37 0%,#EDD96A 50%,#A8881A 100%)", color: "#000", boxShadow: "0 2px 16px rgba(212,175,55,0.22)" }
              : { background: "var(--surface-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }
          }>
          {plan.cta_label}
        </Link>
      </div>
    </motion.div>
  );
}

// ── Capability row ────────────────────────────────────────────────────────────

function CapRow({ cap, index, planIds }: {
  cap:     DbCapability;
  index:   number;
  planIds: string[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="grid items-center gap-3 py-4"
      style={{ gridTemplateColumns: `1fr auto ${planIds.map(() => "auto").join(" ")}`, borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${cap.color}12`, border: `1px solid ${cap.color}25` }}>
          <CapIcon name={cap.icon} className="w-3.5 h-3.5" style={{ color: cap.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{cap.label}</p>
          <p className="text-[10px] leading-relaxed hidden sm:block" style={{ color: "var(--text-disabled)" }}>{cap.description}</p>
        </div>
      </div>

      {/* Token cost */}
      <div className="text-right flex-shrink-0">
        {cap.tokens_per_msg === 0 ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34D399" }}>
            Gratuit
          </span>
        ) : (
          <div>
            <p className="text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {cap.tokens_per_msg >= 1000 ? `~${(cap.tokens_per_msg / 1000).toFixed(1)}k` : `~${cap.tokens_per_msg}`}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>tokens</p>
          </div>
        )}
      </div>

      {/* Plan dots */}
      {planIds.map((planId) => (
        <div key={planId} className="flex justify-center flex-shrink-0">
          {cap.plans.includes(planId) ? (
            <div className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)" }}>
              <Check className="w-2.5 h-2.5" style={{ color: "var(--color-gold)" }} />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full" style={{ background: "var(--border-subtle)" }} />
          )}
        </div>
      ))}
    </motion.div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="py-4 cursor-pointer"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{q}</p>
        {open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25 }}
            className="text-xs leading-relaxed overflow-hidden"
            style={{ color: "var(--text-tertiary)" }}
          >
            {a}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Token estimator ───────────────────────────────────────────────────────────

function TokenEstimator({ plans }: { plans: DbPlan[] }) {
  const [msgs, setMsgs]               = useState(300);
  const [history, setHistory]         = useState<"none" | "light" | "full">("light");
  const [leadCap, setLeadCap]         = useState(false);
  const [contentCap, setContentCap]   = useState(false);

  const historyTokens = history === "none" ? 0 : history === "light" ? 250 : 800;
  const basePerMsg    = 500 + historyTokens + (leadCap ? 150 : 0);
  const contentTotal  = contentCap ? Math.round(msgs * 0.1) * 2000 : 0;
  const total         = msgs * basePerMsg + contentTotal;

  // Recommande le plan le moins cher qui couvre le total
  const recommended = plans
    .filter((p) => p.monthly_tokens === -1 || p.monthly_tokens >= total)
    .sort((a, b) => a.sort_order - b.sort_order)[0];

  const PLAN_COLOR: Record<string, string> = {
    free: "var(--text-disabled)", starter: "#60a5fa", pro: "var(--color-gold)", enterprise: "#a78bfa",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="rounded-2xl p-6 space-y-5"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Info className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Estimez votre consommation</p>
      </div>

      {/* Slider conversations */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Conversations / mois</label>
          <span className="text-xs font-bold tabular-nums" style={{ color: "var(--color-gold)" }}>{msgs.toLocaleString("fr-FR")}</span>
        </div>
        <input type="range" min={10} max={5000} step={10} value={msgs} onChange={(e) => setMsgs(Number(e.target.value))}
          className="w-full accent-[var(--color-gold)]" />
        <div className="flex justify-between text-[10px]" style={{ color: "var(--text-disabled)" }}>
          <span>10</span><span>5 000</span>
        </div>
      </div>

      {/* Historique */}
      <div className="space-y-2">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Historique de conversation</label>
        <div className="flex gap-2">
          {([["none", "Sans"], ["light", "10 msgs"], ["full", "200 msgs"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setHistory(val)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: history === val ? "rgba(212,175,55,0.1)" : "var(--bg-muted)",
                border: `1px solid ${history === val ? "rgba(212,175,55,0.3)" : "var(--border-subtle)"}`,
                color: history === val ? "var(--color-gold)" : "var(--text-disabled)",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles capacités */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { val: leadCap,     set: setLeadCap,     label: "Capture de leads",    tokens: "+150" },
          { val: contentCap,  set: setContentCap,  label: "Génération contenu",  tokens: "+2k"  },
        ].map(({ val, set, label, tokens }) => (
          <button key={label} onClick={() => set((v) => !v)}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all"
            style={{
              background: val ? "rgba(212,175,55,0.08)" : "var(--bg-muted)",
              border: `1px solid ${val ? "rgba(212,175,55,0.25)" : "var(--border-subtle)"}`,
            }}>
            <span style={{ color: val ? "var(--color-gold)" : "var(--text-tertiary)" }}>{label}</span>
            <span className="font-mono text-[10px]" style={{ color: "var(--text-disabled)" }}>{tokens}</span>
          </button>
        ))}
      </div>

      {/* Résultat */}
      <div className="rounded-xl p-4 text-center space-y-1.5" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-2xs" style={{ color: "var(--text-disabled)" }}>Consommation estimée / mois</p>
        <p className="text-2xl font-bold tabular-nums font-good-timing" style={{ color: "var(--text-primary)" }}>
          {total >= 1_000_000
            ? `${(total / 1_000_000).toFixed(1)}M`
            : total >= 1_000
              ? `${Math.round(total / 1_000)}k`
              : total}{" "}
          <span className="text-sm font-normal" style={{ color: "var(--text-disabled)" }}>tokens</span>
        </p>
        {recommended && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLOR[recommended.id] ?? "var(--color-gold)" }} />
            <span className="text-xs font-semibold" style={{ color: PLAN_COLOR[recommended.id] ?? "var(--color-gold)" }}>
              Plan recommandé : {recommended.label}
              {recommended.price_xaf > 0
                ? ` · ${recommended.price_xaf.toLocaleString("fr-FR")} XAF/mois`
                : recommended.price_xaf === 0
                  ? " · Gratuit"
                  : " · Sur devis"}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className ?? ""}`}
      style={{ background: "var(--bg-elevated)", ...style }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [plans,        setPlans]        = useState<DbPlan[]>([]);
  const [capabilities, setCapabilities] = useState<DbCapability[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(({ plans: p, capabilities: c }: { plans: DbPlan[]; capabilities: DbCapability[] }) => {
        setPlans(p);
        setCapabilities(c);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger les plans. Actualisez la page.");
        setLoading(false);
      });
  }, []);

  const planIds = plans.map((p) => p.id);

  return (
    <main className="relative overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(212,175,55,0.09) 0%, transparent 60%)", zIndex: 0 }} />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--color-gold)" }}>
            Tarifs
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            Simple,{" "}
            <span className="text-gold-gradient">transparent</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
            className="text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Payez selon votre usage réel en tokens — pas de forfait message arbitraire.{" "}
            Paiement Mobile Money (MTN, Orange, Wave…).
          </motion.p>
        </div>
      </section>

      {/* ── Plans ───────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 420 }} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
              <button onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "rgba(212,175,55,0.1)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}>
                <RefreshCw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {plans.map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} index={i} allPlanIds={planIds} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Capabilities & token costs ──────────────────────────────── */}
      {!loading && !error && capabilities.length > 0 && (
        <section className="relative px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="max-w-5xl mx-auto pt-16">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5 }} className="text-center mb-12">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--color-gold)" }}>
                Capacités & coûts
              </p>
              <h2 className="font-good-timing text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Chaque capacité a un coût précis
              </h2>
              <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--text-tertiary)" }}>
                Activez uniquement ce dont vous avez besoin. Voici la consommation exacte en tokens
                de chaque fonctionnalité, par message traité.
              </p>
            </motion.div>

            {/* En-tête tableau */}
            <div className="grid items-center gap-3 pb-3 mb-1"
              style={{ gridTemplateColumns: `1fr auto ${planIds.map(() => "auto").join(" ")}`, borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>Capacité</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-disabled)" }}>Tokens / msg</p>
              {plans.map((p) => (
                <p key={p.id} className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: "var(--text-disabled)" }}>
                  {p.label}
                </p>
              ))}
            </div>

            {capabilities.map((cap, i) => (
              <CapRow key={cap.id} cap={cap} index={i} planIds={planIds} />
            ))}

            {/* Note exemple */}
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              transition={{ delay: 0.3 }} className="mt-6 flex items-start gap-2.5 rounded-xl p-4"
              style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.12)" }}>
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                <strong style={{ color: "var(--text-secondary)" }}>Exemple concret :</strong>{" "}
                un échange WhatsApp avec historique de 10 messages et capture de leads consomme en moyenne
                <strong style={{ color: "var(--text-secondary)" }}> ~900 tokens</strong> (500 base + 250 historique + 150 lead).
                Avec 500 000 tokens/mois (Starter), cela représente{" "}
                <strong style={{ color: "var(--text-secondary)" }}>~555 conversations complètes</strong>.
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Token estimator ─────────────────────────────────────────── */}
      {!loading && !error && plans.length > 0 && (
        <section className="relative px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="max-w-2xl mx-auto pt-16">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5 }} className="text-center mb-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--color-gold)" }}>
                Calculateur
              </p>
              <h2 className="font-good-timing text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Quel plan me convient ?
              </h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                Ajustez les paramètres pour estimer votre consommation mensuelle.
              </p>
            </motion.div>
            <TokenEstimator plans={plans} />
          </div>
        </section>
      )}

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto pt-16">
          <motion.h2 initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-good-timing text-2xl font-bold text-center mb-8" style={{ color: "var(--text-primary)" }}>
            Questions fréquentes
          </motion.h2>
          {FAQ.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} index={i} />
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <section className="relative px-6 pb-28 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55 }}
          className="max-w-lg mx-auto space-y-6">
          <h2 className="font-good-timing text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Prêt à démarrer ?
          </h2>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Créez votre premier agent gratuitement, sans carte bancaire requise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/configure"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#D4AF37 0%,#EDD96A 50%,#A8881A 100%)", color: "#000", boxShadow: "0 4px 24px rgba(212,175,55,0.22)" }}>
              <Sparkles className="w-3.5 h-3.5" />
              Créer mon agent
            </Link>
            <Link href="/dashboard/billing"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: "var(--surface-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
              Voir les plans
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
