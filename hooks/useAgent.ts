// ─────────────────────────────────────────────────────────────────────────────
// hooks/useAgent.ts — Camille by Buyticle
// Data-fetching hook for a single agent with optimistic updates.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Agent, UpdateAgentPayload } from "@/types/agent";

interface UseAgentReturn {
  agent: Agent | null;
  loading: boolean;
  error: string | null;
  update: (payload: UpdateAgentPayload) => Promise<void>;
  toggleStatus: () => Promise<void>;
  refetch: () => void;
}

export function useAgent(agentId: string): UseAgentReturn {
  const [agent, setAgent]   = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/agents/${agentId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setAgent(d.agent))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agentId, version]);

  const update = useCallback(
    async (payload: UpdateAgentPayload) => {
      if (!agent) return;

      // Optimistic update
      setAgent((prev) => prev ? { ...prev, ...payload } : prev);

      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Update failed");
        const { agent: updated } = await res.json();
        setAgent(updated);
        toast.success("Agent mis à jour");
      } catch (e) {
        // Revert on failure
        setAgent(agent);
        toast.error("Erreur lors de la mise à jour");
        console.error("[useAgent.update]", e);
      }
    },
    [agent, agentId]
  );

  const toggleStatus = useCallback(async () => {
    if (!agent) return;
    const next = agent.status === "active" ? "paused" : "active";
    await update({ status: next });
  }, [agent, update]);

  return { agent, loading, error, update, toggleStatus, refetch };
}
