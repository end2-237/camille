// ─────────────────────────────────────────────────────────────────────────────
// components/ui/StepIndicator.tsx — Camille by Buyticle
// Premium stepper progress indicator with animated gold fill.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepMeta } from "@/types/agent";

interface StepIndicatorProps {
  steps: StepMeta[];
  currentStep: number;
  /** Called when user clicks a completed step number */
  onStepClick?: (stepId: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Progression du configurateur" className="w-full">
      {/* Mobile: compact progress bar */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        <span className="text-xs text-white/50">
          Étape {currentStep} sur {steps.length}
        </span>
        <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gold-gradient rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Desktop: full step row */}
      <ol className="hidden lg:flex items-center w-full">
        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isCurrent   = step.id === currentStep;
          const isClickable = isCompleted && !!onStepClick;

          return (
            <li
              key={step.id}
              className="flex items-center flex-1 last:flex-none"
            >
              {/* Step node */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(step.id)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${step.title}: ${isCompleted ? "terminé" : isCurrent ? "en cours" : "à venir"}`}
                className={cn(
                  "relative flex flex-col items-center gap-2 group",
                  isClickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                {/* Circle */}
                <motion.span
                  layout
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center",
                    "text-sm font-semibold border transition-colors duration-350",
                    isCompleted
                      ? "bg-gold border-gold text-midnight"
                      : isCurrent
                      ? "bg-gold/10 border-gold text-gold"
                      : "bg-midnight-800 border-white/10 text-white/30"
                  )}
                  animate={isCurrent ? { boxShadow: "0 0 0 4px rgba(212,175,55,0.12)" } : {}}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </motion.span>

                {/* Label */}
                <span
                  className={cn(
                    "absolute top-11 text-2xs font-medium whitespace-nowrap",
                    "transition-colors duration-250",
                    isCompleted
                      ? "text-gold/70 group-hover:text-gold"
                      : isCurrent
                      ? "text-white"
                      : "text-white/30"
                  )}
                >
                  {step.title}
                </span>
              </button>

              {/* Connector */}
              {idx < steps.length - 1 && (
                <div className="flex-1 mx-3 mt-[-1.375rem]">
                  <div className="h-px bg-white/10 relative overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gold-gradient"
                      initial={{ width: "0%" }}
                      animate={{ width: isCompleted ? "100%" : "0%" }}
                      transition={{
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.1 * idx,
                      }}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StepIndicator;
