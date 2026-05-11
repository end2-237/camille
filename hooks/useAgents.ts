// ─────────────────────────────────────────────────────────────────────────────
// hooks/useAgents.ts — Camille by Buyticle
// Data-fetching hook for the full agent list.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Agent } from "@/types/agent";

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAgents(): UseAgentsReturn {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch("/api/agents")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setAgents(d.agents ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tick]);

  return { agents, loading, error, refetch };
}
