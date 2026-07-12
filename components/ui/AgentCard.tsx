// ─────────────────────────────────────────────────────────────────────────────
// components/ui/AgentCard.tsx — Camille by Buyticle
// Premium glassmorphism card for displaying an agent summary.
// Features: backdrop-blur, gold gradient border, hover lift, status badge.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { motion } from "framer-motion";
import { Bot, Zap, MessageCircle, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent";

// ── Sub-components ────────────────────────────────────────────────────────────

/** Animated status dot */
function StatusBadge({ status }: { status: Agent["status"] }) {
  const map = {
    active:   { label: "Actif",    dot: "bg-emerald-400", ring: "ring-emerald-400/30" },
    draft:    { label: "Brouillon",dot: "bg-white/40",    ring: "ring-white/20" },
    paused:   { label: "Pausé",    dot: "bg-amber-400",   ring: "ring-amber-400/30" },
    archived: { label: "Archivé",  dot: "bg-red-400/60",  ring: "ring-red-400/20" },
  } as const;

  const { label, dot, ring } = map[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "text-2xs font-medium tracking-wide uppercase",
        "glass border border-white/10"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full ring-2",
          dot,
          ring,
          status === "active" && "animate-pulse"
        )}
      />
      {label}
    </span>
  );
}

/** Capability chip row */
function CapabilityChips({ capabilities }: { capabilities: Agent["capabilities"] }) {
  const chips = [
    { key: "support_whatsapp",    icon: MessageCircle, label: "WhatsApp" },
    { key: "content_generation",  icon: Zap,           label: "Content"  },
    { key: "strategy_advisor",    icon: BarChart2,      label: "Strategy" },
  ] as const;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(({ key, icon: Icon, label }) =>
        capabilities[key] ? (
          <span
            key={key}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md",
              "text-2xs font-medium text-gold/80",
              "bg-gold/[0.08] border border-gold/15"
            )}
          >
            <Icon className="w-2.5 h-2.5" />
            {label}
          </span>
        ) : null
      )}
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export interface AgentCardProps {
  agent: Agent;
  /** When true, show the full details variant */
  expanded?: boolean;
  onClick?: (agent: Agent) => void;
  className?: string;
}

export function AgentCard({
  agent,
  expanded = false,
  onClick,
  className,
}: AgentCardProps) {
  const { identity, capabilities, status, system_prompt } = agent;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -4, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onClick?.(agent)}
      role={onClick ? "button" : "article"}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(agent)}
      className={cn(
        // Glass surface
        "glass border-gold-gradient rounded-2xl p-6",
        "relative overflow-hidden",
        // Interactive states
        onClick && "cursor-pointer",
        onClick && "hover:glass-gold hover:shadow-gold-lg",
        "transition-all duration-350 ease-premium",
        // Shadow
        "shadow-glass",
        className
      )}
    >
      {/* ── Ambient inner glow (top-left) ───────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -left-12 w-48 h-48
                   bg-gold/[0.06] rounded-full blur-3xl"
      />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="relative flex items-start justify-between gap-4 mb-5">
        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-12 h-12 rounded-xl",
            "glass-gold border border-gold/20",
            "flex items-center justify-center",
            "text-xl"
          )}
        >
          {identity.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.avatar_url}
              alt={identity.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <span>{identity.avatar_emoji ?? "🤖"}</span>
          )}
        </div>

        {/* Name + tagline */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate leading-snug">
            {identity.name}
          </h3>
          {identity.tagline && (
            <p className="text-xs text-white/50 mt-0.5 truncate">
              {identity.tagline}
            </p>
          )}
        </div>

        {/* Status */}
        <StatusBadge status={status} />
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="h-px bg-white/[0.06] mb-5" />

      {/* ── Capabilities ──────────────────────────────────────────────────── */}
      <CapabilityChips capabilities={capabilities} />

      {/* ── Expanded details ──────────────────────────────────────────────── */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5"
        >
          <div className="h-px bg-white/[0.06] mb-5" />

          {/* Prompt preview */}
          <div className="rounded-xl bg-midnight-800 border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-3.5 h-3.5 text-gold/70" />
              <span className="text-2xs font-mono text-white/40 uppercase tracking-wider">
                System Prompt — v{system_prompt.version}
              </span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed font-mono line-clamp-4">
              {system_prompt.compiled_prompt}
            </p>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between mt-4 text-2xs text-white/30">
            <span>~{system_prompt.estimated_tokens} tokens</span>
            <span>{system_prompt.target_model}</span>
            <span>
              {new Date(agent.updated_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Bottom hover indicator ─────────────────────────────────────────── */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(124,90,248,0.4), transparent)",
        }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    </motion.article>
  );
}

export default AgentCard;
