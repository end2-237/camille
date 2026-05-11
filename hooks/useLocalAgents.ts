// ─────────────────────────────────────────────────────────────────────────────
// hooks/useLocalAgents.ts — Camille by Buyticle
// Hook React pour le CRUD agents localStorage.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  setAgentStatus,
} from "@/lib/local/agents";
import type { Agent, AgentFormData, SystemPromptConfig, AgentStatus } from "@/types/agent";

// ── Liste ─────────────────────────────────────────────────────────────────────

export function useLocalAgents() {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setAgents(listAgents());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback((id: string) => {
    deleteAgent(id);
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleStatus = useCallback((id: string, current: AgentStatus) => {
    const next = current === "active" ? "paused" : "active";
    const updated = setAgentStatus(id, next);
    if (updated) {
      setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
    }
  }, []);

  return { agents, loading, refresh, remove, toggleStatus };
}

// ── Agent unique ──────────────────────────────────────────────────────────────

export function useLocalAgent(id: string) {
  const [agent, setAgent]     = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAgent(getAgent(id));
    setLoading(false);
  }, [id]);

  const update = useCallback(
    (patch: Partial<Omit<Agent, "id" | "user_id" | "created_at">>) => {
      const updated = updateAgent(id, patch);
      if (updated) setAgent(updated);
      return updated;
    },
    [id]
  );

  return { agent, loading, update };
}

// ── Création ──────────────────────────────────────────────────────────────────

export function useCreateAgent() {
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    (formData: AgentFormData, systemPrompt: SystemPromptConfig): Agent => {
      setSaving(true);
      try {
        return createAgent(formData, systemPrompt);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { save, saving };
}
