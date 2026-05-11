// ─────────────────────────────────────────────────────────────────────────────
// components/ui/MarqueeStrip.tsx — Infinite kinetic marquee
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { motion } from "framer-motion";

const ITEMS = [
  "Agents IA",
  "No-Code",
  "WhatsApp Business",
  "Multilingue",
  "Analytics temps réel",
  "Guardrails",
  "GPT-4o",
  "Claude Sonnet",
  "5 minutes",
  "Prompt auto-généré",
];

export function MarqueeStrip() {
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <div
      className="relative overflow-hidden py-4 select-none"
      style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity }}
        className="flex items-center gap-0 whitespace-nowrap will-change-transform"
      >
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-6 px-6">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--text-disabled)" }}
            >
              {item}
            </span>
            <span
              className="w-1 h-1 rounded-full flex-shrink-0"
              style={{ background: "rgba(212,175,55,0.25)" }}
            />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
