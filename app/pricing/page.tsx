// ─────────────────────────────────────────────────────────────────────────────
// app/pricing/page.tsx — Camille by Buyticle
// Scroll animations · Spotlight plan cards · Good Timing headings
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: "0",
    period: "",
    description: "Pour tester et créer votre premier agent.",
    cta: "Commencer gratuitement",
    href: "/configure",
    highlight: false,
    features: [
      { label: "1 agent IA",               included: true  },
      { label: "500 messages / mois",       included: true  },
      { label: "2 langues",                 included: true  },
      { label: "Prompt auto-généré",        included: true  },
      { label: "Support WhatsApp",          included: false },
      { label: "Analytics avancées",        included: false },
      { label: "Agents illimités",          included: false },
      { label: "Support prioritaire",       included: false },
    ],
  },
  {
    name: "Pro",
    price: "29 900",
    period: "FCFA / mois",
    description: "Pour les entreprises qui veulent tout automatiser.",
    cta: "Démarrer l'essai gratuit",
    href: "/configure",
    highlight: true,
    badge: "Populaire",
    features: [
      { label: "5 agents IA",               included: true  },
      { label: "10 000 messages / mois",    included: true  },
      { label: "8 langues",                 included: true  },
      { label: "Prompt auto-généré",        included: true  },
      { label: "Support WhatsApp",          included: true  },
      { label: "Analytics avancées",        included: true  },
      { label: "Agents illimités",          included: false },
      { label: "Support prioritaire",       included: false },
    ],
  },
  {
    name: "Scale",
    price: "97 900",
    period: "FCFA / mois",
    description: "Pour les équipes et agences à fort volume.",
    cta: "Contacter l'équipe",
    href: "mailto:hello@buyticle.com",
    highlight: false,
    features: [
      { label: "Agents illimités",          included: true  },
      { label: "Messages illimités",        included: true  },
      { label: "8 langues",                 included: true  },
      { label: "Prompt auto-généré",        included: true  },
      { label: "Support WhatsApp",          included: true  },
      { label: "Analytics avancées",        included: true  },
      { label: "SLA garanti",               included: true  },
      { label: "Support prioritaire",       included: true  },
    ],
  },
];

const FAQ = [
  { q: "Puis-je changer de plan à tout moment ?",        a: "Oui, vous pouvez upgrader ou downgrader à tout moment. Les changements sont appliqués immédiatement au prorata." },
  { q: "Qu'arrive-t-il si je dépasse ma limite ?",       a: "Votre agent passe en lecture seule. Vous recevrez un email avant d'atteindre la limite." },
  { q: "L'essai gratuit nécessite-t-il une CB ?",        a: "Non. Le plan Starter est gratuit pour toujours, sans carte bancaire requise." },
  { q: "Quels modèles IA sont disponibles ?",            a: "Claude 3.5 Sonnet, Claude 3 Haiku, GPT-4o et GPT-4o mini sont disponibles sur tous les plans." },
];

// ── Spotlight plan card ───────────────────────────────────────────────────────

function PlanCard({
  plan,
  index,
}: {
  plan: (typeof PLANS)[number];
  index: number;
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
  function onMouseLeave() {
    cardRef.current?.style.setProperty("--spot", "0");
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
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
          ? "0 0 0 1px rgba(212,175,55,0.16), 0 24px 60px rgba(212,175,55,0.06)"
          : "0 4px 24px rgba(0,0,0,0.2)",
      }}
    >
      {/* Spotlight overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 rounded-2xl"
        style={{
          background: "radial-gradient(circle 250px at var(--mx) var(--my), rgba(212,175,55,0.06) 0%, transparent 70%)",
          opacity: "var(--spot)",
        }}
      />

      {/* Popular badge */}
      {plan.badge && (
        <div
          className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(212,175,55,0.15)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.28)" }}
        >
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className="px-7 pt-7 pb-5 space-y-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-disabled)" }}>
          {plan.name}
        </p>
        <div className="flex flex-col gap-0.5 pt-1">
          <span
            className="font-good-timing font-bold leading-none"
            style={{
              fontSize: plan.price === "0" ? "2.25rem" : "1.75rem",
              color: plan.highlight ? "var(--color-gold)" : "var(--text-primary)",
            }}
          >
            {plan.price === "0" ? "Gratuit" : plan.price}
          </span>
          {plan.price !== "0" && (
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
              {plan.period}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {plan.description}
        </p>
      </div>

      {/* Features */}
      <ul className="flex-1 px-7 py-5 space-y-3">
        {plan.features.map((f, fi) => (
          <li key={`${plan.name}-${fi}`} className="flex items-center gap-2.5">
            {f.included ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
            ) : (
              <Minus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)", opacity: 0.3 }} />
            )}
            <span
              className="text-xs"
              style={{ color: f.included ? "var(--text-secondary)" : "var(--text-disabled)", opacity: f.included ? 1 : 0.5 }}
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="px-7 pb-7">
        <Link
          href={plan.href}
          className="block w-full text-center py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          style={
            plan.highlight
              ? { background: "linear-gradient(135deg, #D4AF37 0%, #EDD96A 50%, #A8881A 100%)", color: "#000", boxShadow: "0 2px 16px rgba(212,175,55,0.2)" }
              : { background: "var(--surface-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }
          }
        >
          {plan.cta}
        </Link>
      </div>
    </motion.div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.07 }}
      className="py-5"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{q}</p>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{a}</p>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(212,175,55,0.1) 0%, transparent 60%)", zIndex: 0 }}
      />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-5">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-gold)" }}
          >
            Tarifs
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Simple,{" "}
            <span className="text-gold-gradient">transparent</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24 }}
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            Pas de frais cachés. Pas d'engagement. Annulez à tout moment.
          </motion.p>
        </div>
      </section>

      {/* ── Plans ───────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4 items-stretch">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} />
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto pt-16">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-good-timing text-2xl font-bold text-center mb-10"
            style={{ color: "var(--text-primary)" }}
          >
            Questions fréquentes
          </motion.h2>
          <div>
            {FAQ.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="max-w-lg mx-auto space-y-6"
        >
          <h2
            className="font-good-timing text-2xl md:text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Prêt à démarrer ?
          </h2>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Créez votre premier agent gratuitement, sans carte bancaire.
          </p>
          <Link
            href="/configure"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, #D4AF37 0%, #EDD96A 50%, #A8881A 100%)",
              color: "#000",
              boxShadow: "0 4px 24px rgba(212,175,55,0.2)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Créer mon agent
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
