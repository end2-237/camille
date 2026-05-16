// ─────────────────────────────────────────────────────────────────────────────
// app/pricing/page.tsx — Camille by Buyticle
// Plans alignés sur lib/plans.ts · Capacités détaillées · Coût tokens
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Check, Minus, Sparkles, Zap, MessageCircle, Brain,
  BarChart3, Users, Target, Megaphone, Image, ChevronDown,
  ChevronUp, Info,
} from "lucide-react";

// ── Plan data (aligné sur lib/plans.ts) ──────────────────────────────────────

const PLANS = [
  {
    id: "free",
    name: "Gratuit",
    price: "0",
    period: "",
    description: "Pour créer votre premier agent et tester la plateforme.",
    cta: "Commencer gratuitement",
    href: "/configure",
    highlight: false,
    tokens: 50_000,
    tokensLabel: "50 000 tokens / mois",
    convEstimate: "~80 conversations",
    features: [
      { label: "1 agent WhatsApp",             included: true  },
      { label: "50 000 tokens / mois",          included: true  },
      { label: "Historique 10 messages",        included: true  },
      { label: "Prompt système auto-généré",    included: true  },
      { label: "Modèle Llama 3.1 8B (Groq)",   included: true  },
      { label: "Support WhatsApp de base",      included: true  },
      { label: "Indicateur de frappe",          included: false },
      { label: "Capture de leads",              included: false },
      { label: "Analytics avancées",            included: false },
      { label: "Support email",                 included: false },
    ],
    caps: ["support_whatsapp"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "9 900",
    period: "XAF / mois",
    description: "Pour les entreprises qui veulent un bot professionnel.",
    cta: "Passer au Starter",
    href: "/dashboard/billing",
    highlight: false,
    tokens: 500_000,
    tokensLabel: "500 000 tokens / mois",
    convEstimate: "~700 conversations",
    features: [
      { label: "1 agent WhatsApp",             included: true  },
      { label: "500 000 tokens / mois",         included: true  },
      { label: "Historique 50 messages",        included: true  },
      { label: "Prompt système auto-généré",    included: true  },
      { label: "Modèle Llama 3.1 8B (Groq)",   included: true  },
      { label: "Support WhatsApp + indicateur", included: true  },
      { label: "Capture de leads",              included: true  },
      { label: "Analytics de base",             included: true  },
      { label: "Support email prioritaire",     included: true  },
      { label: "Analytics avancées",            included: false },
    ],
    caps: ["support_whatsapp", "lead_capture"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "24 900",
    period: "XAF / mois",
    description: "Pour automatiser entièrement votre relation client.",
    cta: "Passer au Pro",
    href: "/dashboard/billing",
    highlight: true,
    badge: "Populaire",
    tokens: 2_000_000,
    tokensLabel: "2 000 000 tokens / mois",
    convEstimate: "~3 000 conversations",
    features: [
      { label: "Agents illimités",              included: true  },
      { label: "2 000 000 tokens / mois",       included: true  },
      { label: "Historique 200 messages",       included: true  },
      { label: "Prompt système auto-généré",    included: true  },
      { label: "Modèle Llama 3.1 8B (Groq)",   included: true  },
      { label: "Toutes les capacités actives",  included: true  },
      { label: "Analytics avancées",            included: true  },
      { label: "Support dédié",                 included: true  },
      { label: "Bientôt : GPT-4o / Claude",     included: true  },
      { label: "SLA 99,5% uptime",              included: true  },
    ],
    caps: ["support_whatsapp", "lead_capture", "content_generation", "strategy_advisor", "proactive_messaging"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sur devis",
    period: "",
    description: "Pour les agences et équipes à fort volume.",
    cta: "Contacter l'équipe",
    href: "mailto:hello@buyticle.com?subject=Camille Enterprise",
    highlight: false,
    tokens: -1,
    tokensLabel: "Tokens illimités",
    convEstimate: "Illimité",
    features: [
      { label: "Agents illimités",              included: true  },
      { label: "Tokens illimités",              included: true  },
      { label: "Historique illimité",           included: true  },
      { label: "Toutes les capacités",          included: true  },
      { label: "Modèles IA au choix",           included: true  },
      { label: "Déploiement personnalisé",      included: true  },
      { label: "SLA garanti & support 24/7",    included: true  },
      { label: "Account manager dédié",         included: true  },
      { label: "Intégrations sur mesure",       included: true  },
      { label: "Facturation sur devis",         included: true  },
    ],
    caps: ["support_whatsapp", "lead_capture", "content_generation", "strategy_advisor", "proactive_messaging", "community_management", "image_creation"],
  },
];

// ── Capacités et leur coût en tokens ─────────────────────────────────────────

const CAPABILITIES = [
  {
    id: "support_whatsapp",
    icon: MessageCircle,
    label: "Support WhatsApp",
    description: "Le bot reçoit et répond aux messages entrants en temps réel.",
    tokensPerMsg: 500,
    detail: "~300 prompt + ~200 réponse",
    plans: ["free", "starter", "pro", "enterprise"],
    color: "#34D399",
  },
  {
    id: "typing_indicator",
    icon: Zap,
    label: "Indicateur de frappe",
    description: "Le bot affiche « en train d'écrire » avant d'envoyer sa réponse.",
    tokensPerMsg: 0,
    detail: "0 token — appel API Waha uniquement",
    plans: ["starter", "pro", "enterprise"],
    color: "#60a5fa",
  },
  {
    id: "conversation_history",
    icon: Brain,
    label: "Historique de conversation",
    description: "Le contexte des messages précédents est injecté dans chaque appel LLM.",
    tokensPerMsg: 250,
    detail: "+~250 tokens / message (historique 10 msgs)",
    plans: ["free", "starter", "pro", "enterprise"],
    color: "#a78bfa",
    note: "Starter : +600 tokens (50 msgs) · Pro : +1 500 tokens (200 msgs)",
  },
  {
    id: "lead_capture",
    icon: Target,
    label: "Capture de leads",
    description: "Extraction structurée des informations contact depuis la conversation.",
    tokensPerMsg: 150,
    detail: "+~150 tokens par extraction",
    plans: ["starter", "pro", "enterprise"],
    color: "#fbbf24",
  },
  {
    id: "content_generation",
    icon: Sparkles,
    label: "Génération de contenu",
    description: "Rédaction de posts, emails, descriptions produit à la demande.",
    tokensPerMsg: 2000,
    detail: "~1 500–3 000 tokens / génération",
    plans: ["pro", "enterprise"],
    color: "#f97316",
  },
  {
    id: "strategy_advisor",
    icon: BarChart3,
    label: "Conseiller stratégique",
    description: "Analyse de la situation business et recommandations personnalisées.",
    tokensPerMsg: 1500,
    detail: "~1 000–2 000 tokens / conseil",
    plans: ["pro", "enterprise"],
    color: "#ec4899",
  },
  {
    id: "proactive_messaging",
    icon: Megaphone,
    label: "Messages proactifs",
    description: "Le bot initie la conversation (relances, rappels, promotions).",
    tokensPerMsg: 400,
    detail: "~400 tokens / message envoyé",
    plans: ["pro", "enterprise"],
    color: "#14b8a6",
  },
  {
    id: "community_management",
    icon: Users,
    label: "Community management",
    description: "Modération et animation de groupes WhatsApp.",
    tokensPerMsg: 350,
    detail: "~350 tokens / intervention",
    plans: ["enterprise"],
    color: "#8b5cf6",
  },
  {
    id: "image_creation",
    icon: Image,
    label: "Génération d'images",
    description: "Création d'images et visuels à la demande (intégration DALL-E / SDXL).",
    tokensPerMsg: 3000,
    detail: "~3 000 tokens + coût API image",
    plans: ["enterprise"],
    color: "#f43f5e",
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

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

// ── Spotlight plan card ───────────────────────────────────────────────────────

function PlanCard({ plan, index }: { plan: (typeof PLANS)[number]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spot", "1");
  }
  function onMouseLeave() {
    cardRef.current?.style.setProperty("--spot", "0");
  }

  const isFree = plan.price === "0";
  const isEnterprise = plan.id === "enterprise";

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
      {/* Spotlight overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{
          background: "radial-gradient(circle 260px at var(--mx) var(--my), rgba(212,175,55,0.07) 0%, transparent 70%)",
          opacity: "var(--spot)",
        }}
      />

      {/* Popular badge */}
      {plan.badge && (
        <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(212,175,55,0.15)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.28)" }}>
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-disabled)" }}>
          {plan.name}
        </p>
        {isFree ? (
          <p className="font-good-timing text-3xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>Gratuit</p>
        ) : isEnterprise ? (
          <p className="font-good-timing text-2xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>Sur devis</p>
        ) : (
          <div>
            <span className="font-good-timing text-2xl font-bold leading-none" style={{ color: plan.highlight ? "var(--color-gold)" : "var(--text-primary)" }}>
              {plan.price}
            </span>
            <span className="text-[10px] ml-1.5 uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>{plan.period}</span>
          </div>
        )}

        <p className="text-xs leading-relaxed mt-2.5" style={{ color: "var(--text-tertiary)" }}>{plan.description}</p>

        {/* Token pill */}
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.12)", color: "var(--color-gold)" }}>
          <Zap className="w-2.5 h-2.5" />
          {plan.tokensLabel}
          <span style={{ color: "var(--text-disabled)", fontWeight: 400 }}>· {plan.convEstimate}</span>
        </div>
      </div>

      {/* Features */}
      <ul className="flex-1 px-6 py-5 space-y-2.5">
        {plan.features.map((f, fi) => (
          <li key={fi} className="flex items-center gap-2.5">
            {f.included ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
            ) : (
              <Minus className="w-3.5 h-3.5 flex-shrink-0 opacity-20" style={{ color: "var(--text-disabled)" }} />
            )}
            <span className="text-xs" style={{ color: f.included ? "var(--text-secondary)" : "var(--text-disabled)", opacity: f.included ? 1 : 0.45 }}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="px-6 pb-6">
        <Link
          href={plan.href}
          className="block w-full text-center py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          style={
            plan.highlight
              ? { background: "linear-gradient(135deg,#D4AF37 0%,#EDD96A 50%,#A8881A 100%)", color: "#000", boxShadow: "0 2px 16px rgba(212,175,55,0.22)" }
              : { background: "var(--surface-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }
          }
        >
          {plan.cta}
        </Link>
      </div>
    </motion.div>
  );
}

// ── Capability cost row ───────────────────────────────────────────────────────

function CapRow({ cap, index }: { cap: (typeof CAPABILITIES)[number]; index: number }) {
  const Icon = cap.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="grid items-center gap-3 py-4"
      style={{
        gridTemplateColumns: "1fr auto auto auto auto",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${cap.color}12`, border: `1px solid ${cap.color}25` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: cap.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{cap.label}</p>
          <p className="text-[10px] leading-relaxed hidden sm:block" style={{ color: "var(--text-disabled)" }}>{cap.description}</p>
        </div>
      </div>

      {/* Token cost */}
      <div className="text-right flex-shrink-0">
        {cap.tokensPerMsg === 0 ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34D399" }}>
            Gratuit
          </span>
        ) : (
          <div>
            <p className="text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {cap.tokensPerMsg > 1000 ? `~${(cap.tokensPerMsg / 1000).toFixed(1)}k` : `~${cap.tokensPerMsg}`}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>tokens</p>
          </div>
        )}
      </div>

      {/* Plan availability dots */}
      {(["free", "starter", "pro", "enterprise"] as const).map((planId) => (
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

function TokenEstimator() {
  const [msgs, setMsgs]           = useState(300);
  const [history, setHistory]     = useState<"none" | "light" | "full">("light");
  const [leadCap, setLeadCap]     = useState(false);
  const [contentCap, setContentCap] = useState(false);

  const historyTokens = history === "none" ? 0 : history === "light" ? 250 : 800;
  const basePerMsg    = 500 + historyTokens + (leadCap ? 150 : 0);
  const contentTotal  = contentCap ? Math.round(msgs * 0.1) * 2000 : 0;
  const total         = msgs * basePerMsg + contentTotal;

  const plan =
    total <= 50_000   ? "free"
    : total <= 500_000  ? "starter"
    : total <= 2_000_000 ? "pro"
    : "enterprise";

  const PLAN_COLOR: Record<string, string> = {
    free: "var(--text-disabled)", starter: "#60a5fa", pro: "var(--color-gold)", enterprise: "#a78bfa",
  };
  const PLAN_NAME: Record<string, string> = {
    free: "Gratuit", starter: "Starter", pro: "Pro", enterprise: "Enterprise",
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

      {/* Messages per month */}
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

      {/* History */}
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

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { val: leadCap, set: setLeadCap, label: "Capture de leads", tokens: "+150" },
          { val: contentCap, set: setContentCap, label: "Génération contenu", tokens: "+2k" },
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

      {/* Result */}
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
        <div className="flex items-center justify-center gap-2 pt-1">
          <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLOR[plan] }} />
          <span className="text-xs font-semibold" style={{ color: PLAN_COLOR[plan] }}>
            Plan recommandé : {PLAN_NAME[plan]}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(212,175,55,0.09) 0%, transparent 60%)", zIndex: 0 }} />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
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

      {/* ── Plans ────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-20">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>
      </section>

      {/* ── Capabilities & token costs ───────────────────────────────── */}
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

          {/* Table header */}
          <div className="grid items-center gap-3 pb-3 mb-1"
            style={{ gridTemplateColumns: "1fr auto auto auto auto", borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>Capacité</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: "var(--text-disabled)" }}>Tokens / msg</p>
            {["Gratuit", "Starter", "Pro", "Enterprise"].map((p) => (
              <p key={p} className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: "var(--text-disabled)" }}>{p}</p>
            ))}
          </div>

          {/* Rows */}
          {CAPABILITIES.map((cap, i) => (
            <CapRow key={cap.id} cap={cap} index={i} />
          ))}

          {/* Note */}
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

      {/* ── Token estimator ──────────────────────────────────────────── */}
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
          <TokenEstimator />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto pt-16">
          <motion.h2 initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-good-timing text-2xl font-bold text-center mb-8" style={{ color: "var(--text-primary)" }}>
            Questions fréquentes
          </motion.h2>
          <div>
            {FAQ.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────── */}
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
