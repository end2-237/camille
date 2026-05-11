// ─────────────────────────────────────────────────────────────────────────────
// components/configurator/StepperForm.tsx — Camille by Buyticle
// Multi-step agent configurator. Orchestrates all 5 steps, manages state,
// and triggers the system prompt generator on the final step.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

import { StepIndicator } from "@/components/ui/StepIndicator";
import { GoldButton } from "@/components/ui/GoldButton";
import { generateSystemPrompt } from "@/lib/generateSystemPrompt";
import { STEPPER_STEPS } from "@/types/agent";
import type { AgentFormData, SystemPromptConfig } from "@/types/agent";
import { agentFormSchema } from "./validation";

// Step components (lazy-loadable)
import { Step1Business }     from "./steps/Step1Business";
import { Step2Personality }  from "./steps/Step2Personality";
import { Step3Knowledge }    from "./steps/Step3Knowledge";
import { Step4Capabilities } from "./steps/Step4Capabilities";
import { Step5Review }       from "./steps/Step5Review";

// ── Animation variants ────────────────────────────────────────────────────────

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ── Default form values ───────────────────────────────────────────────────────

const DEFAULT_VALUES: Partial<AgentFormData> = {
  primary_language: "fr",
  brand_voice: "professional",
  sector: "ecommerce",
  target_model: "claude-3-5-sonnet-20241022",
  capabilities: {
    support_whatsapp:    true,
    content_generation:  false,
    image_creation:      false,
    community_management:false,
    strategy_advisor:    false,
    lead_capture:        false,
    proactive_messaging: false,
  },
  faq: [],
  forbidden_topics: [],
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface StepperFormProps {
  /** Called with the final form data + generated prompt on success */
  onComplete?: (data: AgentFormData, prompt: SystemPromptConfig) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepperForm({ onComplete }: StepperFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection]     = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<SystemPromptConfig | null>(null);

  const methods = useForm<AgentFormData>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: DEFAULT_VALUES as AgentFormData,
    mode: "onBlur",
  });

  const { handleSubmit, trigger, getValues } = methods;

  // Step-specific fields to validate before advancing
  const STEP_FIELDS: Record<number, (keyof AgentFormData)[]> = {
    1: ["business_name", "owner_name", "owner_email", "sector", "description"],
    2: ["agent_name", "brand_voice", "primary_language"],
    3: [],
    4: ["capabilities"],
    5: ["target_model"],
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goNext = useCallback(async () => {
    const fields = STEP_FIELDS[currentStep];
    const valid  = fields.length ? await trigger(fields) : true;
    if (!valid) return;

    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, STEPPER_STEPS.length));
  }, [currentStep, trigger]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const jumpToStep = useCallback((id: number) => {
    setDirection(id > currentStep ? 1 : -1);
    setCurrentStep(id);
  }, [currentStep]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = useCallback(
    async (data: AgentFormData) => {
      setIsSubmitting(true);
      try {
        // Generate system prompt
        const prompt = generateSystemPrompt(data, data.target_model);
        setGeneratedPrompt(prompt);

        toast.success("Agent configuré avec succès !", {
          description: `${data.agent_name} est prêt — ${prompt.estimated_tokens} tokens générés.`,
        });

        onComplete?.(data, prompt);
      } catch (err) {
        toast.error("Erreur lors de la génération du prompt.");
        console.error("[StepperForm] submit error:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onComplete]
  );

  // On Step 5, clicking "Générer" triggers the prompt preview immediately
  const handlePreviewPrompt = useCallback(() => {
    const data = getValues();
    const prompt = generateSystemPrompt(data, data.target_model);
    setGeneratedPrompt(prompt);
  }, [getValues]);

  // ── Step renderer ───────────────────────────────────────────────────────────

  const STEP_COMPONENTS: Record<number, React.ReactNode> = {
    1: <Step1Business />,
    2: <Step2Personality />,
    3: <Step3Knowledge />,
    4: <Step4Capabilities />,
    5: (
      <Step5Review
        generatedPrompt={generatedPrompt}
        onPreview={handlePreviewPrompt}
      />
    ),
  };

  const isLastStep = currentStep === STEPPER_STEPS.length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <FormProvider {...methods}>
      <div className="w-full max-w-3xl mx-auto">

        {/* ── Stepper progress ───────────────────────────────────────────── */}
        <div className="mb-12 lg:mb-16 px-1">
          <StepIndicator
            steps={STEPPER_STEPS}
            currentStep={currentStep}
            onStepClick={jumpToStep}
          />
        </div>

        {/* ── Step card ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="glass border-gold-gradient rounded-3xl overflow-hidden shadow-glass">

            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg glass-gold border border-gold/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <motion.h2
                    key={`title-${currentStep}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-lg font-semibold text-white"
                  >
                    {STEPPER_STEPS[currentStep - 1].title}
                  </motion.h2>
                  <motion.p
                    key={`desc-${currentStep}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="text-xs text-white/50 mt-0.5"
                  >
                    {STEPPER_STEPS[currentStep - 1].description}
                  </motion.p>
                </div>
              </div>
            </div>

            {/* Animated step content */}
            <div className="relative overflow-hidden min-h-[360px]">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="px-8 py-8"
                >
                  {STEP_COMPONENTS[currentStep]}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Navigation footer ────────────────────────────────────────── */}
            <div className="px-8 pb-8 pt-4 border-t border-white/[0.06] flex items-center justify-between">
              {/* Back */}
              <GoldButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={goPrev}
                disabled={currentStep === 1}
                icon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Retour
              </GoldButton>

              {/* Step counter */}
              <span className="text-2xs text-white/30 font-mono tabular-nums">
                {currentStep} / {STEPPER_STEPS.length}
              </span>

              {/* Next / Submit */}
              {isLastStep ? (
                <GoldButton
                  type="submit"
                  loading={isSubmitting}
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  iconPosition="right"
                >
                  Lancer l'Agent
                </GoldButton>
              ) : (
                <GoldButton
                  type="button"
                  onClick={goNext}
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                >
                  Continuer
                </GoldButton>
              )}
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}

export default StepperForm;
