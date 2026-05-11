// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Capabilities — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useFormContext, Controller } from "react-hook-form";
import { motion } from "framer-motion";
import {
  MessageCircle, FileText, Image, Users, BarChart2, UserPlus, Send,
} from "lucide-react";
import type { AgentFormData, AgentCapabilities } from "@/types/agent";
import { cn } from "@/lib/utils";

type CapKey = keyof AgentCapabilities;

const CAPABILITIES: {
  key: CapKey;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}[] = [
  {
    key: "support_whatsapp",
    label: "Support WhatsApp",
    description: "Répondre automatiquement aux messages entrants",
    icon: MessageCircle,
    badge: "Core",
  },
  {
    key: "content_generation",
    label: "Génération de contenu",
    description: "Posts, captions, newsletters, copies",
    icon: FileText,
  },
  {
    key: "image_creation",
    label: "Création d'images IA",
    description: "Générer des visuels de marque à la demande",
    icon: Image,
  },
  {
    key: "community_management",
    label: "Community Management",
    description: "Modération et engagement de communauté",
    icon: Users,
  },
  {
    key: "strategy_advisor",
    label: "Stratège IA",
    description: "Recommandations et résumés analytiques",
    icon: BarChart2,
    badge: "Pro",
  },
  {
    key: "lead_capture",
    label: "Capture de leads",
    description: "Collecte de contacts qualifiés pour CRM",
    icon: UserPlus,
  },
  {
    key: "proactive_messaging",
    label: "Messages proactifs",
    description: "Suivis et broadcasts automatisés",
    icon: Send,
    badge: "Pro",
  },
];

export function Step4Capabilities() {
  const { control } = useFormContext<AgentFormData>();

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 mb-2">
        Activez les fonctionnalités que votre agent doit maîtriser.
      </p>

      {CAPABILITIES.map((cap, idx) => (
        <Controller
          key={cap.key}
          name={`capabilities.${cap.key}` as `capabilities.${CapKey}`}
          control={control}
          render={({ field }) => {
            const isOn = field.value as boolean;
            const Icon = cap.icon;

            return (
              <motion.label
                htmlFor={`cap-${cap.key}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl cursor-pointer",
                  "border transition-all duration-250 ease-premium",
                  isOn
                    ? "glass-gold border-gold/25 shadow-gold"
                    : "glass border-white/[0.07] hover:border-white/15"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                    "transition-colors duration-250",
                    isOn
                      ? "bg-gold/15 text-gold"
                      : "bg-white/[0.04] text-white/30"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium transition-colors duration-200",
                        isOn ? "text-white" : "text-white/60"
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
                            : "bg-gold/10 text-gold"
                        )}
                      >
                        {cap.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-white/35 mt-0.5">
                    {cap.description}
                  </p>
                </div>

                {/* Toggle */}
                <div className="flex-shrink-0">
                  <input
                    id={`cap-${cap.key}`}
                    type="checkbox"
                    checked={isOn}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "relative w-10 h-5.5 rounded-full transition-all duration-300",
                      isOn ? "bg-gold" : "bg-white/10"
                    )}
                  >
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full",
                        "bg-white shadow-sm"
                      )}
                      style={{ left: isOn ? "calc(100% - 1.125rem)" : "0.125rem" }}
                    />
                  </div>
                </div>
              </motion.label>
            );
          }}
        />
      ))}
    </div>
  );
}
