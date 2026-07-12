"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import {
  Zap, Globe, BarChart3, MessageCircle, Layers, Shield,
} from "lucide-react";

const SLIDES = [
  {
    id: "deploy",
    tag: "Déploiement",
    title: "En ligne en 4 minutes",
    body: "Pas de code. Pas d'infra. Votre agent IA est actif sur WhatsApp, votre site et vos canaux préférés en quelques clics.",
    icon: Zap,
    accent: "#7C5AF8",
    stat: "< 4 min",
    statLabel: "temps de déploiement",
  },
  {
    id: "multilang",
    tag: "International",
    title: "8 langues, zéro effort",
    body: "Camille détecte la langue de vos clients et répond naturellement — sans configuration supplémentaire.",
    icon: Globe,
    accent: "#7DD3C0",
    stat: "8",
    statLabel: "langues supportées",
  },
  {
    id: "analytics",
    tag: "Analytics",
    title: "Insights en temps réel",
    body: "Tableaux de bord interactifs : taux de résolution, sujets chauds, satisfaction — chaque conversation compte.",
    icon: BarChart3,
    accent: "#A78BFA",
    stat: "99.4%",
    statLabel: "taux de résolution",
  },
  {
    id: "channel",
    tag: "Omnicanal",
    title: "Là où sont vos clients",
    body: "WhatsApp, Web Chat, Messenger — un seul agent gère tous vos canaux depuis un tableau de bord unifié.",
    icon: MessageCircle,
    accent: "#34D399",
    stat: "3+",
    statLabel: "canaux intégrés",
  },
  {
    id: "models",
    tag: "IA Avancée",
    title: "Meilleurs modèles du marché",
    body: "Claude 3.5, GPT-4o, Haiku — choisissez le modèle adapté à votre cas d'usage et à votre budget.",
    icon: Layers,
    accent: "#F97316",
    stat: "4",
    statLabel: "modèles disponibles",
  },
  {
    id: "security",
    tag: "Sécurité",
    title: "Données protégées, RGPD",
    body: "TLS 1.3, chiffrement AES-256, hébergement EU. Vos données et celles de vos clients ne quittent jamais l'Europe.",
    icon: Shield,
    accent: "#60A5FA",
    stat: "EU",
    statLabel: "hébergement garanti",
  },
];

const CARD_W   = 320;
const CARD_GAP = 20;
const STRIDE   = CARD_W + CARD_GAP;

export function ShowcaseCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const x        = useMotionValue(0);
  const springX  = useSpring(x, { stiffness: 180, damping: 28 });

  const [active, setActive]     = useState(0);
  const [dragging, setDragging] = useState(false);

  const total = SLIDES.length;

  function clamp(v: number) {
    const maxDrag = -(STRIDE * (total - 1));
    return Math.max(maxDrag, Math.min(0, v));
  }

  function snapTo(i: number) {
    const target = clamp(-i * STRIDE);
    x.set(target);
    setActive(Math.round(-target / STRIDE));
  }

  const trackOpacity = useTransform(x, [0, -(STRIDE * (total - 1))], [1, 1]);

  return (
    <section className="relative py-24 overflow-hidden" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(124,90,248,0.04) 0%, transparent 70%)" }} />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-3 max-w-lg">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--color-gold)" }}
            >
              Tout ce dont vous avez besoin
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="font-good-timing text-3xl md:text-4xl font-bold tracking-tight leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Une plateforme,{" "}
              <span className="text-gold-gradient">toutes les réponses</span>
            </motion.h2>
          </div>

          {/* Dot navigation */}
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => snapTo(i)}
                className="transition-all duration-300"
                style={{
                  width:  active === i ? 24 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: active === i ? "var(--color-gold)" : "var(--border-default)",
                }}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Track */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="overflow-visible relative" style={{ cursor: dragging ? "grabbing" : "grab" }}>
          <motion.div
            ref={trackRef}
            drag="x"
            dragConstraints={{ left: -(STRIDE * (total - 1)), right: 0 }}
            dragElastic={0.08}
            style={{ x: springX, opacity: trackOpacity, display: "flex", gap: CARD_GAP }}
            onDragStart={() => setDragging(true)}
            onDragEnd={(_, info) => {
              setDragging(false);
              const snapped = Math.round(-x.get() / STRIDE);
              const bounded = Math.max(0, Math.min(total - 1, snapped));
              snapTo(bounded);
              setActive(bounded);
            }}
            onUpdate={() => {
              const idx = Math.round(-x.get() / STRIDE);
              setActive(Math.max(0, Math.min(total - 1, idx)));
            }}
          >
            {SLIDES.map((slide, i) => (
              <SlideCard key={slide.id} slide={slide} index={i} active={active === i} onClick={() => snapTo(i)} />
            ))}
          </motion.div>
        </div>

        {/* Instruction hint */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center text-[11px] tracking-wider"
          style={{ color: "var(--text-disabled)" }}
        >
          Glissez pour explorer
        </motion.p>
      </div>
    </section>
  );
}

function SlideCard({
  slide, index, active, onClick,
}: {
  slide: (typeof SLIDES)[number];
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const Icon = slide.icon;

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spot", "1");
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
      animate={{ scale: active ? 1 : 0.97, opacity: active ? 1 : 0.65 }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => cardRef.current?.style.setProperty("--spot", "0")}
      onClick={onClick}
      className="relative flex-shrink-0 flex flex-col rounded-2xl overflow-hidden select-none"
      style={{
        width:  CARD_W,
        minHeight: 300,
        ["--mx" as string]: "50%",
        ["--my" as string]: "50%",
        ["--spot" as string]: "0",
        background: "var(--bg-elevated)",
        border: `1px solid ${active ? slide.accent + "55" : "var(--border-subtle)"}`,
        boxShadow: active ? `0 0 0 1px ${slide.accent}22, 0 20px 50px rgba(0,0,0,0.3)` : "0 4px 20px rgba(0,0,0,0.2)",
        transition: "border-color 0.35s, box-shadow 0.35s, opacity 0.35s, scale 0.35s",
      }}
    >
      {/* Spotlight */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{ background: `radial-gradient(circle 200px at var(--mx) var(--my), ${slide.accent}12 0%, transparent 70%)`, opacity: "var(--spot)" as string }} />

      {/* Accent top bar */}
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${slide.accent}80, transparent)` }} />

      {/* Body */}
      <div className="flex flex-col flex-1 p-7 gap-5">
        {/* Tag + icon */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: slide.accent }}>
            {slide.tag}
          </span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: slide.accent + "18", border: `1px solid ${slide.accent}30` }}>
            <Icon className="w-4 h-4" style={{ color: slide.accent }} />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-good-timing text-xl font-bold leading-tight"
          style={{ color: "var(--text-primary)" }}>
          {slide.title}
        </h3>

        {/* Body */}
        <p className="text-xs leading-relaxed flex-1"
          style={{ color: "var(--text-tertiary)" }}>
          {slide.body}
        </p>

        {/* Stat */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <span className="font-good-timing text-2xl font-bold" style={{ color: slide.accent }}>
            {slide.stat}
          </span>
          <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-disabled)" }}>
            {slide.statLabel}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
