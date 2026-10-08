"use client";

// ─────────────────────────────────────────────────────────────────────────────
// L'agent courant, partagé par tout le tableau de bord.
//
// Celui de l'URL quand la page en a un (/dashboard/<id>/…), sinon le dernier
// choisi (gardé dans le navigateur), sinon le premier agent en ligne.
// `bascule` change seulement quand on choisit explicitement un agent avec le
// bouton flottant : les pages qui filtrent par agent (commandes, statistiques)
// l'écoutent pour suivre ce choix sans perdre leur « tous les agents » initial.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAgents } from "@/hooks/useAgents";
import type { Agent } from "@/types/agent";

const CLE = "camille_agent_courant";

type Valeur = ReturnType<typeof useAgents> & {
  visibles: Agent[];
  agent?: Agent;
  /** L'identifiant présent dans l'URL, s'il y en a un. */
  agentUrl?: string;
  choisir: (id: string) => void;
  bascule: { id: string; n: number } | null;
  basculer: (id: string) => void;
};

const Contexte = createContext<Valeur | null>(null);

export const idDansUrl = (chemin: string) => chemin.match(/^\/dashboard\/([0-9a-fA-F-]{8,})/)?.[1];

export function FournisseurAgent({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  const base = useAgents();
  const [choisi, setChoisi] = useState<string | null>(null);
  const [bascule, setBascule] = useState<Valeur["bascule"]>(null);

  useEffect(() => {
    try { setChoisi(localStorage.getItem(CLE)); } catch { /* sans stockage, le premier agent */ }
  }, []);

  const choisir = useCallback((id: string) => {
    setChoisi(id);
    try { localStorage.setItem(CLE, id); } catch { /* sans conséquence */ }
  }, []);

  const basculer = useCallback((id: string) => {
    choisir(id);
    setBascule((b) => ({ id, n: (b?.n || 0) + 1 }));
  }, [choisir]);

  const agentUrl = idDansUrl(chemin);
  const visibles = useMemo(() => base.agents.filter((a) => a.status !== "archived"), [base.agents]);
  const agent =
    visibles.find((a) => a.id === agentUrl) ||
    visibles.find((a) => a.id === choisi) ||
    visibles.find((a) => a.status === "active") ||
    visibles[0];

  // L'agent ouvert par l'URL devient le choix courant : en revenant à
  // l'accueil, on le retrouve sélectionné.
  useEffect(() => { if (agentUrl && agentUrl !== choisi) choisir(agentUrl); }, [agentUrl, choisi, choisir]);

  return (
    <Contexte.Provider value={{ ...base, visibles, agent, agentUrl, choisir, bascule, basculer }}>
      {children}
    </Contexte.Provider>
  );
}

export function useAgentCourant(): Valeur {
  const v = useContext(Contexte);
  if (!v) throw new Error("useAgentCourant hors du tableau de bord");
  return v;
}

/** Pour les pages qui peuvent vivre hors de la coquille : null au lieu de lever. */
export function useAgentCourantOptionnel(): Valeur | null {
  return useContext(Contexte);
}
