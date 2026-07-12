"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter }                    from "next/navigation";
import { motion, AnimatePresence }      from "framer-motion";
import {
  Plus, Bot, Search, Sparkles, Pause,
  MoreHorizontal, Settings, Trash2, Play,
  ArrowUpRight,
} from "lucide-react";
import { toast }        from "sonner";
import { useAuth }      from "@/hooks/useAuth";
import { useAgents }    from "@/hooks/useAgents";
import { cn }           from "@/lib/utils";
import type { Agent }   from "@/types/agent";

const SECTOR_LABELS: Record<string, string> = {
  ecommerce:       "E-commerce",
  hospitality:     "Hôtellerie",
  healthcare:      "Santé",
  finance:         "Finance",
  education:       "Éducation",
  real_estate:     "Immobilier",
  legal:           "Juridique",
  beauty_wellness: "Beauté & Bien-être",
  food_beverage:   "Restauration",
  tech_saas:       "Tech / SaaS",
  consulting:      "Conseil",
  nonprofit:       "Associatif",
  other:           "Autre",
};

const MODEL_SHORT: Record<string, string> = {
  // Groq — disponibles
  "llama-3.1-8b-instant":       "Llama 3.1 8B",
  "llama-3.3-70b-versatile":    "Llama 3.3 70B",
  "mixtral-8x7b-32768":         "Mixtral 8x7B",
  // OpenAI / Anthropic — bientôt
  "gpt-4o":                     "GPT-4o",
  "gpt-4o-mini":                "GPT-4o mini",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-3-haiku-20240307":    "Claude 3 Haiku",
};

function StatusDot({ status }: { status: Agent["status"] }) {
  const map = {
    active:   { color: "#34D399", label: "Actif" },
    draft:    { color: "rgba(255,255,255,0.2)", label: "Brouillon" },
    paused:   { color: "#FBBF24", label: "Pausé" },
    archived: { color: "#F87171", label: "Archivé" },
  } as const;
  const { color, label } = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color }}>
      <span className={cn("inline-block w-1.5 h-1.5 rounded-full", status === "active" && "animate-pulse")}
        style={{ background: color }} />
      {label}
    </span>
  );
}

function RowActions({ agent, onConfigure, onToggle, onDelete }: {
  agent: Agent; onConfigure: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1 rounded transition-colors duration-150 hover:bg-[var(--surface-glass)]"
        style={{ color: "var(--text-disabled)" }}>
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -2 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -2 }} transition={{ duration: 0.12 }}
              className="absolute right-0 top-7 z-20 w-40 rounded-lg overflow-hidden py-1"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
            >
              {[
                { icon: Settings, label: "Configurer",    action: onConfigure, color: "var(--text-secondary)" },
                {
                  icon: agent.status === "active" ? Pause : Play,
                  label: agent.status === "active" ? "Mettre en pause" : "Activer",
                  action: onToggle,
                  color: agent.status === "active" ? "#FBBF24" : "#34D399",
                },
                { icon: Trash2, label: "Supprimer", action: onDelete, color: "#F87171" },
              ].map(({ icon: Icon, label, action, color }) => (
                <button key={label}
                  onClick={(e) => { e.stopPropagation(); setOpen(false); action(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors duration-100 hover:bg-[var(--surface-glass)]"
                  style={{ color }}>
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentRow({ agent, onConfigure, onToggle, onDelete }: {
  agent: Agent; onConfigure: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const activeCaps = Object.values(agent.capabilities ?? {}).filter(Boolean).length;
  return (
    <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onConfigure}
      className="group cursor-pointer border-b border-[var(--border-subtle)] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.018)]"
    >
      <td className="py-2.5 pl-6 pr-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: "rgba(124,90,248,0.06)", border: "1px solid rgba(124,90,248,0.12)" }}>
            {agent.identity.avatar_emoji ?? "🤖"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {agent.identity.name}
            </p>
            {agent.identity.tagline && (
              <p className="text-[10px] truncate" style={{ color: "var(--text-disabled)" }}>
                {agent.identity.tagline}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="py-2.5 px-4">
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {SECTOR_LABELS[agent.business_context?.sector] ?? agent.business_context?.sector}
        </span>
      </td>
      <td className="py-2.5 px-4">
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "rgba(124,90,248,0.65)" }}>
          <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
          {MODEL_SHORT[agent.target_model] ?? agent.target_model}
        </span>
      </td>
      <td className="py-2.5 px-4">
        <span className="text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {activeCaps} / {Object.keys(agent.capabilities ?? {}).length}
        </span>
      </td>
      <td className="py-2.5 px-4"><StatusDot status={agent.status} /></td>
      <td className="py-2.5 px-4">
        <span className="text-[11px] tabular-nums" style={{ color: "var(--text-disabled)" }}>
          {new Date(agent.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </td>
      <td className="py-2.5 pl-4 pr-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); onConfigure(); }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all duration-150 opacity-0 group-hover:opacity-100"
            style={{ color: "var(--color-gold)", background: "rgba(124,90,248,0.06)", border: "1px solid rgba(124,90,248,0.15)" }}>
            Configurer <ArrowUpRight className="w-2.5 h-2.5" />
          </button>
          <RowActions agent={agent} onConfigure={onConfigure} onToggle={onToggle} onDelete={onDelete} />
        </div>
      </td>
    </motion.tr>
  );
}

function EmptyState({ query, onNew }: { query: string; onNew: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ border: "1px solid var(--border-subtle)", background: "var(--surface-glass)" }}>
        {query
          ? <Search className="w-4 h-4" style={{ color: "var(--text-disabled)" }} />
          : <Bot className="w-4 h-4" style={{ color: "var(--text-disabled)" }} />}
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {query ? `Aucun résultat pour "${query}"` : "Aucun agent"}
        </p>
        <p className="text-xs" style={{ color: "var(--text-disabled)" }}>
          {query ? "Essayez un autre terme." : "Créez votre premier agent en moins de 5 minutes."}
        </p>
      </div>
      {!query && (
        <button onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 hover:brightness-110"
          style={{ color: "var(--color-gold)", background: "rgba(124,90,248,0.06)", border: "1px solid rgba(124,90,248,0.18)" }}>
          <Plus className="w-3 h-3" />
          Créer mon premier agent
        </button>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const router                                        = useRouter();
  const { isLoggedIn }                                = useAuth();
  const { agents, loading, remove, toggleStatus }     = useAgents();
  const [query, setQuery]                             = useState("");
  const [mounted, setMounted]                         = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted && !isLoggedIn) router.replace("/login"); }, [isLoggedIn, mounted, router]);

  const filtered = useMemo(
    () => agents.filter((a) =>
      !query ||
      a.identity.name.toLowerCase().includes(query.toLowerCase()) ||
      (a.business_context?.business_name ?? "").toLowerCase().includes(query.toLowerCase())
    ),
    [agents, query]
  );

  const activeCount = agents.filter((a) => a.status === "active").length;
  const pausedCount = agents.filter((a) => a.status === "paused").length;
  const avgTokens   = agents.length
    ? Math.round(agents.reduce((s, a) => s + (a.system_prompt?.estimated_tokens ?? 0), 0) / agents.length)
    : 0;

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Supprimer "${agent.identity.name}" ?`)) return;
    try {
      await remove(agent.id);
      toast.success(`"${agent.identity.name}" supprimé.`);
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const stats = [
    { label: "Total",    value: mounted ? agents.length : 0,    unit: "agents" },
    { label: "Actifs",   value: mounted ? activeCount   : 0,    unit: "en ligne",  accent: true },
    { label: "En pause", value: mounted ? pausedCount   : 0,    unit: "suspendus" },
    { label: "Tokens",   value: mounted && agents.length ? avgTokens.toLocaleString("fr-FR") : "—", unit: "moy. / prompt" },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="h-[52px] flex items-center justify-between px-7 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Mes agents</h1>
          <span className="text-xs" style={{ color: "var(--text-disabled)" }}>
            {mounted ? `${agents.length} configuré${agents.length !== 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <button onClick={() => router.push("/configure")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 hover:brightness-110"
          style={{ color: "var(--color-gold)", background: "rgba(124,90,248,0.08)", border: "1px solid rgba(124,90,248,0.18)" }}>
          <Plus className="w-3 h-3" />
          Nouvel agent
        </button>
      </header>

      <div className="grid grid-cols-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {stats.map((s, i) => (
          <div key={s.label} className="px-7 py-4"
            style={{ borderRight: i < 3 ? "1px solid var(--border-subtle)" : undefined }}>
            <p className="text-[10px] font-medium uppercase tracking-widest mb-1.5" style={{ color: "var(--text-disabled)" }}>
              {s.label}
            </p>
            <p className="text-xl font-bold tabular-nums leading-none"
              style={{ color: s.accent ? "var(--color-gold)" : "var(--text-primary)" }}>
              {s.value}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-disabled)" }}>{s.unit}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2.5 px-6 h-10 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un agent…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--text-disabled)]"
            style={{ color: "var(--text-primary)" }} />
          {query && (
            <button onClick={() => setQuery("")} className="text-[10px] transition-colors"
              style={{ color: "var(--text-disabled)" }}>esc</button>
          )}
        </div>

        {!mounted || loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border border-t-[var(--color-gold)] border-white/10 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState query={query} onNew={() => router.push("/configure")} />
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {[
                    { label: "Agent",     cls: "pl-6 pr-4" },
                    { label: "Secteur",   cls: "px-4" },
                    { label: "Modèle",    cls: "px-4" },
                    { label: "Capacités", cls: "px-4" },
                    { label: "Statut",    cls: "px-4" },
                    { label: "Créé",      cls: "px-4" },
                    { label: "",          cls: "pl-4 pr-5" },
                  ].map(({ label, cls }) => (
                    <th key={label}
                      className={cn("py-2.5 text-[10px] font-semibold uppercase tracking-widest text-left", cls)}
                      style={{ color: "var(--text-disabled)" }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((agent) => (
                    <AgentRow key={agent.id} agent={agent}
                      onConfigure={() => router.push(`/dashboard/${agent.id}`)}
                      onToggle={async () => {
                        await toggleStatus(agent.id, agent.status);
                        toast.success(
                          agent.status === "active"
                            ? `"${agent.identity.name}" mis en pause.`
                            : `"${agent.identity.name}" activé.`
                        );
                      }}
                      onDelete={() => handleDelete(agent)}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {mounted && filtered.length > 0 && (
          <div className="h-9 flex items-center px-6 flex-shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
              {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
              {query ? ` pour "${query}"` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
