// ─────────────────────────────────────────────────────────────────────────────
// components/ui/GoldButton.tsx — Camille by Buyticle
// Premium CTA button with gold gradient, shimmer effect, and loading state.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GoldButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

// Compact 2026 SaaS sizing
const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-md",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-6 py-2.5 text-sm gap-2 rounded-lg",
};

const VARIANT_CLASSES = {
  gold: cn(
    "bg-gold-gradient font-semibold shadow-gold",
    "text-[#000]",          // pure black on gold — always readable
    "hover:brightness-110 hover:scale-[1.015]",
    "hover:shadow-gold-lg",
    "active:scale-[0.985]"
  ),
  ghost: cn(
    "bg-transparent font-medium",
    "border border-[var(--border-default)]",
    "text-[var(--text-secondary)]",
    "hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-glass)]",
    "active:scale-[0.985]"
  ),
  outline: cn(
    "bg-transparent font-medium",
    "border border-[var(--border-gold)]",
    "text-[var(--color-gold)]",
    "hover:bg-[var(--surface-gold)] hover:border-[var(--color-gold)]",
    "active:scale-[0.985]"
  ),
};

export const GoldButton = forwardRef<HTMLButtonElement, GoldButtonProps>(
  (
    {
      variant = "gold",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.01 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        disabled={isDisabled}
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden",
          "transition-all duration-250 ease-premium",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100",
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          className
        )}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {/* Shimmer overlay (gold variant only) */}
        {variant === "gold" && !isDisabled && (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gold-shimmer bg-[length:200%_100%] animate-shimmer opacity-60"
          />
        )}

        {/* Content */}
        <span className="relative flex items-center gap-[inherit]">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            icon && iconPosition === "left" && (
              <span aria-hidden="true">{icon}</span>
            )
          )}
          {children}
          {!loading && icon && iconPosition === "right" && (
            <span aria-hidden="true">{icon}</span>
          )}
        </span>
      </motion.button>
    );
  }
);

GoldButton.displayName = "GoldButton";
export default GoldButton;
