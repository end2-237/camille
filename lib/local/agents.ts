// ─────────────────────────────────────────────────────────────────────────────
// lib/local/agents.ts — Camille by Buyticle
// CRUD agents en localStorage. Remplace Supabase en dev.
// ─────────────────────────────────────────────────────────────────────────────

import type { Agent, AgentFormData, SystemPromptConfig, AgentStatus } from "@/types/agent";
import { getLocalUser } from "./auth";

const KEY = "camille-agents";

// ── Helpers ───────────────────────────────────────────────────────────────────

function readAll(): Agent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Agent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(agents: Agent[]): void {
  localStorage.setItem(KEY, JSON.stringify(agents));
}

function newId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── API publique ──────────────────────────────────────────────────────────────

/** Liste tous les agents de l'utilisateur connecté */
export function listAgents(): Agent[] {
  const user = getLocalUser();
  if (!user) return [];
  return readAll().filter((a) => a.user_id === user.id);
}

/** Récupère un agent par son ID */
export function getAgent(id: string): Agent | null {
  return readAll().find((a) => a.id === id) ?? null;
}

/** Crée un agent depuis les données du formulaire + prompt généré */
export function createAgent(
  formData: AgentFormData,
  systemPrompt: SystemPromptConfig
): Agent {
  const user = getLocalUser();
  const now  = new Date().toISOString();

  const agent: Agent = {
    id:      newId(),
    user_id: user?.id ?? "local",

    identity: {
      name:               formData.agent_name,
      tagline:            formData.agent_tagline,
      brand_voice:        formData.brand_voice,
      primary_language:   formData.primary_language,
      secondary_languages:formData.secondary_languages,
      avatar_emoji:       formData.avatar_emoji ?? "✨",
    },

    business_context: {
      business_name:   formData.business_name,
      sector:          formData.sector,
      description:     formData.description,
      website_url:     formData.website_url,
      location:        formData.location,
      target_audience: formData.target_audience,
      owner_name:      formData.owner_name,
      owner_email:     formData.owner_email,
      whatsapp_number: formData.whatsapp_number,
    },

    knowledge_base: {
      business_description: formData.description,
      products_services:    formData.products_services,
      pricing_info:         formData.pricing_info,
      business_hours:       formData.business_hours,
      policies:             formData.policies,
      faq:                  formData.faq ?? [],
      forbidden_topics:     formData.forbidden_topics ?? [],
    },

    capabilities:   formData.capabilities,
    system_prompt:  systemPrompt,
    status:         "active",
    target_model:   formData.target_model,
    created_at:     now,
    updated_at:     now,
  };

  const all = readAll();
  writeAll([agent, ...all]);
  return agent;
}

/** Met à jour un agent (merge partiel) */
export function updateAgent(
  id: string,
  patch: Partial<Omit<Agent, "id" | "user_id" | "created_at">>
): Agent | null {
  const all = readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  const updated: Agent = {
    ...all[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  all[idx] = updated;
  writeAll(all);
  return updated;
}

/** Change le statut d'un agent */
export function setAgentStatus(id: string, status: AgentStatus): Agent | null {
  return updateAgent(id, { status });
}

/** Supprime définitivement un agent */
export function deleteAgent(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}

/** Vide tous les agents (utile pour les tests) */
export function clearAgents(): void {
  localStorage.removeItem(KEY);
}
