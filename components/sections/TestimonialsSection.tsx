"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    id: "aissatou",
    initials: "AB",
    name: "Aissatou Balde",
    title: "Directrice Commerciale",
    company: "Optimus Retail",
    sector: "E-commerce · Dakar",
    quote: "Camille a transformé notre service client. Avant, 3 agents traitaient 200 tickets par jour. Aujourd'hui, Camille en gère 1 400 seule — et nos clients ne voient aucune différence.",
    metric: "×7",
    metricLabel: "volume traité",
    hue: "#7C5AF8",
  },
  {
    id: "kofi",
    initials: "KM",
    name: "Kofi Mensah",
    title: "CEO & Co-fondateur",
    company: "FinEdge Africa",
    sector: "Fintech · Accra",
    quote: "En 72 heures, notre agent répondait parfaitement en anglais, français et twi. Aucune autre solution ne nous avait offert cette flexibilité multilingue avec un niveau de qualité aussi élevé.",
    metric: "72h",
    metricLabel: "déploiement complet",
    hue: "#7DD3C0",
  },
  {
    id: "fatou",
    initials: "FD",
    name: "Fatou Diallo",
    title: "Head of Operations",
    company: "MedLink Pro",
    sector: "Santé digitale · Abidjan",
    quote: "Les patients posent des questions sensibles à toute heure. Camille répond avec le bon ton, dans les deux langues, et escalade intelligemment aux équipes médicales quand c'est nécessaire.",
    metric: "94%",
    metricLabel: "satisfaction patient",
    hue: "#A78BFA",
  },
  {
    id: "ibrahim",
    initials: "IS",
    name: "Ibrahim Sow",
    title: "Fondateur",
    company: "AgriConnect",
    sector: "AgriTech · Bamako",
    quote: "Nos agriculteurs posent leurs questions en wolof, en bambara — Camille comprend, reformule et donne des conseils actionnables. C'est la première fois qu'une IA parle vraiment à nos utilisateurs.",
    metric: "3",
    metricLabel: "langues locales",
    hue: "#34D399",
  },
];

const AUTO_INTERVAL = 5000;

export function TestimonialsSection() {
  const [active, setActive]  = useState(0);
  const [paused, setPaused]  = useState(false);
  const total = TESTIMONIALS.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((i) => (i + 1) % total), AUTO_INTERVAL);
    return () => clearInterval(t);
  }, [paused, total]);

  const current = TESTIMONIALS[active];

  return (
    <section
      className="relative py-24 px-6 overflow-hidden"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse 50% 60% at 20% 50%, ${current.hue}08 0%, transparent 65%)`, transition: "background 1s ease" }} />

      <div className="max-w-6xl mx-auto">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-center mb-16"
          style={{ color: "var(--color-gold)" }}
        >
          Ce que disent nos clients
        </motion.p>

        {/* Main layout: quote left, roster right */}
        <div className="grid lg:grid-cols-[1fr_260px] gap-16 items-start">

          {/* ── Featured quote ── */}
          <div className="relative">
            {/* Large decorative quote mark */}
            <div aria-hidden className="absolute -top-6 -left-4 select-none pointer-events-none"
              style={{ color: current.hue, opacity: 0.12, fontSize: "9rem", lineHeight: 1, fontFamily: "Georgia, serif" }}>
              "
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                className="relative space-y-8"
              >
                {/* Quote text */}
                <blockquote
                  className="font-good-timing text-xl md:text-2xl leading-relaxed font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {current.quote}
                </blockquote>

                {/* Author strip */}
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{
                      background: current.hue + "22",
                      border: `1px solid ${current.hue}44`,
                      color: current.hue,
                    }}
                  >
                    {current.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{current.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {current.title} · {current.company}
                    </p>
                  </div>

                  {/* Sector tag */}
                  <span className="ml-auto text-[10px] font-medium px-2.5 py-1 rounded-full hidden sm:block"
                    style={{
                      background: current.hue + "12",
                      border: `1px solid ${current.hue}28`,
                      color: current.hue,
                    }}>
                    {current.sector}
                  </span>
                </div>

                {/* Metric */}
                <div className="inline-flex items-baseline gap-2 px-5 py-3 rounded-2xl"
                  style={{
                    background: current.hue + "0A",
                    border: `1px solid ${current.hue}20`,
                  }}>
                  <span className="font-good-timing text-4xl font-bold" style={{ color: current.hue }}>
                    {current.metric}
                  </span>
                  <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                    {current.metricLabel}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-px relative overflow-hidden rounded-full"
                  style={{ background: "var(--border-subtle)" }}>
                  <motion.div
                    key={`bar-${current.id}-${paused}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: paused ? undefined : 1 }}
                    transition={{ duration: AUTO_INTERVAL / 1000, ease: "linear" }}
                    className="absolute inset-y-0 left-0 w-full origin-left"
                    style={{ background: current.hue }}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Roster sidebar ── */}
          <div className="space-y-2 lg:pt-2">
            {TESTIMONIALS.map((t, i) => {
              const isActive = i === active;
              return (
                <motion.button
                  key={t.id}
                  onClick={() => { setActive(i); setPaused(true); }}
                  className="w-full text-left rounded-xl px-4 py-3 transition-all duration-300"
                  style={{
                    background: isActive ? t.hue + "10" : "transparent",
                    border: `1px solid ${isActive ? t.hue + "40" : "transparent"}`,
                  }}
                  whileHover={{ x: 3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <div className="flex items-center gap-3">
                    {/* Mini avatar */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                      style={{
                        background: isActive ? t.hue + "25" : "var(--bg-muted)",
                        color: isActive ? t.hue : "var(--text-disabled)",
                      }}
                    >
                      {t.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate"
                        style={{ color: isActive ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                        {t.name}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-disabled)" }}>
                        {t.company}
                      </p>
                    </div>
                    {isActive && (
                      <motion.div
                        layoutId="active-dot"
                        className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: t.hue }}
                      />
                    )}
                  </div>
                </motion.button>
              );
            })}

            {/* Quote icon decoration */}
            <div className="pt-4 flex justify-center opacity-10">
              <Quote className="w-6 h-6" style={{ color: "var(--color-gold)" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
