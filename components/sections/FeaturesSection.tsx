// ─────────────────────────────────────────────────────────────────────────────
// components/sections/FeaturesSection.tsx — Camille by Buyticle
// Spotlight hover cards, staggered whileInView, asymmetric bento grid
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Zap, Bot, BarChart2, Shield, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES: { icon: LucideIcon; title: string; desc: string; wide?: boolean }[] = [
  {
    icon: Bot,
    title: "Prompt auto-généré",
    desc: "Remplissez le formulaire. Obtenez un system prompt expert calibré pour votre secteur, votre ton et vos objectifs — sans rédiger une ligne.",
    wide: true,
  },
  {
    icon: MessageCircle,
    title: "WhatsApp natif",
    desc: "Connectez votre numéro WhatsApp Business en quelques secondes. Vos clients reçoivent des réponses 24/7.",
  },
  {
    icon: Zap,
    title: "No-Code total",
    desc: "Aucune ligne de code. Interface visuelle épurée. Opérationnel en moins de 5 minutes.",
  },
  {
    icon: BarChart2,
    title: "Analytics intégrées",
    desc: "Suivez messages traités, leads capturés, escalades et consommation de tokens en temps réel.",
  },
  {
    icon: Shield,
    title: "Guardrails intégrés",
    desc: "Définissez les sujets interdits, les limites de l'agent et les protocoles d'escalade vers un humain.",
  },
  {
    icon: Globe,
    title: "Multilingue",
    desc: "8 langues supportées. L'agent détecte et s'adapte automatiquement à la langue de votre client.",
  },
];

// ── Spotlight card ────────────────────────────────────────────────────────────

function SpotlightCard({
  icon: Icon,
  title,
  desc,
  wide,
  index,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  wide?: boolean;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    el.style.setProperty("--spotlight-opacity", "1");
  }

  function onMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--spotlight-opacity", "0");
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="group relative px-7 py-7 overflow-hidden transition-colors duration-300 cursor-default"
      style={{
        // CSS custom props for spotlight — defaults to 0 opacity
        ["--mx" as string]: "50%",
        ["--my" as string]: "50%",
        ["--spotlight-opacity" as string]: "0",
        gridColumn: wide ? "span 2" : undefined,
      }}
    >
      {/* Spotlight radial gradient — driven by CSS custom properties via JS */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: "radial-gradient(circle 220px at var(--mx) var(--my), rgba(212,175,55,0.07) 0%, transparent 70%)",
          opacity: "var(--spotlight-opacity)",
        }}
      />

      {/* Icon */}
      <div className="w-8 h-8 rounded-md flex items-center justify-center mb-5 transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
      </div>

      {/* Label */}
      <h3 className="text-sm font-semibold mb-2 transition-colors duration-200"
        style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {desc}
      </p>

      {/* Hover border highlight — bottom edge */}
      <div aria-hidden
        className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500"
        style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)" }}
      />
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function FeaturesSection() {
  return (
    <section id="features" className="py-28 px-6"
      style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-3">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--color-gold)" }}
            >
              Fonctionnalités
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="font-good-timing text-3xl md:text-4xl font-bold leading-tight tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Tout ce dont votre agent{" "}
              <span className="text-gold-gradient">a besoin</span>
            </motion.h2>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xs leading-relaxed max-w-[260px] md:text-right"
            style={{ color: "var(--text-disabled)" }}
          >
            Chaque fonctionnalité est conçue pour réduire le temps de réponse et augmenter la satisfaction client.
          </motion.p>
        </div>

        {/* Asymmetric bento grid: first card wide (col-span-2), rest fill */}
        <div
          className="grid md:grid-cols-2 lg:grid-cols-3"
          style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}
        >
          {FEATURES.map((f, i) => {
            // Dividers via borders — no background cards
            const isLastRow = i >= 3;
            const isLastInRow3 = (i + 1) % 3 === 0;

            return (
              <div
                key={f.title}
                style={{
                  borderBottom: !isLastRow ? "1px solid var(--border-subtle)" : undefined,
                  borderRight: !isLastInRow3 ? "1px solid var(--border-subtle)" : undefined,
                }}
              >
                <SpotlightCard icon={f.icon} title={f.title} desc={f.desc} wide={false} index={i} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
