// ─────────────────────────────────────────────────────────────────────────────
// components/sections/HowItWorksSection.tsx — Camille by Buyticle
// Scroll-driven progress connector, watermark numbers, staggered reveals
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ClipboardList, Cpu, Plug, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STEPS: { n: string; icon: LucideIcon; title: string; desc: string }[] = [
  {
    n: "01",
    icon: ClipboardList,
    title: "Renseignez votre activité",
    desc: "Nom, secteur, ton, FAQ, politiques… Notre formulaire collecte tout ce dont l'agent a besoin.",
  },
  {
    n: "02",
    icon: Cpu,
    title: "Prompt généré automatiquement",
    desc: "Camille compile vos données en un system prompt optimisé pour le modèle IA de votre choix.",
  },
  {
    n: "03",
    icon: Plug,
    title: "Connectez WhatsApp",
    desc: "Reliez votre numéro WhatsApp Business via Meta API. Activé en moins de 60 secondes.",
  },
  {
    n: "04",
    icon: Rocket,
    title: "Déployez & observez",
    desc: "Votre agent est live. Suivez les métriques, affinez le prompt, itérez sans limite.",
  },
];

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
}: {
  step: (typeof STEPS)[number];
  index: number;
}) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="group relative px-6 py-8 space-y-5 overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Watermark step number */}
      <span
        aria-hidden
        className="absolute top-4 right-5 font-mono font-bold select-none pointer-events-none"
        style={{ fontSize: "3.5rem", lineHeight: 1, color: "rgba(124,90,248,0.07)", letterSpacing: "-0.04em" }}
      >
        {step.n}
      </span>

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ background: "rgba(124,90,248,0.08)", border: "1px solid rgba(124,90,248,0.15)" }}
      >
        <Icon className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {step.title}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {step.desc}
        </p>
      </div>

      {/* Bottom accent line on hover */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500"
        style={{ background: "linear-gradient(90deg, var(--color-gold), transparent)" }}
      />
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end end"],
  });
  const lineScaleX = useTransform(scrollYProgress, [0.05, 0.55], [0, 1]);

  return (
    <section ref={sectionRef} id="how" className="py-28 px-6"
      style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-16 space-y-3">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-gold)" }}
          >
            Comment ça marche
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-3xl md:text-4xl font-bold leading-tight tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            De <span className="text-gold-gradient">zéro</span> à déployé
          </motion.h2>
        </div>

        {/* Scroll-driven horizontal progress line (desktop only) */}
        <div className="hidden lg:block relative h-px mb-0" style={{ marginBottom: 0 }}>
          {/* Track */}
          <div className="absolute inset-0" style={{ background: "var(--border-subtle)" }} />
          {/* Fill — driven by section scroll progress */}
          <motion.div
            className="absolute inset-0"
            style={{
              scaleX: lineScaleX,
              transformOrigin: "left",
              background: "linear-gradient(90deg, rgba(124,90,248,0.65), rgba(124,90,248,0.15))",
            }}
          />
        </div>

        {/* Step connector dots (desktop) */}
        <div className="hidden lg:grid grid-cols-4 mb-8 -mt-1.5 px-[calc(12.5%-5px)]">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 + i * 0.14, type: "spring", stiffness: 280, damping: 22 }}
              className="flex justify-center"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "var(--color-gold)", boxShadow: "0 0 10px rgba(124,90,248,0.45)" }}
              />
            </motion.div>
          ))}
        </div>

        {/* Steps grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px"
          style={{ background: "var(--border-subtle)" }}>
          {STEPS.map((step, i) => (
            <StepCard key={step.n} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
