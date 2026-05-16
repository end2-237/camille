// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Capabilities — Camille by Buyticle
// Liste des capacités récupérées depuis la DB via /api/plans.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { motion } from "framer-motion";
import {
  MessageCircle, FileText, Image, Users, Target, UserPlus, Send,
  History, Zap, RefreshCw,
} from "lucide-react";
import type { AgentFormData, AgentCapabilities } from "@/types/agent";
import type { DbCapability } from "@/lib/plans-db";
import { cn } from "@/lib/utils";

type CapKey = keyof AgentCapabilities;

// ── Icon map (nom DB → composant lucide) ──────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle, FileText, Image, Users, Target, UserPlus, Send,
  History, Zap,
};
function CapIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Zap;
  return <Icon className={className} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Step4Capabilities() {
  const { control } = useFormContext<AgentFormData>();

  const [capabilities, setCapabilities] = useState<DbCapability[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.capabilities) {
          // N'afficher que les capacités configurables par l'utilisateur
          const configurable = (d.capabilities as DbCapability[]).filter(
            (c) => c.is_user_configurable && c.status !== "disabled"
          );
          setCapabilities(configurable);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-gold/40" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 mb-2">
        Activez les fonctionnalités que votre agent doit maîtriser.
      </p>

      {capabilities.map((cap, idx) => {
        const isComingSoon = cap.status === "coming_soon";
        const key          = cap.id as CapKey;

        return (
          <Controller
            key={cap.id}
            name={`capabilities.${key}` as `capabilities.${CapKey}`}
            control={control}
            render={({ field }) => {
              const isOn = !isComingSoon && (field.value as boolean);

              return (
                <motion.label
                  htmlFor={`cap-${cap.id}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl",
                    "border transition-all duration-250 ease-premium",
                    isComingSoon
                      ? "glass border-white/[0.04] cursor-not-allowed opacity-50"
                      : isOn
                        ? "glass-gold border-gold/25 shadow-gold cursor-pointer"
                        : "glass border-white/[0.07] hover:border-white/15 cursor-pointer"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                      "transition-colors duration-250",
                      isOn && !isComingSoon
                        ? "bg-gold/15 text-gold"
                        : "bg-white/[0.04] text-white/30"
                    )}
                  >
                    <CapIcon name={cap.icon} className="w-4 h-4" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-sm font-medium transition-colors duration-200",
                          isOn && !isComingSoon ? "text-white" : "text-white/60"
                        )}
                      >
                        {cap.label}
                      </span>
                      {cap.badge && (
                        <span
                          className={cn(
                            "text-2xs font-semibold px-1.5 py-0.5 rounded-md",
                            cap.badge === "Core"
                              ? "bg-emerald-400/10 text-emerald-400"
                              : cap.badge === "Bientôt"
                                ? "bg-white/[0.06] text-white/30"
                                : cap.badge === "Nouveau"
                                  ? "bg-sky-400/10 text-sky-400"
                                  : "bg-gold/10 text-gold"
                          )}
                        >
                          {cap.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-white/35 mt-0.5">{cap.description}</p>
                  </div>

                  {/* Toggle */}
                  <div className="flex-shrink-0">
                    <input
                      id={`cap-${cap.id}`}
                      type="checkbox"
                      checked={isOn}
                      disabled={isComingSoon}
                      onChange={(e) => !isComingSoon && field.onChange(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "relative w-10 h-5.5 rounded-full transition-all duration-300",
                        isOn && !isComingSoon ? "bg-gold" : "bg-white/10"
                      )}
                    >
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                        style={{ left: isOn && !isComingSoon ? "calc(100% - 1.125rem)" : "0.125rem" }}
                      />
                    </div>
                  </div>
                </motion.label>
              );
            }}
          />
        );
      })}
    </div>
  );
}
