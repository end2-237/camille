// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Knowledge Base — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { AgentFormData } from "@/types/agent";
import { Field } from "./Step1Business";
import { cn } from "@/lib/utils";

export function Step3Knowledge() {
  const { register, control, formState: { errors } } =
    useFormContext<AgentFormData>();

  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
  } = useFieldArray({ control, name: "faq" });

  const {
    fields: topicFields,
    append: appendTopic,
    remove: removeTopic,
  } = useFieldArray({ control, name: "forbidden_topics" as never });

  return (
    <div className="space-y-6">
      {/* Products & Services */}
      <Field
        label="Produits & Services"
        hint="Listez vos produits phares, leurs caractéristiques et avantages."
      >
        <textarea
          {...register("products_services")}
          rows={3}
          placeholder="Robe de soirée haute couture, sacs en cuir artisanal, accessoires bio..."
          className="input-midnight resize-none"
        />
      </Field>

      {/* Pricing */}
      <Field
        label="Informations tarifaires"
        hint="Gammes de prix, promotions, politique de remise..."
      >
        <textarea
          {...register("pricing_info")}
          rows={2}
          placeholder="Produits de 49€ à 1200€. Livraison offerte dès 100€. Soldes -30% en janvier."
          className="input-midnight resize-none"
        />
      </Field>

      {/* Business hours */}
      <Field label="Horaires d'ouverture">
        <input
          {...register("business_hours")}
          placeholder="Lun-Ven 9h-18h, Sam 10h-17h (CET)"
          className="input-midnight"
        />
      </Field>

      {/* Policies */}
      <Field
        label="Politiques (retours, annulations, garanties)"
        hint="Ce que l'agent pourra communiquer directement."
      >
        <textarea
          {...register("policies")}
          rows={2}
          placeholder="Retours acceptés sous 30 jours. Remboursement intégral si défaut..."
          className="input-midnight resize-none"
        />
      </Field>

      {/* FAQ builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/70">
            FAQ automatisée
          </label>
          <button
            type="button"
            onClick={() => appendFaq({ question: "", answer: "" })}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              "text-2xs font-medium text-gold border border-gold/25",
              "hover:bg-gold/[0.06] transition-colors duration-200"
            )}
          >
            <Plus className="w-3 h-3" />
            Ajouter une Q&A
          </button>
        </div>

        <AnimatePresence>
          {faqFields.map((field, idx) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="glass border border-white/[0.07] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xs text-gold/60 font-mono">
                  Q{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeFaq(idx)}
                  className="text-white/20 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                {...register(`faq.${idx}.question`)}
                placeholder="Question fréquente..."
                className="input-midnight text-xs"
              />
              <textarea
                {...register(`faq.${idx}.answer`)}
                rows={2}
                placeholder="Réponse claire et concise..."
                className="input-midnight resize-none text-xs"
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {faqFields.length === 0 && (
          <p className="text-2xs text-white/25 text-center py-4">
            Aucune Q&A ajoutée — l'agent répondra librement à partir de son contexte.
          </p>
        )}
      </div>

      {/* Forbidden topics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-white/70">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70" />
            Sujets interdits
          </label>
          <button
            type="button"
            onClick={() => appendTopic("" as never)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              "text-2xs font-medium text-amber-400/70 border border-amber-400/20",
              "hover:bg-amber-400/[0.05] transition-colors duration-200"
            )}
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {topicFields.map((field, idx) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5"
              >
                <input
                  {...register(`forbidden_topics.${idx}` as const)}
                  placeholder="Saisir un sujet..."
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs",
                    "bg-amber-400/[0.05] border border-amber-400/20",
                    "text-amber-300/80 placeholder:text-amber-400/30",
                    "focus:outline-none focus:border-amber-400/40"
                  )}
                />
                <button
                  type="button"
                  onClick={() => removeTopic(idx)}
                  className="text-amber-400/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
