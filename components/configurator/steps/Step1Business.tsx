// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Business Identity — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useFormContext } from "react-hook-form";
import type { AgentFormData } from "@/types/agent";
import { cn } from "@/lib/utils";

const SECTORS = [
  { value: "ecommerce",      label: "E-Commerce" },
  { value: "hospitality",    label: "Hôtellerie & Tourisme" },
  { value: "healthcare",     label: "Santé & Bien-être" },
  { value: "finance",        label: "Finance & Banque" },
  { value: "education",      label: "Éducation & Formation" },
  { value: "real_estate",    label: "Immobilier" },
  { value: "legal",          label: "Juridique" },
  { value: "beauty_wellness",label: "Beauté & Cosmétique" },
  { value: "food_beverage",  label: "Restauration & Food" },
  { value: "tech_saas",      label: "Tech & SaaS" },
  { value: "consulting",     label: "Conseil & Consulting" },
  { value: "nonprofit",      label: "Associatif & ONG" },
  { value: "other",          label: "Autre" },
] as const;

export function Step1Business() {
  const {
    register,
    formState: { errors },
  } = useFormContext<AgentFormData>();

  return (
    <div className="space-y-6">
      {/* Row 1: Business + Owner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Nom de l'entreprise"
          error={errors.business_name?.message}
          required
        >
          <input
            {...register("business_name")}
            placeholder="Ex: La Belle Époque"
            className="input-midnight"
          />
        </Field>

        <Field
          label="Votre nom complet"
          error={errors.owner_name?.message}
          required
        >
          <input
            {...register("owner_name")}
            placeholder="Ex: Marie Dupont"
            className="input-midnight"
          />
        </Field>
      </div>

      {/* Row 2: Email + WhatsApp */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Email de contact" error={errors.owner_email?.message} required>
          <input
            {...register("owner_email")}
            type="email"
            placeholder="marie@labelleepoque.fr"
            className="input-midnight"
          />
        </Field>

        <Field
          label="Numéro WhatsApp Business"
          hint="Format E.164 : +33612345678"
          error={errors.whatsapp_number?.message}
        >
          <input
            {...register("whatsapp_number")}
            type="tel"
            placeholder="+33612345678"
            className="input-midnight"
          />
        </Field>
      </div>

      {/* Sector */}
      <Field label="Secteur d'activité" error={errors.sector?.message} required>
        <select {...register("sector")} className="input-midnight">
          <option value="">— Choisir un secteur —</option>
          {SECTORS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Description */}
      <Field
        label="Description de votre activité"
        hint="Décrivez votre offre, vos clients, et ce qui vous différencie."
        error={errors.description?.message}
        required
      >
        <textarea
          {...register("description")}
          rows={3}
          placeholder="Nous sommes une boutique de mode premium qui propose..."
          className={cn("input-midnight resize-none")}
        />
      </Field>

      {/* Row 3: Website + Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Site web" error={errors.website_url?.message}>
          <input
            {...register("website_url")}
            type="url"
            placeholder="https://monsite.fr"
            className="input-midnight"
          />
        </Field>

        <Field label="Localisation" error={errors.location?.message}>
          <input
            {...register("location")}
            placeholder="Paris, France"
            className="input-midnight"
          />
        </Field>
      </div>

      {/* Target audience */}
      <Field
        label="Public cible"
        hint="Qui sont vos clients idéaux ?"
        error={errors.target_audience?.message}
      >
        <input
          {...register("target_audience")}
          placeholder="Femmes 25-45 ans, passionnées de mode durable..."
          className="input-midnight"
        />
      </Field>
    </div>
  );
}

// ── Generic Field wrapper ─────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-white/70">
        {label}
        {required && <span className="text-gold ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-2xs text-white/30">{hint}</p>
      )}
      {error && (
        <p className="text-2xs text-red-400">{error}</p>
      )}
    </div>
  );
}

export { Field };
