// ─────────────────────────────────────────────────────────────────────────────
// components/ui/ThemeToggle.tsx — Camille by Buyticle
// Bouton trois états : dark → light → system → dark …
// Utilise le ThemeProvider maison — zéro dépendance externe.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useTheme } from "@/components/layout/ThemeProvider";
import type { Theme } from "@/components/layout/ThemeProvider";
import { Moon, Sun, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const THEMES: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "dark",   icon: Moon,    label: "Sombre"  },
  { value: "light",  icon: Sun,     label: "Clair"   },
  { value: "system", icon: Monitor, label: "Système" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const currentIdx = THEMES.findIndex((t) => t.value === theme);
  const current    = THEMES[currentIdx] ?? THEMES[0];
  const next       = THEMES[(currentIdx + 1) % THEMES.length];
  const Icon       = current.icon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      aria-label={`Thème : ${current.label}. Cliquer pour ${next.label}`}
      title={`Thème actuel : ${current.label}`}
      className={cn(
        "relative w-7 h-7 rounded-lg flex items-center justify-center",
        "glass border border-[var(--border-default)]",
        "text-[var(--text-tertiary)] hover:text-[var(--color-gold)]",
        "transition-all duration-200",
        "hover:border-[var(--border-gold)] hover:bg-[var(--surface-gold)]",
        "focus-visible:ring-2 focus-visible:ring-gold/60",
        className
      )}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={current.value}
          initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
          animate={{ opacity: 1, rotate:   0, scale: 1   }}
          exit={{    opacity: 0, rotate:  30, scale: 0.7 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon className="w-3.5 h-3.5" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
