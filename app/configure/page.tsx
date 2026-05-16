"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2, Bot, Rocket, ArrowRight, ArrowLeft, Check,
  Briefcase, MessageSquare, Globe, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/auth-client";
import { generateSystemPrompt } from "@/lib/generateSystemPrompt";
import type { AgentFormData, BusinessSector, BrandTone } from "@/types/agent";

const schema = z.object({
  business_name: z.string().min(2, "Requis"),
  sector:        z.string().min(1, "Choisissez un secteur"),
  description:   z.string().min(10, "Décrivez votre activité en quelques mots"),
  agent_name:    z.string().min(2, "Requis"),
  brand_voice:   z.enum(["professional", "friendly", "casual", "luxury"]),
});

type FormData = z.infer<typeof schema>;

const SECTORS = [
  { value: "ecommerce",       label: "E-Commerce" },
  { value: "hospitality",     label: "Hôtellerie & Tourisme" },
  { value: "healthcare",      label: "Santé & Bien-être" },
  { value: "finance",         label: "Finance & Banque" },
  { value: "education",       label: "Éducation & Formation" },
  { value: "food_beverage",   label: "Restauration & Food" },
  { value: "beauty_wellness", label: "Beauté & Cosmétique" },
  { value: "real_estate",     label: "Immobilier" },
  { value: "tech_saas",       label: "Tech & SaaS" },
  { value: "consulting",      label: "Conseil & Consulting" },
  { value: "other",           label: "Autre" },
];

const TONES: { value: FormData["brand_voice"]; label: string; desc: string }[] = [
  { value: "professional", label: "Professionnel",  desc: "Formel, précis, rassurant" },
  { value: "friendly",     label: "Amical",          desc: "Chaleureux, accessible, humain" },
  { value: "casual",       label: "Décontracté",     desc: "Direct, spontané, moderne" },
  { value: "luxury",       label: "Luxe",            desc: "Élégant, exclusif, raffiné" },
];

const STEPS = [
  { id: 1, label: "Entreprise", icon: Building2 },
  { id: 2, label: "Agent",      icon: Bot       },
  { id: 3, label: "Lancer",     icon: Rocket    },
];

const SLIDE = {
  enter:  (d: number) => ({ x: d > 0 ?  32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:   (d: number) => ({ x: d > 0 ? -32 :  32, opacity: 0, transition: { duration: 0.25 } }),
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}

function StepEntreprise({ register, errors }: { register: any; errors: any }) {
  return (
    <div className="space-y-5">
      <Field label="Nom de l'entreprise" error={errors.business_name?.message}>
        <div className="relative">
          <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
          <input {...register("business_name")} placeholder="Ex: La Belle Époque" className="input-midnight pl-10" />
        </div>
      </Field>
      <Field label="Secteur d'activité" error={errors.sector?.message}>
        <select {...register("sector")} className="input-midnight">
          <option value="">— Choisir un secteur —</option>
          {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Décrivez votre activité en quelques mots" error={errors.description?.message}>
        <div className="relative">
          <MessageSquare className="absolute left-3.5 top-3 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
          <textarea {...register("description")} rows={3}
            placeholder="Nous sommes une boutique de mode premium…"
            className="input-midnight resize-none pl-10" />
        </div>
      </Field>
    </div>
  );
}

function StepAgent({ register, errors, watch, setValue }: { register: any; errors: any; watch: any; setValue: any }) {
  const selected = watch("brand_voice");
  return (
    <div className="space-y-6">
      <Field label="Nom de votre agent" error={errors.agent_name?.message}>
        <div className="relative">
          <Bot className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
          <input {...register("agent_name")} placeholder="Ex: Aria, Max, Sophie…" className="input-midnight pl-10" />
        </div>
      </Field>
      <Field label="Ton de votre agent" error={errors.brand_voice?.message}>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((t) => {
            const active = selected === t.value;
            return (
              <button key={t.value} type="button"
                onClick={() => setValue("brand_voice", t.value, { shouldValidate: true })}
                className="flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl text-left transition-all duration-200"
                style={{
                  background: active ? "rgba(212,175,55,0.08)" : "var(--bg-muted)",
                  border:     active ? "1px solid rgba(212,175,55,0.35)" : "1px solid var(--border-subtle)",
                  color:      active ? "var(--text-primary)" : "var(--text-secondary)",
                }}>
                <span className="text-xs font-semibold">{t.label}</span>
                <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{t.desc}</span>
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function StepLancer({ watch }: { watch: any }) {
  const data = watch();
  const sectorLabel = SECTORS.find((s) => s.value === data.sector)?.label ?? data.sector;
  const toneLabel   = TONES.find((t)   => t.value === data.brand_voice)?.label ?? data.brand_voice;
  const rows = [
    { icon: Briefcase,    label: "Entreprise", value: data.business_name },
    { icon: Globe,        label: "Secteur",    value: sectorLabel },
    { icon: Bot,          label: "Agent",      value: data.agent_name },
    { icon: MessageSquare, label: "Ton",       value: toneLabel },
    { icon: Zap,          label: "Modèle",     value: "Claude 3.5 Sonnet" },
  ];
  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        Vérifiez les informations avant de générer votre agent.
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border-subtle)" : undefined, background: i % 2 === 0 ? "var(--bg-muted)" : "var(--bg-base)" }}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
              <span className="text-xs w-24 flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>{r.label}</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{r.value || "—"}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
        style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.15)" }}>
        <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Le system prompt sera généré automatiquement. Vous pourrez l'affiner dans le dashboard.
        </p>
      </div>
    </div>
  );
}

export default function ConfigurePage() {
  const router         = useRouter();
  const { isLoggedIn } = useAuth();
  const [step, setStep]     = useState(1);
  const [dir, setDir]       = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!isLoggedIn) router.replace("/login"); }, [isLoggedIn, router]);

  const { register, handleSubmit, trigger, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { brand_voice: "professional" },
    mode: "onBlur",
  });

  const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
    1: ["business_name", "sector", "description"],
    2: ["agent_name", "brand_voice"],
    3: [],
  };

  async function goNext() {
    const ok = await trigger(STEP_FIELDS[step] as any);
    if (!ok) return;
    setDir(1);
    setStep((s) => Math.min(s + 1, 3));
  }

  function goPrev() {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 1));
  }

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const formData: AgentFormData = {
        business_name:    data.business_name,
        owner_name:       "Propriétaire",
        owner_email:      "contact@camille.ai",
        sector:           data.sector as BusinessSector,
        description:      data.description,
        agent_name:       data.agent_name,
        brand_voice:      data.brand_voice as BrandTone,
        primary_language: "fr",
        capabilities: {
          support_whatsapp:     true,
          content_generation:   false,
          image_creation:       false,
          community_management: false,
          strategy_advisor:     false,
          lead_capture:         false,
          proactive_messaging:  false,
          calendar_booking:     false,
        },
        target_model:     "claude-3-5-sonnet-20241022",
        faq:              [],
        forbidden_topics: [],
      };

      const systemPrompt = generateSystemPrompt(formData, formData.target_model);

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ formData, systemPrompt }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Erreur serveur");
      }

      const { agent } = await res.json();
      toast.success(`Agent "${agent.identity.name}" créé !`, { description: "Prêt dans votre dashboard." });
      router.push(`/dashboard/${agent.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  });

  const progress = ((step - 1) / 2) * 100;

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center py-24 overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(212,175,55,0.11) 0%, transparent 60%)" }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.018]"
        style={{ backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,1) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--color-gold)" }}>
            Configurateur
          </p>
          <h1 className="font-good-timing text-3xl md:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Créez votre agent <span className="text-gold-gradient">en 3 étapes</span>
          </h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>

          {/* Step indicator */}
          <div className="relative flex items-start justify-between mb-10">
            <div className="absolute top-4 left-0 right-0 flex px-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex-1 flex" style={{ justifyContent: i === 0 ? "flex-end" : "flex-start", paddingLeft: i === 1 ? 8 : 0, paddingRight: i === 0 ? 8 : 0 }}>
                  <div className="h-px w-full transition-colors duration-500"
                    style={{ background: step > i + 1 ? "rgba(212,175,55,0.45)" : "var(--border-subtle)", marginLeft: i === 0 ? "50%" : 0, marginRight: i === 1 ? "50%" : 0 }} />
                </div>
              ))}
            </div>
            {STEPS.map((s) => {
              const Icon = s.icon; const done = step > s.id; const active = step === s.id;
              return (
                <div key={s.id} className="relative flex flex-col items-center gap-2 flex-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 z-10"
                    style={{ background: done ? "rgba(212,175,55,0.22)" : active ? "rgba(212,175,55,0.12)" : "var(--bg-muted)", border: done || active ? "1px solid rgba(212,175,55,0.4)" : "1px solid var(--border-subtle)", boxShadow: active ? "0 0 12px rgba(212,175,55,0.25)" : "none" }}>
                    {done ? <Check className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} /> : <Icon className="w-3.5 h-3.5" style={{ color: active ? "var(--color-gold)" : "var(--text-disabled)" }} />}
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-center"
                    style={{ color: active ? "var(--color-gold)" : done ? "var(--text-tertiary)" : "var(--text-disabled)" }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Card */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset" }}>
            <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)" }} />
            <div className="h-0.5 w-full" style={{ background: "var(--border-subtle)" }}>
              <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="h-full" style={{ background: "linear-gradient(90deg, #D4AF37, #EDD96A)" }} />
            </div>

            <form onSubmit={onSubmit} noValidate>
              <div className="px-6 py-7 min-h-[300px]">
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div key={step} custom={dir} variants={SLIDE} initial="enter" animate="center" exit="exit">
                    {step === 1 && <StepEntreprise register={register} errors={errors} />}
                    {step === 2 && <StepAgent register={register} errors={errors} watch={watch} setValue={setValue} />}
                    {step === 3 && <StepLancer watch={watch} />}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="px-6 py-4 flex items-center justify-between gap-3"
                style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button type="button" onClick={goPrev} disabled={step === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-30"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
                  onMouseEnter={(e) => { if (step > 1) { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour
                </button>

                <span className="font-mono text-[10px]" style={{ color: "var(--text-disabled)" }}>{step} / 3</span>

                {step < 3 ? (
                  <button type="button" onClick={goNext}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                    style={{ background: "linear-gradient(135deg,#D4AF37,#EDD96A 50%,#A8881A)", color: "#000" }}>
                    Continuer <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button type="submit" disabled={loading}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#D4AF37,#EDD96A 50%,#A8881A)", color: "#000" }}>
                    {loading ? (
                      <span className="flex items-center gap-1.5">
                        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block">
                          <Rocket className="w-3.5 h-3.5" />
                        </motion.span>
                        Génération…
                      </span>
                    ) : (
                      <><Rocket className="w-3.5 h-3.5" /> Lancer l'agent</>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
