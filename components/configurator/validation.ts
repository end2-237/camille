// ─────────────────────────────────────────────────────────────────────────────
// components/configurator/validation.ts — Camille by Buyticle
// Zod schemas for each stepper step and the full form.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Reusable atoms ────────────────────────────────────────────────────────────

const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Format E.164 requis (ex: +33612345678)")
  .optional()
  .or(z.literal(""));

const url = z
  .string()
  .url("URL invalide")
  .optional()
  .or(z.literal(""));

// ── Step 1: Business ──────────────────────────────────────────────────────────

export const step1Schema = z.object({
  business_name:   z.string().min(2,  "Nom requis (min. 2 caractères)"),
  owner_name:      z.string().min(2,  "Votre nom est requis"),
  owner_email:     z.string().email("Email invalide"),
  whatsapp_number: e164Phone,
  sector: z.enum([
    "ecommerce","hospitality","healthcare","finance","education",
    "real_estate","legal","beauty_wellness","food_beverage",
    "tech_saas","consulting","nonprofit","other",
  ], { errorMap: () => ({ message: "Secteur requis" }) }),
  description:     z.string().min(20, "Décrivez votre activité (min. 20 caractères)"),
  website_url:     url,
  location:        z.string().optional(),
  target_audience: z.string().optional(),
});

// ── Step 2: Personality ────────────────────────────────────────────────────────

export const step2Schema = z.object({
  agent_name:   z.string().min(2, "Nom de l'agent requis"),
  agent_tagline: z.string().max(80).optional(),
  brand_voice: z.enum([
    "professional","friendly","casual","luxury",
    "technical","empathetic","authoritative",
  ]),
  primary_language: z.enum(["fr","en","es","ar","pt","de","it","nl"]),
  secondary_languages: z.array(z.enum(["fr","en","es","ar","pt","de","it","nl"])).optional(),
  avatar_emoji: z.string().max(4).optional(),
});

// ── Step 3: Knowledge Base ────────────────────────────────────────────────────

const faqEntrySchema = z.object({
  question: z.string().min(5),
  answer:   z.string().min(5),
});

export const step3Schema = z.object({
  products_services:  z.string().optional(),
  pricing_info:       z.string().optional(),
  business_hours:     z.string().optional(),
  policies:           z.string().optional(),
  faq:                z.array(faqEntrySchema).optional(),
  forbidden_topics:   z.array(z.string()).optional(),
});

// ── Step 4: Capabilities ──────────────────────────────────────────────────────

export const step4Schema = z.object({
  capabilities: z.object({
    support_whatsapp:     z.boolean(),
    content_generation:   z.boolean(),
    image_creation:       z.boolean(),
    community_management: z.boolean(),
    strategy_advisor:     z.boolean(),
    lead_capture:         z.boolean(),
    proactive_messaging:  z.boolean(),
  }),
});

// ── Step 5: Model & Review ────────────────────────────────────────────────────

export const step5Schema = z.object({
  target_model: z.enum([
    "gpt-4o",
    "gpt-4o-mini",
    "claude-3-5-sonnet-20241022",
    "claude-3-haiku-20240307",
  ]),
});

// ── Full form schema ──────────────────────────────────────────────────────────

export const agentFormSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema);

export type AgentFormSchema = z.infer<typeof agentFormSchema>;
