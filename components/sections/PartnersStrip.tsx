"use client";

import { useRef } from "react";
import { motion } from "framer-motion";

// ── Minimal SVG marks ─────────────────────────────────────────────────────────

function AnthropicMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 3L25 24H3L14 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M14 10L20 24H8L14 10Z" fill="currentColor" opacity="0.35"/>
    </svg>
  );
}

function OpenAIMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {[0,1,2,3,4,5].map((i) => {
        const angle = (i * 60 - 90) * (Math.PI / 180);
        const x1 = 14 + 5 * Math.cos(angle);
        const y1 = 14 + 5 * Math.sin(angle);
        const x2 = 14 + 11 * Math.cos(angle);
        const y2 = 14 + 11 * Math.sin(angle);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>;
      })}
      <circle cx="14" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    </svg>
  );
}

function SupabaseMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M16 4L5 16.5H14L12 24L23 11.5H14L16 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M16 4L14 11.5H23L16 4Z" fill="currentColor" opacity="0.3"/>
    </svg>
  );
}

function VercelMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 5L25 22H3L14 5Z" fill="currentColor"/>
    </svg>
  );
}

function StripeMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="3" width="22" height="22" rx="5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <path d="M10 17c0 1.1.9 1.8 2.3 1.8 1.6 0 2.7-.8 2.7-2.1 0-1-.6-1.6-2-2l-1-.3c-.7-.2-1-.5-1-.9 0-.5.4-.8 1.1-.8.8 0 1.2.4 1.3 1h2c-.1-1.7-1.2-2.7-3.2-2.7-1.8 0-3.1.9-3.1 2.4 0 1 .6 1.7 2 2.1l1 .3c.7.2 1 .5 1 .9 0 .5-.5.9-1.3.9-.9 0-1.4-.4-1.5-1.1H10z" fill="currentColor"/>
    </svg>
  );
}

function MetaMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M4 17.5c0 1.9 1.4 3 3 3 .9 0 1.7-.4 2.4-1.3L14 13l4.6 6.2c.7.9 1.5 1.3 2.4 1.3 1.6 0 3-1.1 3-3 0-.7-.2-1.4-.7-2L18 8.8C17.2 7.7 16.1 7 14 7s-3.2.7-4 1.8L4.7 15.5c-.5.6-.7 1.3-.7 2z"
        stroke="currentColor" strokeWidth="1.4" fill="none"
      />
    </svg>
  );
}

function AWSMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M7 10.5L4 14l3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 10.5L24 14l-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 19l2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="6" y="16" fontSize="7" fontWeight="800" fill="currentColor" letterSpacing="0.5" fontFamily="system-ui,sans-serif">AWS</text>
    </svg>
  );
}

function TwilioMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <circle cx="10.5" cy="10.5" r="2" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r="2" fill="currentColor"/>
      <circle cx="10.5" cy="17.5" r="2" fill="currentColor"/>
      <circle cx="17.5" cy="17.5" r="2" fill="currentColor"/>
    </svg>
  );
}

// ── Partner data ──────────────────────────────────────────────────────────────

const PARTNERS = [
  { name: "Anthropic",  role: "Modèles IA",        Mark: AnthropicMark,  accent: "#7C5AF8" },
  { name: "OpenAI",     role: "Modèles IA",         Mark: OpenAIMark,     accent: "#10A37F" },
  { name: "Supabase",   role: "Base de données",    Mark: SupabaseMark,   accent: "#3ECF8E" },
  { name: "Vercel",     role: "Infrastructure",     Mark: VercelMark,     accent: "#E0E0E0" },
  { name: "Stripe",     role: "Paiements",          Mark: StripeMark,     accent: "#635BFF" },
  { name: "Meta",       role: "Messagerie",         Mark: MetaMark,       accent: "#0082FB" },
  { name: "AWS",        role: "Cloud",              Mark: AWSMark,        accent: "#FF9900" },
  { name: "Twilio",     role: "WhatsApp API",       Mark: TwilioMark,     accent: "#F22F46" },
];

// ── Card ──────────────────────────────────────────────────────────────────────

function PartnerCard({ partner, index }: { partner: typeof PARTNERS[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { Mark } = partner;

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    el.style.setProperty("--spot", "1");
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover="hovered"
      onMouseMove={onMouseMove}
      onMouseLeave={() => ref.current?.style.setProperty("--spot", "0")}
      className="group relative rounded-2xl px-5 py-5 overflow-hidden cursor-default"
      style={{
        ["--mx" as string]: "50%",
        ["--my" as string]: "50%",
        ["--spot" as string]: "0",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* Spotlight */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 120px at var(--mx) var(--my), ${partner.accent}18 0%, transparent 70%)`,
          opacity: "var(--spot)" as string,
        }}
      />

      {/* Hover border glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        variants={{
          hovered: { boxShadow: `inset 0 0 0 1px ${partner.accent}40, 0 8px 30px ${partner.accent}12` },
        }}
        style={{ boxShadow: "inset 0 0 0 1px transparent" }}
        transition={{ duration: 0.25 }}
      />

      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <motion.div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}
          variants={{ hovered: { borderColor: partner.accent + "55", background: partner.accent + "10" } }}
          transition={{ duration: 0.25 }}
        >
          <motion.span
            style={{ color: "var(--text-disabled)" }}
            variants={{ hovered: { color: partner.accent } }}
            transition={{ duration: 0.25 }}
          >
            <Mark />
          </motion.span>
        </motion.div>

        {/* Text */}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none mb-1"
            style={{ color: "var(--text-primary)" }}>
            {partner.name}
          </p>
          <p className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--text-disabled)" }}>
            {partner.role}
          </p>
        </div>

        {/* Accent dot — appears on hover */}
        <motion.div
          className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: partner.accent }}
          initial={{ opacity: 0, scale: 0 }}
          variants={{ hovered: { opacity: 1, scale: 1 } }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        />
      </div>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function PartnersStrip() {
  return (
    <section
      className="relative py-20 px-6 overflow-hidden"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,90,248,0.03) 0%, transparent 70%)" }}
      />

      <div className="max-w-5xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-gold)" }}
          >
            Nos partenaires
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-2xl md:text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Construit sur des{" "}
            <span className="text-gold-gradient">fondations de confiance</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-xs max-w-sm mx-auto"
            style={{ color: "var(--text-tertiary)" }}
          >
            Chaque brique technologique est sélectionnée pour sa fiabilité, sa sécurité et ses performances à l'échelle enterprise.
          </motion.p>
        </div>

        {/* Grid 4×2 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PARTNERS.map((p, i) => (
            <PartnerCard key={p.name} partner={p} index={i} />
          ))}
        </div>

        {/* Bottom trust bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6 mt-10 pt-8"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {["Données hébergées en UE", "Conformité RGPD", "99,9 % disponibilité", "SOC 2 compatible"].map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "rgba(124,90,248,0.5)" }} />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                {item}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
