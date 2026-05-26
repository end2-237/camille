// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/[agentId]/page.tsx — Camille by Buyticle
// Configuration complète d'un agent avec navigation par onglets.
// Inspiré de l'interface ElevenLabs : sidebar gauche + contenu tabulé.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence }          from "framer-motion";
import {
  ArrowLeft, Sparkles, Bot, BookOpen,
  Zap, Code2, Plug2, RefreshCw, Copy, Check,
  Save, Pencil, Plus, Trash2, Play, Pause,
  MessageCircle, Globe, Phone, Clock,
  Users, ChevronDown, LayoutDashboard, TrendingUp,
  History, FileText, Target, UserPlus, Send, Image, Calendar,
  Upload, Mic2, Video, X,
} from "lucide-react";
import { toast }                from "sonner";
import { useAuth }             from "@/hooks/useAuth";
import { useAgent }            from "@/hooks/useAgent";
import { generateSystemPrompt } from "@/lib/generateSystemPrompt";
import { cn }                      from "@/lib/utils";
import type { Agent, AgentModel, FAQEntry } from "@/types/agent";
import type { DbCapability } from "@/lib/plans-db";

// ── Label maps ────────────────────────────────────────────────────────────────

const SECTOR_OPTIONS = [
  { value: "ecommerce",       label: "E-commerce" },
  { value: "hospitality",     label: "Hôtellerie" },
  { value: "healthcare",      label: "Santé" },
  { value: "finance",         label: "Finance" },
  { value: "education",       label: "Éducation" },
  { value: "real_estate",     label: "Immobilier" },
  { value: "legal",           label: "Juridique" },
  { value: "beauty_wellness", label: "Beauté & Bien-être" },
  { value: "food_beverage",   label: "Restauration" },
  { value: "tech_saas",       label: "Tech / SaaS" },
  { value: "consulting",      label: "Conseil" },
  { value: "nonprofit",       label: "Associatif" },
  { value: "other",           label: "Autre" },
];

const VOICE_OPTIONS = [
  { value: "professional",  label: "Professionnel" },
  { value: "friendly",      label: "Chaleureux" },
  { value: "casual",        label: "Décontracté" },
  { value: "luxury",        label: "Luxe" },
  { value: "technical",     label: "Technique" },
  { value: "empathetic",    label: "Empathique" },
  { value: "authoritative", label: "Autoritaire" },
];

const LANG_OPTIONS = [
  { value: "fr", label: "Français 🇫🇷" },
  { value: "en", label: "English 🇬🇧" },
  { value: "es", label: "Español 🇪🇸" },
  { value: "ar", label: "العربية 🇸🇦" },
  { value: "pt", label: "Português 🇧🇷" },
  { value: "de", label: "Deutsch 🇩🇪" },
  { value: "it", label: "Italiano 🇮🇹" },
  { value: "nl", label: "Nederlands 🇳🇱" },
];

const MODEL_OPTIONS: { value: string; label: string; sub: string; available: boolean }[] = [
  // Groq — disponibles
  { value: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",     sub: "Groq · Ultra-rapide · Recommandé",         available: true  },
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",    sub: "Groq · Bientôt disponible",                available: false },
  { value: "mixtral-8x7b-32768",      label: "Mixtral 8x7B",     sub: "Groq · Bientôt disponible",                available: false },
  // Bientôt
  { value: "gpt-4o",                  label: "GPT-4o",            sub: "OpenAI · Bientôt disponible",              available: false },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", sub: "Anthropic · Bientôt disponible",        available: false },
];

const EMOJI_PRESETS = ["✨","🤖","💼","🛍️","🏥","📚","🏠","⚖️","💄","🍽️","💻","🤝","💡","🎯","🦁","🦊","🦋","🌟","🔮","🎨"];

// ── Capability icon map (nom DB → composant lucide) ───────────────────────────

const CAP_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  MessageCircle, Clock, History, UserPlus, FileText,
  Target, Send, Users, Image, Zap, Sparkles, LayoutDashboard, Calendar,
};
function CapIconDash({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = CAP_ICON_MAP[name] ?? Zap;
  return <Icon className={className} style={style} />;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Field({
  label, hint, children, required,
}: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
        {label}
        {required && <span className="ml-1 text-[var(--color-gold)]">*</span>}
      </label>
      {children}
      {hint && <p className="text-2xs" style={{ color: "var(--text-disabled)" }}>{hint}</p>}
    </div>
  );
}

function FInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      className={cn("w-full px-3 py-1.5 rounded-md text-xs outline-none transition-all duration-150", className)}
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
      {...props}
    />
  );
}

function FTextarea({ className, rows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return (
    <textarea
      rows={rows}
      className={cn("w-full px-3 py-2 rounded-md text-xs resize-none outline-none transition-all duration-150", className)}
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", lineHeight: 1.6 }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
      {...props}
    />
  );
}

function FSelect({ options, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className="relative">
      <select
        className={cn("w-full px-3 py-1.5 rounded-md text-xs outline-none appearance-none transition-all duration-150 pr-8", className)}
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
        {...props}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
    </div>
  );
}

function SaveBar({ dirty, onSave }: { dirty: boolean; onSave: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex items-center justify-between px-4 py-2.5 rounded-lg mb-5"
          style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)" }}
        >
          <p className="text-xs" style={{ color: "rgba(212,175,55,0.8)" }}>
            Modifications non sauvegardées
          </p>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium
                       transition-all duration-150 hover:brightness-110"
            style={{ background: "rgba(212,175,55,0.12)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.25)" }}
          >
            <Save className="w-3 h-3" />
            Sauvegarder
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest pb-2"
        style={{ color: "var(--text-disabled)", borderBottom: "1px solid var(--border-subtle)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

// ── Usage data types ──────────────────────────────────────────────────────────
interface UsageData {
  plan:    { id: string; label: string; limit: number; unlimited: boolean };
  current: { period: string; total_tokens: number; remaining: number; percent: number; prompt_tokens: number; completion_tokens: number };
  plans:   { id: string; label: string; monthly_tokens: number; price_eur: number; current: boolean }[];
}

const PLAN_COLORS: Record<string, string> = {
  free:       "var(--text-disabled)",
  starter:    "#60a5fa",
  pro:        "var(--color-gold)",
  enterprise: "#a78bfa",
};

function UsageSection({ agentId, token }: { agentId: string; token: string | null }) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/usage?agentId=${agentId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setUsage(d))
      .catch(() => {});
  }, [agentId, token]);

  if (!usage) return null;

  const { plan, current } = usage;
  const pct = Math.min(100, current.percent);
  const barColor = pct >= 90 ? "#f87171" : pct >= 70 ? "#fbbf24" : "var(--color-gold)";

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--text-disabled)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>Utilisation · {current.period}</span>
        </div>
        <span className="text-2xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(212,175,55,0.1)", color: PLAN_COLORS[plan.id] ?? "var(--color-gold)", border: `1px solid ${PLAN_COLORS[plan.id] ?? "var(--color-gold)"}30` }}>
          {plan.label}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {current.total_tokens.toLocaleString("fr-FR")}
            <span className="text-2xs font-normal ml-1" style={{ color: "var(--text-disabled)" }}>tokens</span>
          </span>
          {plan.unlimited ? (
            <span className="text-2xs" style={{ color: "var(--text-disabled)" }}>Illimité</span>
          ) : (
            <span className="text-2xs tabular-nums" style={{ color: "var(--text-disabled)" }}>
              / {plan.limit.toLocaleString("fr-FR")} · {pct}%
            </span>
          )}
        </div>
        {!plan.unlimited && (
          <div className="w-full rounded-full overflow-hidden" style={{ height: "5px", background: "var(--border-subtle)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ height: "100%", borderRadius: "99px", background: barColor }}
            />
          </div>
        )}
      </div>

      {/* Détail prompt / completion */}
      <div className="flex gap-4">
        <div>
          <p className="text-2xs" style={{ color: "var(--text-disabled)" }}>Prompt</p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-tertiary)" }}>{current.prompt_tokens.toLocaleString("fr-FR")}</p>
        </div>
        <div>
          <p className="text-2xs" style={{ color: "var(--text-disabled)" }}>Réponse</p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-tertiary)" }}>{current.completion_tokens.toLocaleString("fr-FR")}</p>
        </div>
        {!plan.unlimited && (
          <div className="ml-auto text-right">
            <p className="text-2xs" style={{ color: "var(--text-disabled)" }}>Restant</p>
            <p className="text-xs font-semibold tabular-nums" style={{ color: pct >= 90 ? "#f87171" : "var(--text-tertiary)" }}>
              {current.remaining.toLocaleString("fr-FR")}
            </p>
          </div>
        )}
      </div>

      {/* Alerte limite proche */}
      {!plan.unlimited && pct >= 80 && (
        <div className="rounded-lg px-3 py-2 text-2xs" style={{ background: pct >= 90 ? "rgba(248,113,113,0.08)" : "rgba(251,191,36,0.08)", color: pct >= 90 ? "#f87171" : "#fbbf24", border: `1px solid ${pct >= 90 ? "rgba(248,113,113,0.2)" : "rgba(251,191,36,0.2)"}` }}>
          {pct >= 90
            ? "⚠️ Limite presque atteinte — le bot cessera de répondre à 100%."
            : "Vous approchez de votre limite mensuelle."}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ agent, onToggleStatus, token, capabilities }: { agent: Agent; onToggleStatus: () => void; token: string | null; capabilities: DbCapability[] }) {
  const [copied, setCopied] = useState(false);
  const copyId = async () => {
    await navigator.clipboard.writeText(agent.id);
    setCopied(true);
    toast.success("ID copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  // Cap meta driven from DB (fall back to empty until loaded)
  const capsForOverview = capabilities.filter((c) => c.status !== "disabled");

  return (
    <div className="space-y-5">
      {/* Agent header strip */}
      <div className="flex items-center gap-3 pb-5"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)" }}>
          {agent.identity.avatar_emoji ?? "🤖"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none" style={{ color: "var(--text-primary)" }}>{agent.identity.name}</p>
          {agent.identity.tagline && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-disabled)" }}>{agent.identity.tagline}</p>
          )}
        </div>
        <button onClick={onToggleStatus}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors duration-150"
          style={{ color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-glass)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          {agent.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {agent.status === "active" ? "Mettre en pause" : "Activer"}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4"
        style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
        {[
          { label: "Tokens",       value: agent.system_prompt.estimated_tokens.toLocaleString("fr-FR") },
          { label: "Version",      value: `v${agent.system_prompt.version}` },
          { label: "Modèle",       value: agent.target_model.split("-")[0].toUpperCase() },
          { label: "Mise à jour",  value: new Date(agent.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) },
        ].map(({ label, value }, i) => (
          <div key={label} className="px-4 py-3"
            style={{ borderRight: i < 3 ? "1px solid var(--border-subtle)" : undefined }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-disabled)" }}>{label}</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Capabilities */}
      <SectionCard title="Capacités activées">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {capsForOverview.map((cap) => {
            const agentCaps = agent.capabilities as unknown as Record<string, boolean>;
            // capacités non-toggleables (Core/Auto) sont toujours considérées actives
            const active = !cap.is_user_configurable || agentCaps[cap.id] === true;
            return (
              <div key={cap.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{
                  background: active ? "rgba(212,175,55,0.08)" : "var(--bg-muted)",
                  border: `1px solid ${active ? "rgba(212,175,55,0.2)" : "var(--border-subtle)"}`,
                  opacity: active ? 1 : 0.4,
                }}>
                <CapIconDash name={cap.icon} className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: active ? "var(--color-gold)" : "var(--text-disabled)" }} />
                <span className="text-2xs font-medium truncate"
                  style={{ color: active ? "var(--color-gold)" : "var(--text-tertiary)" }}>
                  {cap.label}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Usage tokens */}
      <UsageSection agentId={agent.id} token={token} />

      {/* ID */}
      <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-disabled)" }}>Agent ID</p>
          <p className="text-xs font-mono truncate" style={{ color: "var(--text-tertiary)" }}>{agent.id}</p>
        </div>
        <button onClick={copyId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-medium flex-shrink-0 transition-all duration-200" style={{ background: "var(--surface-glass)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

// ── Tab: Identity ─────────────────────────────────────────────────────────────

function IdentityTab({ agent, onSave }: { agent: Agent; onSave: (p: Partial<Agent>) => void }) {
  const [form, setForm] = useState({ ...agent.identity });
  const dirty = JSON.stringify(form) !== JSON.stringify(agent.identity);
  const save = () => { onSave({ identity: { ...form } }); toast.success("Identité mise à jour !"); };

  return (
    <div className="space-y-6">
      <SaveBar dirty={dirty} onSave={save} />
      <SectionCard title="Avatar">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: "var(--surface-gold)", border: "1px solid var(--border-gold)" }}>
            {form.avatar_emoji ?? "🤖"}
          </div>
          <div className="flex flex-wrap gap-2">
            {EMOJI_PRESETS.map((e) => (
              <button key={e} onClick={() => setForm((f) => ({ ...f, avatar_emoji: e }))}
                className={cn("w-9 h-9 rounded-xl text-lg transition-all duration-150", form.avatar_emoji === e ? "scale-110" : "opacity-60 hover:opacity-100 hover:scale-105")}
                style={form.avatar_emoji === e ? { background: "var(--surface-gold)", border: "1px solid var(--border-gold)" } : { background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Personnalité">
        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Nom de l'agent" required>
            <FInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Camille, Aria, Max…" />
          </Field>
          <Field label="Tagline" hint="Courte description affichée sous le nom">
            <FInput value={form.tagline ?? ""} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="Votre assistant commerce premium" />
          </Field>
          <Field label="Voix de marque" required>
            <FSelect value={form.brand_voice} onChange={(e) => setForm((f) => ({ ...f, brand_voice: e.target.value as typeof f.brand_voice }))} options={VOICE_OPTIONS} />
          </Field>
          <Field label="Langue principale" required>
            <FSelect value={form.primary_language} onChange={(e) => setForm((f) => ({ ...f, primary_language: e.target.value as typeof f.primary_language }))} options={LANG_OPTIONS} />
          </Field>
        </div>
        <Field label="Langues secondaires" hint="L'agent bascule si le client écrit dans ces langues">
          <div className="flex flex-wrap gap-2 mt-1">
            {LANG_OPTIONS.filter((l) => l.value !== form.primary_language).map((l) => {
              const active = (form.secondary_languages ?? []).includes(l.value as any);
              return (
                <button key={l.value} onClick={() => setForm((f) => ({ ...f, secondary_languages: active ? (f.secondary_languages ?? []).filter((x) => x !== l.value) : [...(f.secondary_languages ?? []), l.value as any] }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                  style={active ? { background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" } : { background: "var(--bg-muted)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
                  {l.label}
                </button>
              );
            })}
          </div>
        </Field>
      </SectionCard>
    </div>
  );
}

// ── Tab: Business ─────────────────────────────────────────────────────────────

function BusinessTab({ agent, onSave }: { agent: Agent; onSave: (p: Partial<Agent>) => void }) {
  const [form, setForm] = useState({ ...agent.business_context });
  const dirty = JSON.stringify(form) !== JSON.stringify(agent.business_context);
  const save = () => { onSave({ business_context: { ...form } }); toast.success("Contexte métier mis à jour !"); };
  const sf = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <SaveBar dirty={dirty} onSave={save} />
      <SectionCard title="Identité de l'entreprise">
        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Nom de l'entreprise" required><FInput value={form.business_name} onChange={sf("business_name")} placeholder="Ma Boutique SAS" /></Field>
          <Field label="Secteur d'activité" required><FSelect value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value as typeof f.sector }))} options={SECTOR_OPTIONS} /></Field>
          <Field label="Responsable" required><FInput value={form.owner_name} onChange={sf("owner_name")} placeholder="Marie Dupont" /></Field>
          <Field label="Email de contact" required><FInput type="email" value={form.owner_email} onChange={sf("owner_email")} placeholder="contact@boutique.fr" /></Field>
        </div>
        <Field label="Description" required hint="Présentez votre activité en 1-2 phrases">
          <FTextarea value={form.description} onChange={sf("description")} placeholder="Boutique de mode éco-responsable…" rows={3} />
        </Field>
      </SectionCard>

      <SectionCard title="Coordonnées & présence">
        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Site web"><FInput value={form.website_url ?? ""} onChange={sf("website_url")} placeholder="https://maboutique.fr" /></Field>
          <Field label="Localisation"><FInput value={form.location ?? ""} onChange={sf("location")} placeholder="Paris, France" /></Field>
          <Field label="WhatsApp Business"><FInput value={form.whatsapp_number ?? ""} onChange={sf("whatsapp_number")} placeholder="+33 6 12 34 56 78" /></Field>
        </div>
        <Field label="Audience cible" hint="Décrivez votre client idéal">
          <FTextarea value={form.target_audience ?? ""} onChange={sf("target_audience")} placeholder="Femmes 25-45 ans, CSP+, sensibles à l'éco-responsabilité…" rows={2} />
        </Field>
      </SectionCard>
    </div>
  );
}

// ── Tab: Knowledge ────────────────────────────────────────────────────────────

function KnowledgeTab({ agent, onSave }: { agent: Agent; onSave: (p: Partial<Agent>) => void }) {
  const [form, setForm]           = useState({ ...agent.knowledge_base });
  const [faqDraft, setFaqDraft]   = useState<FAQEntry[]>(form.faq ?? []);
  const [forbidden, setForbidden] = useState<string[]>(form.forbidden_topics ?? []);
  const [newTag, setNewTag]       = useState("");

  const dirty = JSON.stringify({ ...form, faq: faqDraft, forbidden_topics: forbidden }) !== JSON.stringify(agent.knowledge_base);
  const save = () => { onSave({ knowledge_base: { ...form, faq: faqDraft, forbidden_topics: forbidden } }); toast.success("Base de connaissance mise à jour !"); };

  const addFaq    = () => setFaqDraft((f) => [...f, { question: "", answer: "" }]);
  const removeFaq = (i: number) => setFaqDraft((f) => f.filter((_, idx) => idx !== i));
  const updateFaq = (i: number, k: keyof FAQEntry, v: string) => setFaqDraft((f) => f.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const addTag    = () => { if (!newTag.trim()) return; setForbidden((f) => [...f, newTag.trim()]); setNewTag(""); };

  return (
    <div className="space-y-6">
      <SaveBar dirty={dirty} onSave={save} />

      <SectionCard title="Informations clés">
        {[
          { key: "products_services", label: "Produits & Services",  placeholder: "Robe en coton bio 49€, Jean recyclé 89€…" },
          { key: "pricing_info",      label: "Tarifs & Offres",      placeholder: "Livraison gratuite dès 60€, -20% fidélité…" },
          { key: "business_hours",    label: "Horaires d'ouverture", placeholder: "Lun-Ven 9h-18h, Sam 10h-17h" },
          { key: "policies",          label: "Politiques",           placeholder: "Retours sous 30 jours, remboursement intégral…" },
        ].map(({ key, label, placeholder }) => (
          <Field key={key} label={label}>
            <FTextarea value={(form as any)[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} rows={3} />
          </Field>
        ))}
      </SectionCard>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>FAQ ({faqDraft.length})</h3>
          <button onClick={addFaq} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200" style={{ background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }}>
            <Plus className="w-3 h-3" />Ajouter
          </button>
        </div>
        {faqDraft.length === 0 && <p className="text-sm py-4 text-center" style={{ color: "var(--text-disabled)" }}>Ajoutez des questions fréquentes pour affiner les réponses.</p>}
        <div className="space-y-3">
          <AnimatePresence>
            {faqDraft.map((entry, i) => (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>Q{i + 1}</span>
                  <button onClick={() => removeFaq(i)} className="p-1 rounded-lg transition-colors hover:bg-red-500/10" style={{ color: "#F87171" }}><Trash2 className="w-3 h-3" /></button>
                </div>
                <FInput value={entry.question} onChange={(e) => updateFaq(i, "question", e.target.value)} placeholder="Question fréquente…" />
                <FTextarea value={entry.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} placeholder="Réponse détaillée…" rows={2} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>Sujets interdits</h3>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>L'agent refusera d'aborder ces sujets.</p>
        <div className="flex gap-2">
          <FInput value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Concurrents, politique…" className="flex-1" />
          <button onClick={addTag} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }}><Plus className="w-4 h-4" /></button>
        </div>
        {forbidden.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {forbidden.map((t) => (
              <span key={t} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs" style={{ background: "rgba(239,68,68,0.10)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {t}
                <button onClick={() => setForbidden((f) => f.filter((x) => x !== t))} className="hover:text-red-300 transition-colors">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Capabilities ─────────────────────────────────────────────────────────

type OwnerSession = {
  id: string;
  phone: string;
  authenticated_at: string;
  last_activity: string;
  expires_at: string;
};

// ── MediaUploadCard ───────────────────────────────────────────────────────────

function MediaUploadCard({
  agentId,
  type,
  initialUrl,
  label,
  formats,
}: {
  agentId:    string;
  type:       "audio" | "video";
  initialUrl: string | null;
  label:      string;
  formats:    string;
}) {
  const [url,       setUrl]       = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [err,       setErr]       = useState<string | null>(null);
  const [dragOver,  setDragOver]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync avec la DB si l'agent est rechargé (ex: après une sauvegarde SQL directe)
  useEffect(() => { setUrl(initialUrl); }, [initialUrl]);

  const accept = type === "audio"
    ? "audio/ogg,audio/mpeg,audio/mp4,audio/aac,audio/x-m4a"
    : "video/mp4,video/quicktime";

  const doUpload = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("camille_token") : null;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res  = await fetch(`/api/agents/${agentId}/media`, {
        method:  "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur upload");
      setUrl(data.url);
      toast.success(type === "audio" ? "Audio uploadé !" : "Vidéo uploadée !");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const doDelete = async () => {
    setErr(null);
    setDeleting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("camille_token") : null;
      const res  = await fetch(`/api/agents/${agentId}/media?type=${type}`, {
        method:  "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur suppression");
      setUrl(null);
      toast.success(type === "audio" ? "Audio supprimé." : "Vidéo supprimée.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  // Friendly filename from URL
  const fileName = url
    ? decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? url)
    : null;

  const MediaIcon = type === "audio" ? Mic2 : Video;

  return (
    <div className="space-y-2">
      {/* Label row */}
      <div className="flex items-center gap-1.5">
        <MediaIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
      </div>

      {url ? (
        /* ── File is set ──────────────────────────────────────────────── */
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          {/* Icon bubble */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(212,175,55,0.12)" }}>
            <MediaIcon className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} />
          </div>

          {/* Filename */}
          <p className="text-[11px] flex-1 min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>
            {fileName}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading || deleting}
              className="text-[10px] px-2 py-1 rounded-md font-medium transition-all duration-100"
              style={{
                background: "var(--surface-glass)",
                color:      "var(--text-tertiary)",
                border:     "1px solid var(--border-subtle)",
              }}>
              Remplacer
            </button>
            <button
              onClick={doDelete}
              disabled={uploading || deleting}
              title="Supprimer"
              className="w-6 h-6 flex items-center justify-center rounded-md transition-all duration-100"
              style={{ color: "var(--text-disabled)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-disabled)")}>
              {deleting
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : <X className="w-3 h-3" />}
            </button>
          </div>
        </div>
      ) : (
        /* ── Empty drop zone ──────────────────────────────────────────── */
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center gap-1.5 py-5 px-4 rounded-xl transition-all duration-200"
          style={{
            border:     `1.5px dashed ${dragOver ? "var(--color-gold)" : "var(--border-default)"}`,
            background: dragOver ? "rgba(212,175,55,0.04)" : "var(--bg-elevated)",
            cursor:     uploading ? "wait" : "pointer",
          }}>
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "var(--color-gold)" }} />
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Upload en cours…</p>
            </>
          ) : (
            <>
              <Upload
                className="w-4 h-4"
                style={{ color: dragOver ? "var(--color-gold)" : "var(--text-disabled)" }}
              />
              <p className="text-[11px] text-center" style={{ color: "var(--text-tertiary)" }}>
                Glissez un fichier ici ou{" "}
                <span style={{ color: "var(--color-gold)" }}>parcourir</span>
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{formats}</p>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {err && (
        <p className="text-[10px]" style={{ color: "#f87171" }}>{err}</p>
      )}

      {/* Auto-save confirmation */}
      {url && !uploading && !deleting && (
        <p className="text-[10px] flex items-center gap-1" style={{ color: "#34D399" }}>
          <Check className="w-2.5 h-2.5" /> Sauvegardé automatiquement
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

// ── CapabilitiesTab ───────────────────────────────────────────────────────────

function CapabilitiesTab({ agent, onSave, capabilities }: {
  agent: Agent;
  onSave: (p: Partial<Agent>) => void;
  capabilities: DbCapability[];
}) {
  const agentCaps = agent.capabilities as unknown as Record<string, unknown>;
  const [caps, setCaps] = useState({ ...agentCaps });

  const dirty = JSON.stringify(caps) !== JSON.stringify(agentCaps);

  const save = () => {
    onSave({ capabilities: { ...caps } as any });
    toast.success("Capacités mises à jour !");
  };

  const visibleCaps = capabilities.filter((c) => c.status !== "disabled");

  return (
    <div className="space-y-4">
      <SaveBar dirty={dirty} onSave={save} />

      {/* ── Capacités standard ── */}
      {visibleCaps.map((cap, i) => {
        const isToggleable = cap.is_user_configurable && cap.status === "active";
        const isComingSoon = cap.status === "coming_soon";
        const isAuto       = !cap.is_user_configurable;
        const active       = isAuto ? true : caps[cap.id] === true;

        return (
          <div
            key={cap.id}
            onClick={isToggleable ? () => setCaps((c) => ({ ...c, [cap.id]: !c[cap.id] })) : undefined}
            className={cn(
              "flex items-center gap-4 py-3 transition-colors duration-100",
              isToggleable ? "cursor-pointer" : isComingSoon ? "cursor-not-allowed opacity-50" : "cursor-default opacity-70"
            )}
            style={{ borderBottom: i < visibleCaps.length - 1 ? "1px solid var(--border-subtle)" : undefined }}
          >
            <div className="relative w-8 h-4 rounded-full flex-shrink-0"
              style={{
                background: active ? "var(--color-gold)" : "var(--bg-muted)",
                border: `1px solid ${active ? "var(--color-gold)" : "var(--border-default)"}`,
              }}>
              <motion.div
                animate={{ x: active ? 16 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-0.5 w-3 h-3 rounded-full"
                style={{ background: active ? "#000" : "var(--text-disabled)" }}
              />
            </div>

            <CapIconDash name={cap.icon} className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: active ? "var(--color-gold)" : "var(--text-disabled)" }} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-medium"
                  style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {cap.label}
                </p>
                {cap.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{
                      background: cap.badge === "Core"    ? "rgba(52,211,153,0.1)"   :
                                  cap.badge === "Bientôt" ? "rgba(255,255,255,0.05)" :
                                  cap.badge === "Nouveau" ? "rgba(56,189,248,0.1)"   :
                                  "rgba(212,175,55,0.12)",
                      color:      cap.badge === "Core"    ? "#34D399"                :
                                  cap.badge === "Bientôt" ? "var(--text-disabled)"   :
                                  cap.badge === "Nouveau" ? "#38bdf8"                :
                                  "var(--color-gold)",
                    }}>
                    {cap.badge}
                  </span>
                )}
                {isAuto && !cap.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "rgba(52,211,153,0.08)", color: "#34D399" }}>
                    Auto
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-disabled)" }}>
                {cap.description}
                {cap.tokens_per_msg > 0 && (
                  <span className="ml-1 tabular-nums">
                    · ~{cap.tokens_per_msg >= 1000
                        ? `${(cap.tokens_per_msg / 1000).toFixed(1)}k`
                        : cap.tokens_per_msg} tokens/msg
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}

      {/* ── Séquence d'accueil (audio / vidéo) ── */}
      <div className="space-y-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Séquence d&apos;accueil
          </p>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
            style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>
            Nouveau
          </span>
        </div>
        <p className="text-[11px] -mt-2" style={{ color: "var(--text-disabled)" }}>
          Envoyés automatiquement aux nouveaux contacts WhatsApp. Omettez pour n&apos;envoyer que du texte.
        </p>

        <MediaUploadCard
          agentId={agent.id}
          type="audio"
          initialUrl={(agentCaps.welcome_audio_url as string) ?? null}
          label="Message vocal d'accueil"
          formats=".ogg · .mp3 · .m4a — max 10 Mo"
        />

        <MediaUploadCard
          agentId={agent.id}
          type="video"
          initialUrl={(agentCaps.welcome_video_url as string) ?? null}
          label="Vidéo d'accueil"
          formats=".mp4 — max 50 Mo"
        />
      </div>

    </div>
  );
}

// ── Tab: Model ────────────────────────────────────────────────────────────────

function ModelTab({ agent, onSave }: { agent: Agent; onSave: (p: Partial<Agent>) => void }) {
  const [model, setModel] = useState(agent.target_model);
  const dirty = model !== agent.target_model;
  const save = () => { onSave({ target_model: model }); toast.success("Modèle mis à jour !"); };

  return (
    <div className="space-y-6">
      <SaveBar dirty={dirty} onSave={save} />
      <SectionCard title="Modèle LLM cible">
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Le modèle utilisé pour générer les réponses de votre agent.</p>
        <div className="space-y-3">
          {MODEL_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              onClick={() => opt.available && setModel(opt.value as AgentModel)}
              className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200"
              style={{
                background: model === opt.value ? "rgba(212,175,55,0.08)" : "var(--bg-elevated)",
                border: `1px solid ${model === opt.value ? "var(--border-gold)" : "var(--border-subtle)"}`,
                cursor: opt.available ? "pointer" : "not-allowed",
                opacity: opt.available ? 1 : 0.45,
              }}>
              <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${model === opt.value ? "var(--color-gold)" : "var(--border-default)"}` }}>
                {model === opt.value && <div className="w-2 h-2 rounded-full" style={{ background: "var(--color-gold)" }} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: model === opt.value ? "var(--color-gold)" : "var(--text-primary)" }}>{opt.label}</p>
                <p className="text-2xs mt-0.5" style={{ color: "var(--text-disabled)" }}>{opt.sub}</p>
              </div>
              {opt.available
                ? <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: model === opt.value ? "var(--color-gold)" : "var(--text-disabled)", opacity: model === opt.value ? 1 : 0.3 }} />
                : <span className="text-2xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-card)", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>Bientôt</span>
              }
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Tab: System Prompt ────────────────────────────────────────────────────────

function PromptTab({ agent, onSave }: { agent: Agent; onSave: (p: Partial<Agent>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(agent.system_prompt.compiled_prompt);
  const [copied,  setCopied]  = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(agent.system_prompt.compiled_prompt);
    setCopied(true); toast.success("Prompt copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSave({ system_prompt: { ...agent.system_prompt, compiled_prompt: draft, version: agent.system_prompt.version + 1, generated_at: new Date().toISOString() } });
    setEditing(false);
    toast.success(`Prompt sauvegardé · v${agent.system_prompt.version + 1}`);
  };

  const handleRegenerate = () => {
    const fresh = generateSystemPrompt({
      agent_name: agent.identity.name, agent_tagline: agent.identity.tagline,
      brand_voice: agent.identity.brand_voice, primary_language: agent.identity.primary_language,
      secondary_languages: agent.identity.secondary_languages, avatar_emoji: agent.identity.avatar_emoji,
      business_name: agent.business_context.business_name, owner_name: agent.business_context.owner_name,
      owner_email: agent.business_context.owner_email, sector: agent.business_context.sector,
      description: agent.business_context.description, website_url: agent.business_context.website_url,
      location: agent.business_context.location, target_audience: agent.business_context.target_audience,
      whatsapp_number: agent.business_context.whatsapp_number,
      products_services: agent.knowledge_base.products_services, pricing_info: agent.knowledge_base.pricing_info,
      business_hours: agent.knowledge_base.business_hours, policies: agent.knowledge_base.policies,
      faq: agent.knowledge_base.faq ?? [], forbidden_topics: agent.knowledge_base.forbidden_topics ?? [],
      capabilities: agent.capabilities, target_model: agent.target_model as AgentModel,
    }, agent.target_model as AgentModel);
    const newVersion = agent.system_prompt.version + 1;
    onSave({ system_prompt: { ...fresh, version: newVersion } });
    setDraft(fresh.compiled_prompt);
    toast.success(`Prompt régénéré · v${newVersion}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg text-2xs font-semibold tabular-nums" style={{ background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }}>
            v{agent.system_prompt.version}
          </span>
          <span className="text-xs" style={{ color: "var(--text-disabled)" }}>
            {agent.system_prompt.estimated_tokens.toLocaleString("fr-FR")} tokens · {agent.system_prompt.target_model}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200" style={{ background: "var(--surface-glass)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copié !" : "Copier"}
          </button>
          <button onClick={handleRegenerate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:brightness-110" style={{ background: "rgba(212,175,55,0.1)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}>
            <RefreshCw className="w-3.5 h-3.5" />Régénérer
          </button>
          {!editing ? (
            <button onClick={() => { setDraft(agent.system_prompt.compiled_prompt); setEditing(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200" style={{ background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }}>
              <Pencil className="w-3.5 h-3.5" />Modifier
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 transition-colors" style={{ color: "var(--text-disabled)" }}>Annuler</button>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }}>
                <Save className="w-3.5 h-3.5" />Sauvegarder
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-3 px-5 py-3" style={{ background: "var(--bg-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex gap-1.5">
            {["bg-red-500/60","bg-amber-500/60","bg-emerald-500/60"].map((c,i) => <span key={i} className={`w-3 h-3 rounded-full ${c}`} />)}
          </div>
          <span className="text-2xs font-mono flex-1" style={{ color: "var(--text-disabled)" }}>system_prompt.txt</span>
          <Code2 className="w-3.5 h-3.5" style={{ color: "var(--text-disabled)" }} />
        </div>
        {editing ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={24}
            className="w-full px-6 py-5 text-xs font-mono resize-none focus:outline-none"
            style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", lineHeight: 1.8 }} />
        ) : (
          <pre className="px-6 py-5 text-xs font-mono whitespace-pre-wrap overflow-x-auto"
            style={{ color: "var(--text-tertiary)", lineHeight: 1.8, maxHeight: "520px", overflowY: "auto", background: "var(--bg-elevated)" }}>
            {agent.system_prompt.compiled_prompt}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Tab: Integration ─────────────────────────────────────────────────────────

// Inline SVG brand icons (Lucide doesn't include social networks)
function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconTikTok({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z" />
    </svg>
  );
}

type WahaStatus = "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED" | "ERROR" | null;

function IntegrationTab({ agent, refetch }: { agent: Agent; refetch: () => void }) {
  // ── WhatsApp state ──────────────────────────────────────────────────────────
  const [wahaStatus, setWahaStatus]     = useState<WahaStatus>(null);
  const [sessionName, setSessionName]   = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber]   = useState<string | null>(null);
  const [connecting, setConnecting]     = useState(false);
  const [qrBlobUrl, setQrBlobUrl]       = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);
  const [connectMode, setConnectMode]   = useState<"qr" | "phone">("qr");
  const [phoneInput, setPhoneInput]     = useState("");
  const [pairingCode, setPairingCode]   = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef  = useRef<string | null>(null);

  // ── Google Calendar state ───────────────────────────────────────────────────
  const [gcalLoading, setGcalLoading] = useState(false);
  const calendarConnected             = !!agent.google_calendar_email;

  // ── Derived capability flags ────────────────────────────────────────────────
  const caps                  = agent.capabilities as unknown as Record<string, boolean>;
  const hasCalendar           = caps.calendar_booking   === true;
  const hasCommunityMgmt      = caps.community_management === true;

  const token = typeof window !== "undefined" ? localStorage.getItem("camille_token") : null;
  const authH: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // ── Mode Propriétaire — mot de passe ────────────────────────────────────────
  const [pwInput,      setPwInput]      = useState("");
  const [pwConfirm,    setPwConfirm]    = useState("");
  const [pwSaving,     setPwSaving]     = useState(false);
  const [pwSet,        setPwSet]        = useState(!!agent.owner_password_hash);
  const [pwRevealNew,  setPwRevealNew]  = useState(false);
  const [pwRevealConf, setPwRevealConf] = useState(false);

  // ── Mode Propriétaire — sessions actives ────────────────────────────────────
  const [ownerSessions,   setOwnerSessions]   = useState<OwnerSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId,      setRevokingId]      = useState<string | null>(null);
  const [revokingAll,     setRevokingAll]      = useState(false);

  const fetchOwnerSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/owner-session`, { headers: authH });
      if (!res.ok) return;
      const data = await res.json() as { sessions?: OwnerSession[] };
      setOwnerSessions(data.sessions ?? []);
    } catch { /* ignore */ } finally { setSessionsLoading(false); }
  }, [agent.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchOwnerSessions(); }, [fetchOwnerSessions]);

  const handleRevokeSession = async (sessionPhone: string, sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await fetch(`/api/agents/${agent.id}/owner-session?phone=${encodeURIComponent(sessionPhone)}`, {
        method: "DELETE", headers: authH,
      });
      toast.success("Session révoquée");
      setOwnerSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch { toast.error("Erreur réseau"); } finally { setRevokingId(null); }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await fetch(`/api/agents/${agent.id}/owner-session?all=true`, { method: "DELETE", headers: authH });
      toast.success("Toutes les sessions révoquées");
      setOwnerSessions([]);
    } catch { toast.error("Erreur réseau"); } finally { setRevokingAll(false); }
  };

  const handleSavePassword = async () => {
    if (!pwInput.trim()) { toast.error("Entrez un mot de passe"); return; }
    if (pwInput !== pwConfirm) { toast.error("Les mots de passe ne correspondent pas"); return; }
    if (pwInput.length < 4) { toast.error("Minimum 4 caractères"); return; }
    setPwSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/owner-password`, {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwInput }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; toast.error(d.error ?? "Erreur"); return; }
      toast.success("Mot de passe défini ✅");
      setPwInput(""); setPwConfirm(""); setPwSet(true);
    } catch { toast.error("Erreur réseau"); } finally { setPwSaving(false); }
  };

  const handleRemovePassword = async () => {
    setPwSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/owner-password`, { method: "DELETE", headers: authH });
      if (!res.ok) { toast.error("Erreur lors de la suppression"); return; }
      toast.success("Mot de passe supprimé — mode propriétaire désactivé");
      setPwSet(false); setPwInput(""); setPwConfirm("");
    } catch { toast.error("Erreur réseau"); } finally { setPwSaving(false); }
  };

  // ── WhatsApp helpers ────────────────────────────────────────────────────────
  const fetchQr = useCallback(async (sName: string) => {
    try {
      const res = await fetch(`/api/waha/qr?session=${sName}`, { headers: authH });
      if (!res.ok) return;
      const blob = await res.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setQrBlobUrl(url);
    } catch { /* QR pas encore prêt */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/waha/status?agentId=${agent.id}`, { headers: authH });
    if (!res.ok) return;
    const data = await res.json();
    setWahaStatus(data.status);
    setSessionName(data.session_name ?? null);
    setPhoneNumber(data.phone_number ?? null);
    if (data.status === "WORKING") { setQrBlobUrl(null); setPairingCode(null); stopPolling(); }
    else if (data.session_name && data.status === "SCAN_QR_CODE" && connectMode === "qr") {
      fetchQr(data.session_name);
    }
  }, [agent.id, fetchQr, connectMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopPolling() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }
  function startPolling() {
    stopPolling();
    intervalRef.current = setInterval(() => fetchStatus(), 3000);
  }

  useEffect(() => { fetchStatus(); return () => stopPolling(); }, [fetchStatus]);

  const handleWahaConnect = async () => {
    setConnecting(true);
    setPairingCode(null);
    try {
      const res = await fetch("/api/waha/connect", {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      let data: { error?: string; session_name?: string } = {};
      try { data = await res.json(); } catch { /* corps vide */ }
      if (!res.ok) { toast.error(data.error ?? `Erreur serveur (${res.status})`); return; }
      setSessionName(data.session_name ?? null);
      setWahaStatus("STARTING");
      startPolling();
      setTimeout(() => fetchStatus(), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    } finally { setConnecting(false); }
  };

  const handlePhoneCode = async () => {
    if (!phoneInput.trim()) { toast.error("Entrez un numéro de téléphone"); return; }
    setPhoneLoading(true);
    try {
      const res = await fetch("/api/waha/phone", {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, phoneNumber: phoneInput }),
      });
      let data: { error?: string; code?: string } = {};
      try { data = await res.json(); } catch { /* corps vide */ }
      if (!res.ok) { toast.error(data.error ?? `Erreur (${res.status})`); return; }
      setPairingCode(data.code ?? null);
      startPolling();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    } finally { setPhoneLoading(false); }
  };

  const handleWahaDisconnect = async () => {
    stopPolling();
    try {
      await fetch("/api/waha/disconnect", {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
    } catch { /* ignore */ }
    setWahaStatus("STOPPED");
    setPhoneNumber(null);
    setQrBlobUrl(null);
    setPairingCode(null);
    toast.success("Session WhatsApp déconnectée");
  };

  // ── Google Calendar helpers ─────────────────────────────────────────────────
  const handleGCalConnect = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch("/api/integrations/google-calendar/connect", {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        toast.error(d.error ?? "Erreur lors de la connexion");
        return;
      }
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setGcalLoading(false);
    }
  };

  const handleGCalDisconnect = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch("/api/integrations/google-calendar/disconnect", {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        toast.error(d.error ?? "Erreur lors de la déconnexion");
        return;
      }
      toast.success("Google Agenda déconnecté");
      refetch();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setGcalLoading(false);
    }
  };

  const copyId = async () => {
    await navigator.clipboard.writeText(agent.id);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const isWorking  = wahaStatus === "WORKING";
  const isScanning = wahaStatus === "SCAN_QR_CODE";
  const isStarting = wahaStatus === "STARTING";
  const isStopped  = !wahaStatus || wahaStatus === "STOPPED" || wahaStatus === "FAILED" || wahaStatus === "ERROR";

  // ── Shared sub-components ───────────────────────────────────────────────────

  function SectionHeader({ label }: { label: string }) {
    return (
      <p className="text-[10px] font-semibold uppercase tracking-widest pb-2"
        style={{ color: "var(--text-disabled)", borderBottom: "1px solid var(--border-subtle)" }}>
        {label}
      </p>
    );
  }

  function ComingSoonCard({
    icon, label, description, accentColor,
  }: {
    icon: React.ReactNode; label: string; description: string; accentColor: string;
  }) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl opacity-50"
        style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
              BIENTÔT
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-disabled)" }}>{description}</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── MESSAGERIE ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader label="Messagerie" />

        {/* WhatsApp card */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ background: "var(--bg-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)" }}>
              <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>WhatsApp Business</p>
              <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                {isWorking ? `Connecté · ${phoneNumber ?? ""}` : isScanning ? "Scannez le QR code" : isStarting ? "Démarrage…" : "Non connecté"}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
              style={{ color: isWorking ? "#34D399" : isScanning || isStarting ? "#FBBF24" : "var(--text-disabled)" }}>
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                isWorking ? "bg-emerald-400 animate-pulse" : isScanning || isStarting ? "bg-amber-400 animate-pulse" : "bg-white/20")} />
              <span className="hidden sm:inline">{isWorking ? "Actif" : isScanning ? "En attente" : isStarting ? "Démarrage" : "Inactif"}</span>
            </span>
          </div>

          {/* Mode toggle QR / Phone — visible uniquement en scan */}
          <AnimatePresence>
            {isScanning && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className="flex px-5 pt-5 gap-2">
                  <button onClick={() => setConnectMode("qr")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                    style={connectMode === "qr"
                      ? { background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }
                      : { background: "transparent", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
                    <Globe className="w-3 h-3" /> QR Code
                  </button>
                  <button onClick={() => setConnectMode("phone")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                    style={connectMode === "phone"
                      ? { background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }
                      : { background: "transparent", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
                    <Phone className="w-3 h-3" /> Numéro
                    <span className="text-[9px] px-1 py-0.5 rounded font-bold ml-0.5"
                      style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>NEXT</span>
                  </button>
                </div>

                {connectMode === "qr" && (
                  <div className="flex flex-col items-center gap-4 py-6 px-6">
                    <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
                      WhatsApp → Paramètres → Appareils liés → Lier un appareil
                    </p>
                    {qrBlobUrl ? (
                      <div className="rounded-2xl overflow-hidden p-3" style={{ background: "#fff" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrBlobUrl} alt="QR WhatsApp" width={200} height={200} />
                      </div>
                    ) : (
                      <div className="w-[200px] h-[200px] rounded-2xl flex items-center justify-center"
                        style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                        <div className="w-6 h-6 rounded-full border-2 border-t-[var(--color-gold)] border-white/10 animate-spin" />
                      </div>
                    )}
                    <button onClick={() => sessionName && fetchQr(sessionName)}
                      className="text-xs flex items-center gap-1.5 transition-opacity hover:opacity-70"
                      style={{ color: "var(--text-disabled)" }}>
                      <RefreshCw className="w-3 h-3" /> Actualiser le QR
                    </button>
                  </div>
                )}

                {connectMode === "phone" && (
                  <div className="flex flex-col gap-4 py-6 px-6">
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      WhatsApp → Paramètres → Appareils liés → Lier avec numéro de téléphone
                    </p>
                    <div className="flex gap-2">
                      <FInput
                        placeholder="+33 6 12 34 56 78"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="flex-1"
                      />
                      <button onClick={handlePhoneCode} disabled={phoneLoading}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all duration-200 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#fff" }}>
                        {phoneLoading
                          ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          : "Obtenir le code"}
                      </button>
                    </div>
                    {pairingCode && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4 text-center"
                        style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
                        <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>Entrez ce code dans WhatsApp</p>
                        <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: "#25D366" }}>{pairingCode}</p>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Numéro connecté */}
          <AnimatePresence>
            {isWorking && phoneNumber && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-5 py-4">
                <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#25D366" }} />
                <span className="text-sm font-mono flex-1" style={{ color: "#25D366" }}>+{phoneNumber}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions WhatsApp */}
          <div className="flex items-center justify-between px-5 py-4 gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {isStopped ? (
              <button onClick={handleWahaConnect} disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#fff" }}>
                {connecting
                  ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Connexion…</>
                  : <><MessageCircle className="w-3.5 h-3.5" />Connecter WhatsApp</>}
              </button>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                {!isWorking && (
                  <span className="text-xs animate-pulse truncate" style={{ color: "var(--text-disabled)" }}>
                    {isStarting ? "Initialisation…" : "En attente du scan…"}
                  </span>
                )}
              </div>
            )}
            {!isStopped && (
              <button onClick={handleWahaDisconnect}
                className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150 flex-shrink-0"
                style={{ color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                Déconnecter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── PRODUCTIVITÉ — Google Agenda (si calendar_booking activé) ─────────── */}
      <AnimatePresence>
        {hasCalendar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <SectionHeader label="Productivité" />

            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${calendarConnected ? "rgba(52,211,153,0.25)" : "var(--border-subtle)"}` }}>
              {/* Header Google Agenda */}
              <div className="flex items-center gap-3 px-5 py-4"
                style={{ background: calendarConnected ? "rgba(52,211,153,0.05)" : "var(--bg-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: calendarConnected ? "rgba(52,211,153,0.12)" : "rgba(212,175,55,0.08)",
                    border: `1px solid ${calendarConnected ? "rgba(52,211,153,0.3)" : "rgba(212,175,55,0.2)"}`,
                  }}>
                  <Calendar className="w-4 h-4" style={{ color: calendarConnected ? "#34D399" : "var(--color-gold)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Google Agenda</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                    {calendarConnected
                      ? `Connecté · ${agent.google_calendar_email}`
                      : "Requis pour vérifier les dispos et créer des événements"}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
                  style={{ color: calendarConnected ? "#34D399" : "var(--text-disabled)" }}>
                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                    calendarConnected ? "bg-emerald-400 animate-pulse" : "bg-white/20")} />
                  <span className="hidden sm:inline">{calendarConnected ? "Connecté" : "Non connecté"}</span>
                </span>
              </div>

              {/* Info quand connecté */}
              <AnimatePresence>
                {calendarConnected && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <div className="px-5 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                        ✅
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {agent.google_calendar_email}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-disabled)" }}>
                          Les rendez-vous seront créés automatiquement dans ce calendrier.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions Google Agenda */}
              <div className="flex items-center justify-between px-5 py-4 gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                {!calendarConnected ? (
                  <button
                    onClick={handleGCalConnect}
                    disabled={gcalLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #4285F4, #34A853)", color: "#fff" }}>
                    {gcalLoading
                      ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Connexion…</>
                      : <><Calendar className="w-3.5 h-3.5" />Connecter Google Agenda</>}
                  </button>
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-disabled)" }}>
                    Agenda actif · les créneaux libres sont détectés en temps réel
                  </p>
                )}
                {calendarConnected && (
                  <button
                    onClick={handleGCalDisconnect}
                    disabled={gcalLoading}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150 flex-shrink-0 disabled:opacity-50"
                    style={{ color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    {gcalLoading ? "…" : "Déconnecter"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RÉSEAUX SOCIAUX — Facebook / Instagram / TikTok (si community_management) ── */}
      <AnimatePresence>
        {hasCommunityMgmt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <SectionHeader label="Réseaux sociaux" />

            <ComingSoonCard
              icon={<IconFacebook className="w-4 h-4" />}
              label="Facebook"
              description="Publication, gestion des messages et commentaires"
              accentColor="#1877F2"
            />
            <ComingSoonCard
              icon={<IconInstagram className="w-4 h-4" />}
              label="Instagram"
              description="Publication de contenu et réponses automatiques"
              accentColor="#E1306C"
            />
            <ComingSoonCard
              icon={<IconTikTok className="w-4 h-4" />}
              label="TikTok"
              description="Publication de vidéos et gestion des interactions"
              accentColor="#010101"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODE PROPRIÉTAIRE ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader label="Mode Propriétaire" />

        <div className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(212,175,55,0.25)", background: "rgba(212,175,55,0.02)" }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4"
            style={{ background: "rgba(212,175,55,0.05)", borderBottom: "1px solid rgba(212,175,55,0.12)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
              🔐
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold" style={{ color: "var(--color-gold)" }}>Mode Propriétaire</p>
                {pwSet
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>Configuré</span>
                  : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>Non configuré</span>
                }
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                Accès exclusif depuis votre WhatsApp — conseiller stratégique & CM IA
              </p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">

            {/* Comment ça marche */}
            <div className="rounded-xl px-4 py-3 space-y-1.5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Envoyez <span className="font-mono font-semibold px-1 py-0.5 rounded"
                  style={{ background: "rgba(212,175,55,0.12)", color: "var(--color-gold)" }}>/votre-mot-de-passe</span> à votre agent depuis WhatsApp.
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
                L'agent bascule en consultant IA : stratégie, calendriers éditoriaux, campagnes, planning. Session 8h. Tapez <span className="font-mono font-semibold">/exit</span> pour quitter.
              </p>
            </div>

            {/* ─── Mot de passe ─────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-disabled)" }}>
                {pwSet ? "Changer le mot de passe" : "Définir le mot de passe d'accès"}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <input
                    type={pwRevealNew ? "text" : "password"}
                    value={pwInput}
                    onChange={(e) => setPwInput(e.target.value)}
                    placeholder="Nouveau mot de passe"
                    className="w-full px-3 py-2.5 rounded-lg text-xs outline-none pr-9"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
                  />
                  <button type="button" onClick={() => setPwRevealNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-disabled)" }}>
                    {pwRevealNew ? "🙈" : "👁"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={pwRevealConf ? "text" : "password"}
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSavePassword()}
                    placeholder="Confirmer"
                    className="w-full px-3 py-2.5 rounded-lg text-xs outline-none pr-9"
                    style={{
                      background: "var(--bg-elevated)",
                      border: `1px solid ${pwConfirm && pwConfirm !== pwInput ? "rgba(248,113,113,0.4)" : "var(--border-default)"}`,
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) => { if (!pwConfirm || pwConfirm === pwInput) e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = pwConfirm && pwConfirm !== pwInput ? "rgba(248,113,113,0.4)" : "var(--border-default)"; }}
                  />
                  <button type="button" onClick={() => setPwRevealConf((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-disabled)" }}>
                    {pwRevealConf ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {pwConfirm && pwConfirm !== pwInput && (
                <p className="text-[11px]" style={{ color: "#f87171" }}>Les mots de passe ne correspondent pas</p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSavePassword}
                  disabled={pwSaving || !pwInput || !pwConfirm || pwInput !== pwConfirm}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-40"
                  style={{ background: "rgba(212,175,55,0.12)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.25)" }}>
                  {pwSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {pwSet ? "Mettre à jour" : "Définir le mot de passe"}
                </button>
                {pwSet && (
                  <button
                    onClick={handleRemovePassword}
                    disabled={pwSaving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-40"
                    style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <Trash2 className="w-3 h-3" />Désactiver le mode proprio
                  </button>
                )}
              </div>
            </div>

            {/* ─── Sessions actives ──────────────────────────────────── */}
            <div style={{ borderTop: "1px solid rgba(212,175,55,0.12)", paddingTop: "1.25rem" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-disabled)" }}>
                    Sessions WhatsApp actives
                  </p>
                  {ownerSessions.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>
                      {ownerSessions.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={fetchOwnerSessions} disabled={sessionsLoading}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ color: "var(--text-disabled)" }} title="Rafraîchir"
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <RefreshCw className={`w-3 h-3 ${sessionsLoading ? "animate-spin" : ""}`} />
                  </button>
                  {ownerSessions.length > 0 && (
                    <button onClick={handleRevokeAll} disabled={revokingAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-40"
                      style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      {revokingAll ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Tout révoquer
                    </button>
                  )}
                </div>
              </div>

              {sessionsLoading && ownerSessions.length === 0 && (
                <p className="text-xs py-3 text-center" style={{ color: "var(--text-disabled)" }}>Chargement…</p>
              )}

              {!sessionsLoading && ownerSessions.length === 0 && (
                <div className="rounded-xl px-4 py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs" style={{ color: "var(--text-disabled)" }}>Aucune session propriétaire active</p>
                </div>
              )}

              {ownerSessions.length > 0 && (
                <div className="space-y-2">
                  {ownerSessions.map((s) => {
                    const authDate    = new Date(s.authenticated_at);
                    const expiresAt   = new Date(s.expires_at);
                    const minutesLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));
                    const timeLeft    = minutesLeft > 60
                      ? `${Math.floor(minutesLeft / 60)}h${minutesLeft % 60 > 0 ? String(minutesLeft % 60).padStart(2,"0") : ""} restant`
                      : `${minutesLeft}min restant`;

                    return (
                      <div key={s.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.1)" }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                          style={{ background: "#34D399", boxShadow: "0 0 6px rgba(52,211,153,0.6)" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium font-mono" style={{ color: "var(--text-primary)" }}>{s.phone}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-disabled)" }}>
                            Connecté {authDate.toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                            {" · "}
                            <span style={{ color: minutesLeft < 30 ? "#f87171" : "var(--text-disabled)" }}>{timeLeft}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevokeSession(s.phone, s.id)}
                          disabled={revokingId === s.id}
                          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-40"
                          style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                          {revokingId === s.id
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <><Trash2 className="w-3 h-3" /><span>Révoquer</span></>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Agent ID ──────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-disabled)" }}>Agent ID</p>
          <p className="text-xs font-mono truncate" style={{ color: "var(--text-tertiary)" }}>{agent.id}</p>
        </div>
        <button onClick={copyId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all duration-200"
          style={{ background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",     label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "identity",     label: "Identité",        icon: Bot },
  { id: "business",     label: "Business",         icon: Globe },
  { id: "knowledge",    label: "Connaissance",     icon: BookOpen },
  { id: "capabilities", label: "Capacités",        icon: Zap },
  { id: "model",        label: "Modèle",           icon: Sparkles },
  { id: "prompt",       label: "System Prompt",    icon: Code2 },
  { id: "integration",  label: "Intégration",      icon: Plug2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentConfigPage() {
  const { agentId }                    = useParams<{ agentId: string }>();
  const router                         = useRouter();
  const searchParams                   = useSearchParams();
  const { isLoggedIn }                 = useAuth();
  const { agent, loading, update, refetch } = useAgent(agentId);
  const [tab, setTab]                  = useState<TabId>("overview");
  const token = typeof window !== "undefined" ? localStorage.getItem("camille_token") : null;

  // Handle redirect back from Google OAuth
  useEffect(() => {
    const gcal      = searchParams.get("gcal");
    const gcalError = searchParams.get("gcal_error");
    const tabParam  = searchParams.get("tab");

    if (gcal === "connected") {
      toast.success("Google Agenda connecté avec succès !");
      refetch();
    } else if (gcalError) {
      toast.error(`Erreur Google Agenda : ${gcalError}`);
    }
    if (tabParam === "capabilities") setTab("capabilities");

    // Clean up URL params without full reload
    if (gcal || gcalError || tabParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("gcal");
      url.searchParams.delete("gcal_error");
      url.searchParams.delete("tab");
      router.replace(url.pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capacités depuis la DB (/api/plans est public)
  const [capabilities, setCapabilities] = useState<DbCapability[]>([]);
  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.capabilities) setCapabilities(d.capabilities as DbCapability[]); })
      .catch(() => {/* silencieux, fallback = liste vide */});
  }, []);

  useEffect(() => { if (!isLoggedIn) router.replace("/login"); }, [isLoggedIn, router]);
  useEffect(() => { if (!loading && !agent) router.replace("/dashboard"); }, [agent, loading, router]);

  const handleSave = useCallback((patch: Partial<Agent>) => { update(patch as any); }, [update]);
  const handleToggleStatus = useCallback(() => {
    if (!agent) return;
    const next = agent.status === "active" ? "paused" : "active";
    update({ status: next });
    toast.success(next === "active" ? `"${agent.identity.name}" activé.` : `"${agent.identity.name}" mis en pause.`);
  }, [agent, update]);

  if (loading || !agent) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-t-[var(--color-gold)] border-white/10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 h-[52px] flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs transition-colors duration-150 flex-shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Agents</span>
        </button>
        <span className="text-xs" style={{ color: "var(--border-strong)" }}>/</span>
        <span className="text-sm leading-none flex-shrink-0">{agent.identity.avatar_emoji ?? "🤖"}</span>
        <h1 className="text-xs font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>
          {agent.identity.name}
        </h1>
        <span className="inline-flex items-center gap-1.5 text-[11px] flex-shrink-0"
          style={{ color: agent.status === "active" ? "#34D399" : "#FBBF24" }}>
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", agent.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
          {agent.status === "active" ? "Actif" : "Pausé"}
        </span>
      </div>

      {/* ── Mobile tab bar ──────────────────────────────────────────────── */}
      <div className="md:hidden flex-shrink-0 overflow-x-auto flex gap-1 px-3 py-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors duration-100",
              tab === id
                ? "text-[var(--text-primary)] bg-[var(--surface-glass)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")}
            style={tab === id ? { border: "1px solid var(--border-subtle)" } : { border: "1px solid transparent" }}>
            <Icon className="w-3 h-3 opacity-60" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left tab nav — desktop only */}
        <div className="hidden md:flex w-[168px] flex-shrink-0 flex-col py-3 px-2.5 space-y-px overflow-y-auto"
          style={{ borderRight: "1px solid var(--border-subtle)" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-2.5 py-[7px] rounded-md text-xs font-medium text-left transition-colors duration-100 w-full",
                tab === id
                  ? "text-[var(--text-primary)] bg-[var(--surface-glass)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.025)]")}
              style={tab === id ? { border: "1px solid var(--border-subtle)" } : { border: "1px solid transparent" }}>
              <Icon className="w-3 h-3 flex-shrink-0 opacity-60" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-7 py-5 sm:py-6">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                {tab === "overview"     && <OverviewTab     agent={agent} onToggleStatus={handleToggleStatus} token={token} capabilities={capabilities} />}
                {tab === "identity"     && <IdentityTab     agent={agent} onSave={handleSave} />}
                {tab === "business"     && <BusinessTab     agent={agent} onSave={handleSave} />}
                {tab === "knowledge"    && <KnowledgeTab    agent={agent} onSave={handleSave} />}
                {tab === "capabilities" && <CapabilitiesTab agent={agent} onSave={handleSave} capabilities={capabilities} />}
                {tab === "model"        && <ModelTab        agent={agent} onSave={handleSave} />}
                {tab === "prompt"       && <PromptTab       agent={agent} onSave={handleSave} />}
                {tab === "integration"  && <IntegrationTab  agent={agent} refetch={refetch} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
