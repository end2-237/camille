// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Agent Personality — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useFormContext, Controller } from "react-hook-form";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AgentFormData, BrandTone, SupportedLanguage } from "@/types/agent";
import { Field } from "./Step1Business";

const TONES: { value: BrandTone; label: string; description: string; emoji: string }[] = [
  { value: "professional",  label: "Professionnel",  description: "Précis et formel",           emoji: "💼" },
  { value: "friendly",      label: "Amical",          description: "Chaleureux et accessible",   emoji: "😊" },
  { value: "casual",        label: "Décontracté",     description: "Naturel et conversationnel", emoji: "✌️" },
  { value: "luxury",        label: "Luxe",            description: "Raffiné et exclusif",        emoji: "✨" },
  { value: "technical",     label: "Technique",       description: "Précis et structuré",        emoji: "⚙️" },
  { value: "empathetic",    label: "Empathique",      description: "Doux et bienveillant",       emoji: "💚" },
  { value: "authoritative", label: "Autoritaire",     description: "Expert et assertif",         emoji: "🎯" },
];

const LANGUAGES: { value: SupportedLanguage; label: string; flag: string }[] = [
  { value: "fr", label: "Français",    flag: "🇫🇷" },
  { value: "en", label: "English",     flag: "🇬🇧" },
  { value: "es", label: "Español",     flag: "🇪🇸" },
  { value: "ar", label: "العربية",     flag: "🇸🇦" },
  { value: "pt", label: "Português",   flag: "🇧🇷" },
  { value: "de", label: "Deutsch",     flag: "🇩🇪" },
  { value: "it", label: "Italiano",    flag: "🇮🇹" },
  { value: "nl", label: "Nederlands",  flag: "🇳🇱" },
];

const AVATAR_EMOJIS = ["🤖", "🌟", "💎", "🦁", "🌸", "⚡", "🔮", "🎭", "🌊", "🏆"];

export function Step2Personality() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<AgentFormData>();

  const selectedTone     = watch("brand_voice");
  const selectedLang     = watch("primary_language");
  const selectedEmoji    = watch("avatar_emoji");

  return (
    <div className="space-y-8">
      {/* Agent name + tagline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nom de l'agent" error={errors.agent_name?.message} required>
          <input
            {...register("agent_name")}
            placeholder="Ex: Aria, Nova, Camille..."
            className="input-midnight"
          />
        </Field>
        <Field label="Tagline" hint="Courte accroche (optionnel)">
          <input
            {...register("agent_tagline")}
            placeholder="Votre assistante mode premium"
            className="input-midnight"
          />
        </Field>
      </div>

      {/* Avatar emoji picker */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-white/70">
          Avatar de l'agent
        </label>
        <Controller
          name="avatar_emoji"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {AVATAR_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  type="button"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => field.onChange(emoji)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xl",
                    "transition-all duration-200",
                    field.value === emoji
                      ? "glass-gold border border-gold/40 shadow-gold"
                      : "glass border border-white/10 hover:border-white/20"
                  )}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Brand voice */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-white/70">
          Ton de la voix de marque <span className="text-gold">*</span>
        </label>
        <Controller
          name="brand_voice"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {TONES.map((tone) => (
                <motion.button
                  key={tone.value}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => field.onChange(tone.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-xl text-left",
                    "border transition-all duration-250 ease-premium",
                    field.value === tone.value
                      ? "glass-gold border-gold/40 shadow-gold"
                      : "glass border-white/10 hover:border-white/20"
                  )}
                >
                  <span className="text-lg">{tone.emoji}</span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      field.value === tone.value ? "text-gold" : "text-white"
                    )}
                  >
                    {tone.label}
                  </span>
                  <span className="text-2xs text-white/40">
                    {tone.description}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Primary language */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-white/70">
          Langue principale <span className="text-gold">*</span>
        </label>
        <Controller
          name="primary_language"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <motion.button
                  key={lang.value}
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => field.onChange(lang.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl",
                    "text-xs font-medium border",
                    "transition-all duration-200",
                    field.value === lang.value
                      ? "glass-gold border-gold/40 text-gold"
                      : "glass border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                  )}
                >
                  <span>{lang.flag}</span>
                  {lang.label}
                </motion.button>
              ))}
            </div>
          )}
        />
      </div>
    </div>
  );
}
