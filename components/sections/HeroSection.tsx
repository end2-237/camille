// ─────────────────────────────────────────────────────────────────────────────
// components/sections/HeroSection.tsx — Camille by Buyticle
// Parallax scroll · Magnetic CTA · Typewriter · 3D floating phone mockup
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Zap, TrendingUp, MessageCircle } from "lucide-react";

// ── Background image slideshow ───────────────────────────────────────────────

const BG_IMAGES = [
  "https://plus.unsplash.com/premium_photo-1672423154405-5fd922c11af2?w=1400&auto=format&fit=crop&q=80&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDF8TThqVmJMYlRSd3N8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1777987956542-1edd0c7488d9?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://plus.unsplash.com/premium_photo-1669014856429-627426dea4e3?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
];

function BgSlider() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((i) => (i + 1) % BG_IMAGES.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Images with crossfade */}
      {BG_IMAGES.map((src, i) => (
        <motion.div
          key={src}
          animate={{ opacity: i === active ? 1 : 0 }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{ willChange: "opacity" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover object-center"
            style={{ opacity: 0.18 }}
          />
        </motion.div>
      ))}

      {/* Gradient overlays — preserve text legibility */}
      {/* Left vignette: darkens where the copy lives */}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(100deg, var(--bg-base) 18%, rgba(9,9,14,0.82) 48%, rgba(9,9,14,0.55) 100%)" }} />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-48"
        style={{ background: "linear-gradient(to top, var(--bg-base), transparent)" }} />
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-32"
        style={{ background: "linear-gradient(to bottom, var(--bg-base), transparent)" }} />
    </div>
  );
}

// ── Typewriter ────────────────────────────────────────────────────────────────

const USE_CASES = [
  "pour WhatsApp 24/7",
  "sans une ligne de code",
  "pour votre marque",
  "en moins de 5 minutes",
];

function TypewriterCycle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % USE_CASES.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <span
      className="relative inline-block overflow-hidden align-bottom"
      style={{ minHeight: "1.1em" }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -22, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="block text-gold-gradient"
        >
          {USE_CASES[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ── Magnetic CTA ──────────────────────────────────────────────────────────────

function MagneticButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 160, damping: 18 });
  const y = useSpring(rawY, { stiffness: 160, damping: 18 });

  function onMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    rawX.set((e.clientX - (rect.left + rect.width / 2)) * 0.38);
    rawY.set((e.clientY - (rect.top + rect.height / 2)) * 0.38);
  }
  function onMouseLeave() { rawX.set(0); rawY.set(0); }

  return (
    <motion.button
      ref={ref}
      style={{
        x, y,
        background: "linear-gradient(135deg,#D4AF37 0%,#EDD96A 50%,#A8881A 100%)",
        color: "#000",
        boxShadow: "0 4px 24px rgba(212,175,55,0.28), 0 1px 0 rgba(255,255,255,0.15) inset",
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                 transition-[filter] duration-200 hover:brightness-110"
    >
      {children}
    </motion.button>
  );
}

// ── 3D Phone mockup ───────────────────────────────────────────────────────────

const MESSAGES = [
  { from: "user",  text: "Bonjour, quels sont vos délais de livraison ?" },
  { from: "agent", text: "Livraison sous 48h en France, 5-7j à l'international. Comment puis-je vous aider ?" },
  { from: "user",  text: "Ce sac est disponible en rouge ?" },
  { from: "agent", text: "Oui, disponible en rouge carmin. Je vous envoie la fiche produit ?" },
];

function ChatMockup() {
  return (
    // Outer container — provides space for floating badges
    <div className="relative" style={{ padding: "24px 32px 28px 24px" }}>

      {/* 3D floating phone */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 12, rotateY: -20 }}
        animate={{ opacity: 1, y: 0, rotateX: 4, rotateY: -14 }}
        transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          transformStyle: "preserve-3d",
          perspective: 1400,
          filter: "drop-shadow(0 48px 70px rgba(0,0,0,0.75)) drop-shadow(0 0 60px rgba(212,175,55,0.08))",
        }}
      >
        {/* Continuous float */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transform: "perspective(1400px) rotateX(4deg) rotateY(-14deg) rotateZ(1.2deg)" }}
        >
          {/* Phone frame */}
          <div
            className="w-[280px] rounded-[24px] overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 8px 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            {/* Status bar */}
            <div
              className="flex items-center justify-between px-5 py-2"
              style={{ background: "var(--bg-muted)" }}
            >
              <span className="text-[10px] font-medium" style={{ color: "var(--text-disabled)" }}>9:41</span>
              <div className="flex gap-1">
                {[3, 2, 1.5].map((h, i) => (
                  <div key={i} className="w-1 rounded-full" style={{ height: h * 3.5, background: i === 0 ? "var(--color-gold)" : "var(--border-strong)" }} />
                ))}
              </div>
            </div>

            {/* Chat header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: "var(--bg-muted)", borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.2)" }}
              >
                <Bot className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Camille IA</p>
                <p className="text-[10px] flex items-center gap-1.5" style={{ color: "#34D399" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  En ligne
                </p>
              </div>
              <MessageCircle className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-disabled)" }} />
            </div>

            {/* Messages */}
            <div className="px-3 py-4 space-y-2.5" style={{ background: "var(--bg-base)" }}>
              {MESSAGES.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.22, duration: 0.32 }}
                  className={`flex ${msg.from === "agent" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className="max-w-[86%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed"
                    style={
                      msg.from === "agent"
                        ? { background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderBottomLeftRadius: 4 }
                        : { background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.2)", color: "var(--text-primary)", borderBottomRightRadius: 4 }
                    }
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input bar */}
            <div
              className="flex items-center gap-2 px-3 py-2.5"
              style={{ background: "var(--bg-muted)", borderTop: "1px solid var(--border-subtle)" }}
            >
              <div
                className="flex-1 rounded-full px-3 py-1.5 text-[10px]"
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-disabled)" }}
              >
                Écrire un message…
              </div>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(212,175,55,0.15)" }}
              >
                <ArrowRight className="w-3 h-3" style={{ color: "var(--color-gold)" }} />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Badge — bottom right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, x: 10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.9, type: "spring", stiffness: 240, damping: 18 }}
        className="absolute bottom-2 right-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid rgba(212,175,55,0.3)",
          color: "var(--color-gold)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <Zap className="w-3 h-3" />
        Réponse &lt; 1s
      </motion.div>

      {/* Badge — top left */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, x: -10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 2.2, type: "spring", stiffness: 240, damping: 18 }}
        className="absolute top-2 left-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-secondary)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <TrendingUp className="w-3 h-3" style={{ color: "#34D399" }} />
        +340% conversion
      </motion.div>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "+240", label: "entreprises" },
  { value: "<1s",  label: "réponse" },
  { value: "8",    label: "langues" },
  { value: "5min", label: "setup" },
];

// ── Hero ──────────────────────────────────────────────────────────────────────

export function HeroSection() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const copyY       = useTransform(scrollYProgress, [0, 1],    [0, -55]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const mockupY     = useTransform(scrollYProgress, [0, 1],    [0, -28]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100dvh] flex flex-col justify-center px-6 pt-24 pb-20 overflow-hidden"
    >
      {/* Background images — crossfade slideshow */}
      <BgSlider />

      {/* Ambient glow — on top of images */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 90% 55% at 28% -8%, rgba(212,175,55,0.12) 0%, transparent 65%)" }}
      />

      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{ backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,1) 1px,transparent 1px)", backgroundSize: "72px 72px" }}
      />

      <div className="relative max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-[55%_45%] gap-8 lg:gap-12 items-center">

          {/* ── Copy ───────────────────────────────────────────────────── */}
          <motion.div style={{ y: copyY, opacity: copyOpacity }}>
            <div className="space-y-8">

              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{ background: "rgba(212,175,55,0.07)", color: "rgba(212,175,55,0.8)", border: "1px solid rgba(212,175,55,0.15)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-gold)" }} />
                No-Code AI Agents · par Buyticle
              </motion.div>

              {/* Headline */}
              <div className="space-y-1">
                <motion.h1
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.72, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="font-good-timing text-4xl md:text-5xl lg:text-[3.4rem] font-bold leading-[1.07] tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  Créez votre agent IA
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.72, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="font-good-timing text-4xl md:text-5xl lg:text-[3.4rem] font-bold leading-[1.07] tracking-tight"
                >
                  <TypewriterCycle />
                </motion.div>
              </div>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.32 }}
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: "var(--text-tertiary)" }}
              >
                Configurez un agent qui parle exactement comme votre marque —
                support WhatsApp, community management, qualification de leads.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.42 }}
                className="flex flex-wrap items-center gap-3"
              >
                <MagneticButton onClick={() => router.push("/configure")}>
                  Démarrer gratuitement
                  <ArrowRight className="w-3.5 h-3.5" />
                </MagneticButton>
                <button
                  onClick={() => router.push("/pricing")}
                  className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  Voir les tarifs
                </button>
              </motion.div>

              {/* Social proof + stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.62 }}
                className="space-y-5 pt-1"
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {(["ML", "AS", "KD", "TR", "PM"] as const).map((initials, i) => (
                      <div
                        key={initials}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: `hsl(${32 + i * 16}, 58%, 20%)`, border: "2px solid var(--bg-base)", color: "var(--color-gold)", zIndex: 5 - i }}
                      >
                        {initials}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
                    <span className="font-semibold" style={{ color: "var(--text-tertiary)" }}>+240 entreprises</span>{" "}déjà déployées
                  </p>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4" style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                  {STATS.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + i * 0.08 }}
                      className="px-3 py-2.5 text-center"
                      style={{ background: "var(--bg-muted)", borderRight: i < 3 ? "1px solid var(--border-subtle)" : undefined }}
                    >
                      <p className="font-mono text-sm font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                      <p className="text-[9px] mt-0.5 uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>{s.label}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ── 3D Mockup ──────────────────────────────────────────────── */}
          <motion.div
            style={{ y: mockupY }}
            className="flex justify-center lg:justify-end"
          >
            <ChatMockup />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6, duration: 0.8 }}
        className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
      >
        <p className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--text-disabled)" }}>Défiler</p>
        <motion.div
          animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-7 origin-top"
          style={{ background: "linear-gradient(to bottom, var(--border-gold), transparent)" }}
        />
      </motion.div>
    </section>
  );
}
