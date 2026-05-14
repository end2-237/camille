"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import type { Agent, AgentStatus } from "@/types/agent";

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  remove: (id: string) => Promise<void>;
  toggleStatus: (id: string, current: AgentStatus) => Promise<void>;
}

export function useAgents(): UseAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [tick, setTick]     = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch("/api/agents", { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setAgents(d.agents ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tick]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Suppression échouée");
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleStatus = useCallback(async (id: string, current: AgentStatus) => {
    const next = current === "active" ? "paused" : "active";
    const res = await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    const { agent } = await res.json();
    setAgents((prev) => prev.map((a) => (a.id === id ? agent : a)));
  }, []);

  return { agents, loading, error, refetch, remove, toggleStatus };
}
