"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
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
  const [agent, setAgent]     = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/agents/${agentId}`, { headers: authHeaders() })
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

      setAgent((prev) => prev ? { ...prev, ...payload } : prev);

      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          method: "PATCH",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Erreur serveur" }));
          throw new Error(errData.error ?? "Update failed");
        }
        const { agent: updated } = await res.json();
        setAgent(updated);
        toast.success("Agent mis à jour");
      } catch (e) {
        setAgent(agent);
        toast.error(e instanceof Error ? e.message : "Erreur lors de la mise à jour");
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
