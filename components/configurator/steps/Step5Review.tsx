// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Model & Review — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useFormContext, Controller } from "react-hook-form";
import { motion } from "framer-motion";
import { Sparkles, Eye, Cpu, Zap } from "lucide-react";
import type { AgentFormData, AgentModel, SystemPromptConfig } from "@/types/agent";
import { GoldButton } from "@/components/ui/GoldButton";
import { cn } from "@/lib/utils";

const MODELS: {
  value: AgentModel;
  label: string;
  provider: string;
  description: string;
  speed: "fast" | "medium" | "powerful";
  available: boolean;
}[] = [
  {
    value: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B",
    provider: "Groq",
    description: "Ultra-rapide, idéal pour les réponses WhatsApp en temps réel",
    speed: "fast",
    available: true,
  },
  {
    value: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    provider: "Groq",
    description: "Puissant et nuancé, parfait pour le support client haut de gamme",
    speed: "powerful",
    available: true,
  },
  {
    value: "mixtral-8x7b-32768",
    label: "Mixtral 8x7B",
    provider: "Groq",
    description: "Contexte long, excellent pour les conversations complexes",
    speed: "medium",
    available: true,
  },
  {
    value: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    description: "Intégration OpenAI — bientôt disponible",
    speed: "powerful",
    available: false,
  },
  {
    value: "claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Intégration Anthropic — bientôt disponible",
    speed: "powerful",
    available: false,
  },
];

const SPEED_MAP = {
  fast:     { label: "Rapide",    color: "text-emerald-400" },
  medium:   { label: "Équilibré", color: "text-blue-400"    },
  powerful: { label: "Puissant",  color: "text-gold"        },
};

interface Step5ReviewProps {
  generatedPrompt: SystemPromptConfig | null;
  onPreview: () => void;
}

export function Step5Review({ generatedPrompt, onPreview }: Step5ReviewProps) {
  const { control, watch } = useFormContext<AgentFormData>();
  const agentName   = watch("agent_name");
  const agentEmoji  = watch("avatar_emoji") ?? "🤖";

  return (
    <div className="space-y-8">
      {/* Model selector */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-white/70 flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-gold/70" />
          Modèle IA
        </label>

        <Controller
          name="target_model"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODELS.map((model) => {
                const isSelected = field.value === model.value;
                const speed = SPEED_MAP[model.speed];

                return (
                  <motion.button
                    key={model.value}
                    type="button"
                    whileHover={model.available ? { y: -2 } : {}}
                    whileTap={model.available ? { scale: 0.98 } : {}}
                    onClick={() => model.available && field.onChange(model.value)}
                    disabled={!model.available}
                    className={cn(
                      "flex flex-col items-start gap-2 p-4 rounded-xl text-left",
                      "border transition-all duration-250 ease-premium",
                      !model.available && "opacity-45 cursor-not-allowed",
                      isSelected
                        ? "glass-gold border-gold/35 shadow-gold"
                        : "glass border-white/[0.07] hover:border-white/15"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isSelected ? "text-white" : "text-white/70"
                        )}
                      >
                        {model.label}
                      </span>
                      {model.available ? (
                        <span className={cn("text-2xs font-medium", speed.color)}>
                          <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                          {speed.label}
                        </span>
                      ) : (
                        <span className="text-2xs font-medium text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                          Bientôt
                        </span>
                      )}
                    </div>
                    <span className="text-2xs text-white/40">
                      {model.provider}
                    </span>
                    <p className="text-2xs text-white/35 leading-relaxed">
                      {model.description}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          )}
        />
      </div>

      {/* Prompt preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/70 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gold/70" />
            Prévisualisation du System Prompt
          </label>
          <GoldButton
            type="button"
            variant="outline"
            size="sm"
            icon={<Eye className="w-3 h-3" />}
            onClick={onPreview}
          >
            Générer
          </GoldButton>
        </div>

        <motion.div
          className={cn(
            "rounded-xl border p-4 min-h-[140px]",
            generatedPrompt
              ? "glass border-white/[0.07]"
              : "glass border-white/[0.04]"
          )}
          layout
        >
          {generatedPrompt ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{agentEmoji}</span>
                <div>
                  <p className="text-xs font-semibold text-white">{agentName}</p>
                  <p className="text-2xs text-white/40 font-mono">
                    v{generatedPrompt.version} · ~{generatedPrompt.estimated_tokens} tokens
                    · {generatedPrompt.target_model}
                  </p>
                </div>
              </div>
              <pre className="text-2xs text-white/50 font-mono whitespace-pre-wrap leading-relaxed line-clamp-[12] overflow-hidden">
                {generatedPrompt.compiled_prompt}
              </pre>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-4">
              <Sparkles className="w-6 h-6 text-gold/20" />
              <p className="text-xs text-white/25">
                Cliquez sur &quot;Générer&quot; pour prévisualiser votre prompt.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Summary callout */}
      <div className="glass-gold border border-gold/20 rounded-xl px-4 py-3">
        <p className="text-xs text-gold/80 leading-relaxed">
          En cliquant sur <strong>Lancer l'Agent</strong>, votre configuration sera sauvegardée
          et le prompt système sera généré. Vous pourrez le modifier à tout moment.
        </p>
      </div>
    </div>
  );
}
