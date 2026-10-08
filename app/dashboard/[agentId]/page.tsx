// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/[agentId]/page.tsx — Camille by Buyticle
// Configuration complète d'un agent, rangée par onglets.
//
// Dans la coquille du tableau de bord, le nom et le statut de l'agent sont
// déjà dans le titre de la feuille : la page ne porte que les onglets (une
// barre de pastilles sur mobile, un menu collant à gauche sur grand écran)
// et leur contenu, qui s'écoule dans la page sans zone de défilement propre.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence }          from "framer-motion";
import {
  Sparkles, Bot, BookOpen,
  Zap, Code2, Plug2, RefreshCw, Copy, Check,
  Save, Pencil, Plus, Trash2, Play, Pause,
  MessageCircle, Globe, Phone, Clock,
  Users, ChevronDown, LayoutDashboard, TrendingUp,
  History, FileText, Target, UserPlus, Send, Image, Calendar,
  Upload, Mic2, Video, X,
  Ban, Building2, MapPin, KeyRound, Fingerprint, Smile, Eye, EyeOff,
  CheckCircle2, HelpCircle,
} from "lucide-react";
import { toast }                from "sonner";
import { useAuth }             from "@/hooks/useAuth";
import { useAgent }            from "@/hooks/useAgent";
import { generateSystemPrompt } from "@/lib/generateSystemPrompt";
import { cn }                      from "@/lib/utils";
import type { Agent, AgentModel, FAQEntry } from "@/types/agent";
import type { DbCapability } from "@/lib/plans-db";
import {
  Bandeau, Bouton, BoutonRond, Filtres, Pastille, Squelettes, StylesUI, Tuile, Vide, apparait, type Ton,
} from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

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

// ── Pièces locales ────────────────────────────────────────────────────────────
// Le kit commun (components/dashboard/ui) couvre les boutons, pastilles et
// bandeaux ; ce qui suit est propre aux formulaires de cette page.

/** Le fond des blocs intérieurs d'une carte. */
const FOND_DOUX = "#FAF9FC";

function Field({
  label, hint, children, required,
}: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label className="block px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink-soft)" }}>
        {label}
        {required && <span className="ml-1" style={{ color: "var(--cl-accent)" }}>*</span>}
      </label>
      {children}
      {hint && <p className="px-1 text-[12.5px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{hint}</p>}
    </div>
  );
}

function FInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input className={cn("ui-champ", className)} {...props} />;
}

function FTextarea({ className, rows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return <textarea rows={rows} className={cn("ui-champ", className)} {...props} />;
}

function FSelect({ options, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className="relative">
      <select className={cn("ui-champ cursor-pointer appearance-none pr-11", className)} {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
    </div>
  );
}

/** L'interrupteur arrondi, au bouton qui glisse sur un ressort. Purement visuel : la ligne porte le clic. */
function Interrupteur({ actif, attenue }: { actif: boolean; attenue?: boolean }) {
  return (
    <span aria-hidden className="relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-200"
      style={{ background: actif ? "var(--cl-accent)" : "#DCD6E6", opacity: attenue ? 0.55 : 1 }}>
      <motion.span animate={{ x: actif ? 20 : 0 }} transition={RESSORT}
        className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white"
        style={{ boxShadow: "0 2px 6px rgba(30,20,60,0.18)" }} />
    </span>
  );
}

/** Une carte de section : pastille d'icône, titre, sous-titre, action à droite. */
function Section({
  icone: Icone, titre, sous, action, children, rang = 0, className = "",
}: {
  icone: React.ElementType; titre: React.ReactNode; sous?: React.ReactNode; action?: React.ReactNode;
  children?: React.ReactNode; rang?: number; className?: string;
}) {
  return (
    <motion.section {...apparait(rang)} className={cn("rounded-[28px] bg-white p-5 sm:p-6", className)}
      style={{ border: "1px solid var(--cl-line-soft)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
            <Icone className="h-4 w-4" />
          </span>
          <div className="min-w-0 pt-1">
            <h3 className="text-[16px] font-medium leading-tight" style={{ color: "var(--cl-ink)" }}>{titre}</h3>
            {sous && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{sous}</p>}
          </div>
        </div>
        {action}
      </div>
      {children && <div className="mt-5 space-y-5">{children}</div>}
    </motion.section>
  );
}

function SaveBar({ dirty, onSave }: { dirty: boolean; onSave: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={RESSORT}
          className="sticky top-[84px] z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] py-2 pl-5 pr-2 sm:rounded-full"
          style={{ background: "rgba(240,235,255,0.92)", backdropFilter: "blur(8px)", boxShadow: "0 12px 28px rgba(70,40,190,0.10)", border: "1px solid var(--cl-lavender)" }}
        >
          <p className="flex items-center gap-2 text-[13.5px] font-medium" style={{ color: "var(--cl-accent-deep)" }}>
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--cl-accent)" }} />
            Modifications non sauvegardées
          </p>
          <Bouton variante="encre" icone={Save} onClick={onSave}>Sauvegarder</Bouton>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

// ── Usage data types ──────────────────────────────────────────────────────────
interface UsageData {
  plan:    { id: string; label: string; limit: number; unlimited: boolean };
  current: { period: string; total_tokens: number; remaining: number; percent: number; prompt_tokens: number; completion_tokens: number };
  plans:   { id: string; label: string; monthly_tokens: number; price_eur: number; current: boolean }[];
}

const PLAN_TONS: Record<string, Ton> = {
  free:       "gris",
  starter:    "bleu",
  pro:        "violet",
  enterprise: "violet",
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
  const barColor = pct >= 90 ? "#D9534F" : pct >= 70 ? "#E6A23C" : "var(--cl-accent)";

  return (
    <Section icone={TrendingUp} titre="Utilisation" sous={current.period} rang={3}
      action={<Pastille ton={PLAN_TONS[plan.id] ?? "violet"}>{plan.label}</Pastille>}>
      {/* La jauge */}
      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <span className="text-[26px] font-light leading-none tracking-[-0.02em] tabular-nums" style={{ color: "var(--cl-ink)" }}>
            {current.total_tokens.toLocaleString("fr-FR")}
            <span className="ml-1.5 text-[13px] font-normal tracking-normal" style={{ color: "var(--cl-ink-faint)" }}>tokens</span>
          </span>
          {plan.unlimited ? (
            <span className="text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>Illimité</span>
          ) : (
            <span className="text-[13px] tabular-nums" style={{ color: "var(--cl-ink-faint)" }}>
              / {plan.limit.toLocaleString("fr-FR")} · {pct}%
            </span>
          )}
        </div>
        {!plan.unlimited && (
          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: "#F1EFF4" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: barColor }}
            />
          </div>
        )}
      </div>

      {/* Détail prompt / completion */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="rounded-[18px] p-3.5" style={{ background: FOND_DOUX }}>
          <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Prompt</p>
          <p className="mt-0.5 text-[15px] font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>{current.prompt_tokens.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-[18px] p-3.5" style={{ background: FOND_DOUX }}>
          <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Réponse</p>
          <p className="mt-0.5 text-[15px] font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>{current.completion_tokens.toLocaleString("fr-FR")}</p>
        </div>
        {!plan.unlimited && (
          <div className="col-span-2 rounded-[18px] p-3.5 sm:col-span-1" style={{ background: FOND_DOUX }}>
            <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Restant</p>
            <p className="mt-0.5 text-[15px] font-medium tabular-nums" style={{ color: pct >= 90 ? "#A63D28" : "var(--cl-ink)" }}>
              {current.remaining.toLocaleString("fr-FR")}
            </p>
          </div>
        )}
      </div>

      {/* Alerte limite proche */}
      {!plan.unlimited && pct >= 80 && (
        <Bandeau ton={pct >= 90 ? "rouge" : "ambre"}>
          {pct >= 90
            ? "Limite presque atteinte — le bot cessera de répondre à 100%."
            : "Vous approchez de votre limite mensuelle."}
        </Bandeau>
      )}
    </Section>
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
  const actif = agent.status === "active";

  return (
    <div className="space-y-5">
      {/* La carte de l'agent */}
      <motion.div {...apparait(0)} className="flex flex-wrap items-center gap-4 rounded-[28px] bg-white p-5 sm:p-6"
        style={{ border: "1px solid var(--cl-line-soft)" }}>
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[28px]"
          style={{ background: "var(--cl-accent-soft)" }}>
          {agent.identity.avatar_emoji ?? "🤖"}
        </div>
        <div className="min-w-[150px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[19px] font-medium leading-tight" style={{ color: "var(--cl-ink)" }}>{agent.identity.name}</p>
            <Pastille ton={actif ? "vert" : "ambre"} point>{actif ? "Actif" : "En pause"}</Pastille>
          </div>
          {agent.identity.tagline && (
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>{agent.identity.tagline}</p>
          )}
        </div>
        <Bouton variante={actif ? "clair" : "encre"} icone={actif ? Pause : Play} onClick={onToggleStatus}>
          {actif ? "Mettre en pause" : "Activer"}
        </Bouton>
      </motion.div>

      {/* Les chiffres */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tuile icone={Code2}   titre="Tokens"      valeur={agent.system_prompt.estimated_tokens.toLocaleString("fr-FR")} sous="taille du prompt" fort rang={1} />
        <Tuile icone={History} titre="Version"     valeur={`v${agent.system_prompt.version ?? 1}`} sous="du prompt système" rang={2} />
        <Tuile icone={Bot}     titre="Modèle"      valeur={agent.target_model.split("-")[0].toUpperCase()} sous={agent.target_model} rang={3} />
        <Tuile icone={Clock}   titre="Mise à jour" valeur={new Date(agent.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} rang={4} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Capabilities */}
        <Section icone={Zap} titre="Capacités activées" sous="Ce que votre agent sait faire en ce moment." rang={2}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {capsForOverview.map((cap) => {
              const agentCaps = agent.capabilities as unknown as Record<string, boolean>;
              // capacités non-toggleables (Core/Auto) sont toujours considérées actives
              const active = !cap.is_user_configurable || agentCaps[cap.id] === true;
              return (
                <div key={cap.id}
                  className="flex min-w-0 items-center gap-2.5 rounded-[18px] px-3.5 py-3"
                  style={{
                    background: active ? "var(--cl-accent-soft)" : FOND_DOUX,
                    opacity: active ? 1 : 0.55,
                  }}>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: active ? "#fff" : "#F1EFF4" }}>
                    <CapIconDash name={cap.icon} className="h-3.5 w-3.5"
                      style={{ color: active ? "var(--cl-accent-deep)" : "var(--cl-ink-faint)" }} />
                  </span>
                  <span className="truncate text-[13.5px] font-medium"
                    style={{ color: active ? "var(--cl-accent-deep)" : "var(--cl-ink-soft)" }}>
                    {cap.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        <div className="min-w-0 space-y-5">
          {/* Usage tokens */}
          <UsageSection agentId={agent.id} token={token} />

          {/* ID */}
          <Section icone={Fingerprint} titre="Agent ID" rang={4}
            action={<Bouton variante="clair" icone={copied ? Check : Copy} onClick={copyId}>{copied ? "Copié" : "Copier"}</Bouton>}>
            <p className="truncate rounded-[18px] px-4 py-3 font-mono text-[13px]" style={{ background: FOND_DOUX, color: "var(--cl-ink-soft)" }}>{agent.id}</p>
          </Section>
        </div>
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
    <div className="space-y-5">
      <SaveBar dirty={dirty} onSave={save} />
      <Section icone={Smile} titre="Avatar" sous="L'emoji qui représente votre agent." rang={0}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <motion.div key={form.avatar_emoji ?? "🤖"} initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={RESSORT}
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full text-[38px]"
            style={{ background: "var(--cl-accent-soft)", boxShadow: "0 0 0 6px #F7F4FF" }}>
            {form.avatar_emoji ?? "🤖"}
          </motion.div>
          <div className="flex flex-wrap gap-2">
            {EMOJI_PRESETS.map((e) => {
              const choisi = form.avatar_emoji === e;
              return (
                <motion.button key={e} whileTap={{ scale: 0.9 }} transition={RESSORT}
                  onClick={() => setForm((f) => ({ ...f, avatar_emoji: e }))}
                  aria-pressed={choisi}
                  className={cn("flex h-10 w-10 items-center justify-center rounded-full text-[19px] transition-all duration-150",
                    choisi ? "scale-110" : "opacity-70 hover:scale-105 hover:opacity-100")}
                  style={choisi
                    ? { background: "var(--cl-accent-soft)", boxShadow: "0 0 0 2px var(--cl-accent)" }
                    : { background: FOND_DOUX }}>
                  {e}
                </motion.button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section icone={Bot} titre="Personnalité" sous="Comment votre agent se présente et s'exprime." rang={1}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nom de l'agent" required>
            <FInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Camille, Aria, Max…" />
          </Field>
          <Field label="Tagline" hint="Courte description affichée sous le nom">
            <FInput value={form.tagline ?? ""} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="Votre assistant commerce premium" />
          </Field>
        </div>

        <Field label="Voix de marque" required>
          <div role="radiogroup" aria-label="Voix de marque" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {VOICE_OPTIONS.map((o) => {
              const choisi = form.brand_voice === o.value;
              return (
                <motion.button key={o.value} role="radio" aria-checked={choisi} whileTap={{ scale: 0.97 }} transition={RESSORT}
                  onClick={() => setForm((f) => ({ ...f, brand_voice: o.value as typeof f.brand_voice }))}
                  className="flex items-center justify-between gap-2 rounded-[18px] px-4 py-3 text-left text-[13.5px] font-medium transition-colors duration-150"
                  style={choisi
                    ? { background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)", boxShadow: "inset 0 0 0 1.5px var(--cl-accent)" }
                    : { background: FOND_DOUX, color: "var(--cl-ink-soft)" }}>
                  <span className="truncate">{o.label}</span>
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ boxShadow: `inset 0 0 0 1.5px ${choisi ? "var(--cl-accent)" : "#D6D0E0"}` }}>
                    {choisi && <motion.span layoutId="ag-voix" transition={RESSORT} className="h-2 w-2 rounded-full" style={{ background: "var(--cl-accent)" }} />}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Langue principale" required>
            <FSelect value={form.primary_language} onChange={(e) => setForm((f) => ({ ...f, primary_language: e.target.value as typeof f.primary_language }))} options={LANG_OPTIONS} />
          </Field>
        </div>

        <Field label="Langues secondaires" hint="L'agent bascule si le client écrit dans ces langues">
          <div className="flex flex-wrap gap-2">
            {LANG_OPTIONS.filter((l) => l.value !== form.primary_language).map((l) => {
              const active = (form.secondary_languages ?? []).includes(l.value as any);
              return (
                <motion.button key={l.value} whileTap={{ scale: 0.95 }} transition={RESSORT}
                  aria-pressed={active}
                  onClick={() => setForm((f) => ({ ...f, secondary_languages: active ? (f.secondary_languages ?? []).filter((x) => x !== l.value) : [...(f.secondary_languages ?? []), l.value as any] }))}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors duration-150"
                  style={active
                    ? { background: "var(--cl-ink)", color: "#fff" }
                    : { background: "#F4F2F7", color: "var(--cl-ink-soft)" }}>
                  {active && <Check className="h-3.5 w-3.5" />}
                  {l.label}
                </motion.button>
              );
            })}
          </div>
        </Field>
      </Section>
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
    <div className="space-y-5">
      <SaveBar dirty={dirty} onSave={save} />
      <Section icone={Building2} titre="Identité de l'entreprise" sous="Ce que l'agent sait de votre activité." rang={0}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nom de l'entreprise" required><FInput value={form.business_name} onChange={sf("business_name")} placeholder="Ma Boutique SAS" /></Field>
          <Field label="Secteur d'activité" required><FSelect value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value as typeof f.sector }))} options={SECTOR_OPTIONS} /></Field>
          <Field label="Responsable" required><FInput value={form.owner_name} onChange={sf("owner_name")} placeholder="Marie Dupont" /></Field>
          <Field label="Email de contact" required><FInput type="email" value={form.owner_email} onChange={sf("owner_email")} placeholder="contact@boutique.fr" /></Field>
        </div>
        <Field label="Description" required hint="Présentez votre activité en 1-2 phrases">
          <FTextarea value={form.description} onChange={sf("description")} placeholder="Boutique de mode éco-responsable…" rows={3} />
        </Field>
      </Section>

      <Section icone={MapPin} titre="Coordonnées & présence" sous="Où vous trouver, et pour qui vous travaillez." rang={1}>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Site web"><FInput value={form.website_url ?? ""} onChange={sf("website_url")} placeholder="https://maboutique.fr" /></Field>
          <Field label="Localisation"><FInput value={form.location ?? ""} onChange={sf("location")} placeholder="Paris, France" /></Field>
          <Field label="WhatsApp Business"><FInput value={form.whatsapp_number ?? ""} onChange={sf("whatsapp_number")} placeholder="+33 6 12 34 56 78" /></Field>
        </div>
        <Field label="Audience cible" hint="Décrivez votre client idéal">
          <FTextarea value={form.target_audience ?? ""} onChange={sf("target_audience")} placeholder="Femmes 25-45 ans, CSP+, sensibles à l'éco-responsabilité…" rows={2} />
        </Field>
      </Section>
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
    <div className="space-y-5">
      <SaveBar dirty={dirty} onSave={save} />

      <Section icone={BookOpen} titre="Informations clés" sous="Les faits sur lesquels l'agent s'appuie pour répondre." rang={0}>
        <div className="grid gap-5 lg:grid-cols-2">
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
        </div>
      </Section>

      <Section icone={HelpCircle} rang={1}
        titre={<span className="inline-flex items-center gap-2">FAQ <Pastille ton="violet">{faqDraft.length}</Pastille></span>}
        sous="Les questions qui reviennent, avec la réponse exacte à donner."
        action={<Bouton variante="encre" icone={Plus} onClick={addFaq}>Ajouter</Bouton>}>
        {faqDraft.length === 0 && (
          <Vide doodle="sitting-reading" titre="Aucune question pour l'instant"
            texte="Ajoutez des questions fréquentes pour affiner les réponses." />
        )}
        {faqDraft.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {faqDraft.map((entry, i) => (
                <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={RESSORT} className="overflow-hidden">
                  <div className="space-y-3 rounded-[22px] p-4" style={{ background: FOND_DOUX }}>
                    <div className="flex items-center justify-between gap-2">
                      <Pastille ton="violet">Q{i + 1}</Pastille>
                      <BoutonRond icone={Trash2} label="Supprimer la question" onClick={() => removeFaq(i)}
                        className="!h-9 !w-9" style={{ color: "#A63D28" }} />
                    </div>
                    <FInput value={entry.question} onChange={(e) => updateFaq(i, "question", e.target.value)} placeholder="Question fréquente…" className="!bg-white" />
                    <FTextarea value={entry.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} placeholder="Réponse détaillée…" rows={2} className="!bg-white" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Section>

      <Section icone={Ban} titre="Sujets interdits" sous="L'agent refusera d'aborder ces sujets." rang={2}>
        <div className="flex gap-2">
          <FInput value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Concurrents, politique…" className="min-w-0 flex-1" />
          <BoutonRond icone={Plus} label="Ajouter le sujet" onClick={addTag} className="!h-11 !w-11" />
        </div>
        {forbidden.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {forbidden.map((t) => (
                <motion.span key={t} layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={RESSORT}
                  className="inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13px] font-medium"
                  style={{ background: "#FBEAE6", color: "#A63D28" }}>
                  {t}
                  <button onClick={() => setForbidden((f) => f.filter((x) => x !== t))} aria-label={`Retirer ${t}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/70">
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Section>
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
    <div className="min-w-0 space-y-2.5">
      {/* Label row */}
      <div className="flex items-center gap-2 px-1">
        <MediaIcon className="h-4 w-4 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
        <p className="text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</p>
      </div>

      {url ? (
        /* ── File is set ──────────────────────────────────────────────── */
        <div className="flex items-center gap-3 rounded-[22px] p-3 pl-3.5" style={{ background: FOND_DOUX }}>
          {/* Icon bubble */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--cl-accent-soft)" }}>
            <MediaIcon className="h-4 w-4" style={{ color: "var(--cl-accent-deep)" }} />
          </div>

          {/* Filename */}
          <p className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>
            {fileName}
          </p>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <Bouton variante="clair" onClick={() => inputRef.current?.click()} disabled={uploading || deleting} className="!h-9 !px-3.5">
              Remplacer
            </Bouton>
            <BoutonRond icone={deleting ? RefreshCw : X} tourne={deleting} label="Supprimer"
              onClick={doDelete} disabled={uploading || deleting} className="!h-9 !w-9" style={{ color: "#A63D28" }} />
          </div>
        </div>
      ) : (
        /* ── Empty drop zone ──────────────────────────────────────────── */
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center gap-2 rounded-[22px] px-4 py-7 text-center transition-all duration-200"
          style={{
            border:     `1.5px dashed ${dragOver ? "var(--cl-accent)" : "#D9D3E4"}`,
            background: dragOver ? "var(--cl-accent-soft)" : FOND_DOUX,
            cursor:     uploading ? "wait" : "pointer",
          }}>
          {uploading ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--cl-accent)" }} />
              <p className="text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>Upload en cours…</p>
            </>
          ) : (
            <>
              <motion.span animate={{ y: dragOver ? -3 : 0, scale: dragOver ? 1.08 : 1 }} transition={RESSORT}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white"
                style={{ color: dragOver ? "var(--cl-accent)" : "var(--cl-ink-faint)", boxShadow: "inset 0 0 0 1px var(--cl-line)" }}>
                <Upload className="h-4 w-4" />
              </motion.span>
              <p className="text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>
                Glissez un fichier ici ou{" "}
                <span className="font-medium" style={{ color: "var(--cl-accent-deep)" }}>parcourir</span>
              </p>
              <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{formats}</p>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {err && (
        <p className="px-1 text-[12.5px]" style={{ color: "#A63D28" }}>{err}</p>
      )}

      {/* Auto-save confirmation */}
      {url && !uploading && !deleting && (
        <p className="flex items-center gap-1.5 px-1 text-[12.5px]" style={{ color: "#1E7A3A" }}>
          <Check className="h-3.5 w-3.5" /> Sauvegardé automatiquement
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

/** La couleur de l'étiquette d'une capacité (Core, Bientôt, Nouveau…). */
const tonBadge = (badge: string): Ton =>
  badge === "Core" ? "vert" : badge === "Bientôt" ? "gris" : badge === "Nouveau" ? "bleu" : "violet";

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
    <div className="space-y-5">
      <SaveBar dirty={dirty} onSave={save} />

      {/* ── Capacités standard ── */}
      <Section icone={Zap} titre="Capacités" sous="Activez ce que votre agent peut faire. Les capacités « Auto » sont toujours actives." rang={0}>
        <div className="space-y-1.5">
          {visibleCaps.map((cap) => {
            const isToggleable = cap.is_user_configurable && cap.status === "active";
            const isComingSoon = cap.status === "coming_soon";
            const isAuto       = !cap.is_user_configurable;
            const active       = isAuto ? true : caps[cap.id] === true;
            const basculer     = () => setCaps((c) => ({ ...c, [cap.id]: !c[cap.id] }));

            return (
              <div
                key={cap.id}
                role={isToggleable ? "switch" : undefined}
                aria-checked={isToggleable ? active : undefined}
                tabIndex={isToggleable ? 0 : undefined}
                onClick={isToggleable ? basculer : undefined}
                onKeyDown={isToggleable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); basculer(); } } : undefined}
                className={cn(
                  "flex items-center gap-3.5 rounded-[20px] px-3 py-3.5 transition-colors duration-150 sm:gap-4 sm:px-4",
                  isToggleable ? "cursor-pointer hover:bg-[#FAF9FC]" : isComingSoon ? "cursor-not-allowed opacity-50" : "cursor-default opacity-75"
                )}
                style={{ background: active && isToggleable ? "#FBFAFF" : undefined }}
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: active ? "var(--cl-accent-soft)" : "#F4F2F7" }}>
                  <CapIconDash name={cap.icon} className="h-4 w-4"
                    style={{ color: active ? "var(--cl-accent-deep)" : "var(--cl-ink-faint)" }} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-medium" style={{ color: "var(--cl-ink)" }}>
                      {cap.label}
                    </p>
                    {cap.badge && <Pastille ton={tonBadge(cap.badge)}>{cap.badge}</Pastille>}
                    {isAuto && !cap.badge && <Pastille ton="vert">Auto</Pastille>}
                  </div>
                  <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
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

                <Interrupteur actif={active} attenue={!isToggleable} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Séquence d'accueil (audio / vidéo) ── */}
      <Section icone={MessageCircle} rang={1}
        titre={<span className="inline-flex flex-wrap items-center gap-2">Séquence d&apos;accueil <Pastille ton="bleu">Nouveau</Pastille></span>}
        sous="Envoyés automatiquement aux nouveaux contacts WhatsApp. Omettez pour n'envoyer que du texte.">
        <div className="grid gap-5 md:grid-cols-2">
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
      </Section>

    </div>
  );
}

// ── Tab: Model ────────────────────────────────────────────────────────────────

function ModelTab({ agent, onSave }: { agent: Agent; onSave: (p: Partial<Agent>) => void }) {
  const [model, setModel] = useState(agent.target_model);
  const dirty = model !== agent.target_model;
  const save = () => { onSave({ target_model: model }); toast.success("Modèle mis à jour !"); };

  return (
    <div className="space-y-5">
      <SaveBar dirty={dirty} onSave={save} />
      <Section icone={Sparkles} titre="Modèle LLM cible" sous="Le modèle utilisé pour générer les réponses de votre agent." rang={0}>
        <div role="radiogroup" aria-label="Modèle LLM cible" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {MODEL_OPTIONS.map((opt, i) => {
            const choisi = model === opt.value;
            return (
              <motion.button
                key={opt.value}
                {...apparait(i)}
                role="radio"
                aria-checked={choisi}
                aria-disabled={!opt.available}
                whileTap={opt.available ? { scale: 0.98 } : undefined}
                onClick={() => opt.available && setModel(opt.value as AgentModel)}
                className="relative flex items-start gap-3.5 rounded-[24px] p-4 text-left transition-colors duration-200 sm:p-5"
                style={{
                  background: choisi ? "var(--cl-accent-soft)" : FOND_DOUX,
                  boxShadow: choisi ? "inset 0 0 0 1.5px var(--cl-accent)" : "inset 0 0 0 1px var(--cl-line-soft)",
                  cursor: opt.available ? "pointer" : "not-allowed",
                  opacity: opt.available ? 1 : 0.5,
                }}>
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white"
                  style={{ boxShadow: `inset 0 0 0 2px ${choisi ? "var(--cl-accent)" : "#D6D0E0"}` }}>
                  {choisi && <motion.span layoutId="ag-modele" transition={RESSORT} className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cl-accent)" }} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium" style={{ color: choisi ? "var(--cl-accent-deep)" : "var(--cl-ink)" }}>{opt.label}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{opt.sub}</p>
                </div>
                {opt.available
                  ? <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: choisi ? "var(--cl-accent)" : "var(--cl-ink-faint)", opacity: choisi ? 1 : 0.4 }} />
                  : <Pastille ton="gris">Bientôt</Pastille>
                }
              </motion.button>
            );
          })}
        </div>
      </Section>
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
      latitude: agent.business_context.latitude ?? null, longitude: agent.business_context.longitude ?? null,
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
      <Section icone={Code2} rang={0}
        titre={<span className="inline-flex flex-wrap items-center gap-2">System Prompt <Pastille ton="violet">v{agent.system_prompt.version}</Pastille></span>}
        sous={<span className="tabular-nums">{agent.system_prompt.estimated_tokens.toLocaleString("fr-FR")} tokens · {agent.system_prompt.target_model}</span>}>
        <div className="flex flex-wrap items-center gap-2">
          <Bouton variante="clair" icone={copied ? Check : Copy} onClick={handleCopy}>
            {copied ? "Copié !" : "Copier"}
          </Bouton>
          <Bouton variante="doux" icone={RefreshCw} onClick={handleRegenerate}>Régénérer</Bouton>
          {!editing ? (
            <Bouton variante="encre" icone={Pencil} onClick={() => { setDraft(agent.system_prompt.compiled_prompt); setEditing(true); }}>
              Modifier
            </Bouton>
          ) : (
            <>
              <Bouton variante="clair" onClick={() => setEditing(false)}>Annuler</Bouton>
              <Bouton variante="encre" icone={Save} onClick={handleSave}>Sauvegarder</Bouton>
            </>
          )}
        </div>

        <div className="overflow-hidden rounded-[24px]" style={{ background: FOND_DOUX, boxShadow: editing ? "inset 0 0 0 1.5px var(--cl-accent)" : "inset 0 0 0 1px var(--cl-line-soft)" }}>
          <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--cl-line-soft)" }}>
            <div className="flex gap-1.5">
              {["#F2B8AC", "#F5D79A", "#A9DDB9"].map((c, i) => <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
            </div>
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>system_prompt.txt</span>
            {editing && <Pastille ton="violet" point>Édition</Pastille>}
          </div>
          {editing ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={24}
              className="block w-full resize-y bg-white px-5 py-5 font-mono text-[13px] focus:outline-none sm:px-6"
              style={{ color: "var(--cl-ink)", lineHeight: 1.75 }} />
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-5 font-mono text-[13px] sm:px-6"
              style={{ color: "var(--cl-ink-soft)", lineHeight: 1.75, maxHeight: "560px", overflowY: "auto" }}>
              {agent.system_prompt.compiled_prompt}
            </pre>
          )}
        </div>
      </Section>
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
      <p className="px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink-faint)" }}>
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
      <div className="flex items-center gap-3.5 rounded-[22px] p-4" style={{ background: FOND_DOUX }}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: `${accentColor}14` }}>
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</p>
            <Pastille ton="gris">Bientôt</Pastille>
          </div>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>{description}</p>
        </div>
      </div>
    );
  }

  /** L'en-tête d'une carte d'intégration : pastille d'icône, nom, état. */
  function EnteteCarte({ icone, fond, titre, sous, etat }: {
    icone: React.ReactNode; fond: string; titre: React.ReactNode; sous: React.ReactNode; etat?: React.ReactNode;
  }) {
    return (
      <div className="flex items-center gap-3.5 px-5 py-4 sm:px-6">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: fond }}>
          {icone}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>{titre}</div>
          <p className="truncate text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>{sous}</p>
        </div>
        {etat}
      </div>
    );
  }

  const carte = "overflow-hidden rounded-[28px] bg-white";
  const bordure = { border: "1px solid var(--cl-line-soft)" };
  const separation = { borderTop: "1px solid var(--cl-line-soft)" };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── MESSAGERIE ───────────────────────────────────────────────────────── */}
      <motion.div {...apparait(0)} className="space-y-3">
        <SectionHeader label="Messagerie" />

        {/* WhatsApp card */}
        <div className={carte} style={bordure}>
          <EnteteCarte
            fond="#E4F6EA"
            icone={<MessageCircle className="h-[18px] w-[18px]" style={{ color: "#1E7A3A" }} />}
            titre="WhatsApp Business"
            sous={isWorking ? `Connecté · ${phoneNumber ?? ""}` : isScanning ? "Scannez le QR code" : isStarting ? "Démarrage…" : "Non connecté"}
            etat={
              <Pastille ton={isWorking ? "vert" : isScanning || isStarting ? "ambre" : "gris"} point className="flex-shrink-0">
                <span className="hidden sm:inline">{isWorking ? "Actif" : isScanning ? "En attente" : isStarting ? "Démarrage" : "Inactif"}</span>
              </Pastille>
            }
          />

          {/* Mode toggle QR / Phone — visible uniquement en scan */}
          <AnimatePresence>
            {isScanning && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                transition={RESSORT} className="overflow-hidden" style={separation}>
                <div className="flex px-5 pt-5 sm:px-6">
                  <div role="radiogroup" aria-label="Mode de connexion" className="ui-filtres flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
                    {([
                      { cle: "qr" as const,    libelle: "QR Code", Icone: Globe },
                      { cle: "phone" as const, libelle: "Numéro",  Icone: Phone },
                    ]).map(({ cle, libelle, Icone }) => {
                      const actif = connectMode === cle;
                      return (
                        <button key={cle} role="radio" aria-checked={actif} onClick={() => setConnectMode(cle)}
                          className="relative flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13.5px] transition-colors"
                          style={{ color: actif ? "#fff" : "var(--cl-ink-soft)" }}>
                          {actif && <motion.span layoutId="ag-mode-waha" transition={RESSORT} className="absolute inset-0 rounded-full" style={{ background: "var(--cl-ink)" }} />}
                          <Icone className="relative h-3.5 w-3.5" />
                          <span className="relative">{libelle}</span>
                          {cle === "phone" && (
                            <span className="relative rounded-full px-1.5 text-[10.5px] font-semibold"
                              style={{ background: actif ? "rgba(255,255,255,0.18)" : "#FDF1DC", color: actif ? "#fff" : "#9A6510" }}>NEXT</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {connectMode === "qr" && (
                  <div className="flex flex-col items-center gap-4 px-5 py-6 sm:px-6">
                    <p className="text-center text-[13.5px]" style={{ color: "var(--cl-ink-soft)" }}>
                      WhatsApp → Paramètres → Appareils liés → Lier un appareil
                    </p>
                    {qrBlobUrl ? (
                      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={RESSORT}
                        className="overflow-hidden rounded-[24px] bg-white p-3" style={{ boxShadow: "0 0 0 1px var(--cl-line-soft), 0 14px 32px rgba(70,40,190,0.08)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrBlobUrl} alt="QR WhatsApp" width={200} height={200} />
                      </motion.div>
                    ) : (
                      <div className="ui-squelette flex h-[200px] w-[200px] items-center justify-center rounded-[24px]">
                        <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--cl-accent)" }} />
                      </div>
                    )}
                    <Bouton variante="doux" icone={RefreshCw} onClick={() => sessionName && fetchQr(sessionName)}>
                      Actualiser le QR
                    </Bouton>
                  </div>
                )}

                {connectMode === "phone" && (
                  <div className="flex flex-col gap-4 px-5 py-6 sm:px-6">
                    <p className="text-[13.5px]" style={{ color: "var(--cl-ink-soft)" }}>
                      WhatsApp → Paramètres → Appareils liés → Lier avec numéro de téléphone
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <FInput
                        placeholder="+33 6 12 34 56 78"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="min-w-0 flex-1"
                      />
                      <Bouton variante="encre" onClick={handlePhoneCode} disabled={phoneLoading} occupe={phoneLoading} className="!h-11">
                        {phoneLoading ? null : "Obtenir le code"}
                      </Bouton>
                    </div>
                    {pairingCode && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={RESSORT}
                        className="rounded-[22px] p-5 text-center" style={{ background: "#E4F6EA" }}>
                        <p className="mb-2 text-[13px]" style={{ color: "#1E6A37" }}>Entrez ce code dans WhatsApp</p>
                        <p className="break-all font-mono text-[26px] font-medium tracking-[0.2em]" style={{ color: "#1E7A3A" }}>{pairingCode}</p>
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
                className="px-5 pb-4 sm:px-6">
                <div className="flex items-center gap-3 rounded-[18px] px-4 py-3" style={{ background: "#F1FAF4" }}>
                  <Phone className="h-4 w-4 flex-shrink-0" style={{ color: "#1E7A3A" }} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[14px]" style={{ color: "#1E7A3A" }}>+{phoneNumber}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions WhatsApp */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6" style={{ ...separation, background: FOND_DOUX }}>
            {isStopped ? (
              <Bouton variante="encre" icone={connecting ? undefined : MessageCircle} occupe={connecting}
                onClick={handleWahaConnect} disabled={connecting}>
                {connecting ? "Connexion…" : "Connecter WhatsApp"}
              </Bouton>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                {!isWorking && (
                  <span className="truncate text-[13px] animate-pulse" style={{ color: "var(--cl-ink-faint)" }}>
                    {isStarting ? "Initialisation…" : "En attente du scan…"}
                  </span>
                )}
              </div>
            )}
            {!isStopped && (
              <Bouton variante="danger" onClick={handleWahaDisconnect}>
                Déconnecter
              </Bouton>
            )}
          </div>
        </div>
      </motion.div>

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

            <div className={carte} style={{ border: `1px solid ${calendarConnected ? "#CDEBD7" : "var(--cl-line-soft)"}` }}>
              {/* Header Google Agenda */}
              <EnteteCarte
                fond={calendarConnected ? "#E4F6EA" : "var(--cl-accent-soft)"}
                icone={<Calendar className="h-[18px] w-[18px]" style={{ color: calendarConnected ? "#1E7A3A" : "var(--cl-accent-deep)" }} />}
                titre="Google Agenda"
                sous={calendarConnected
                  ? `Connecté · ${agent.google_calendar_email}`
                  : "Requis pour vérifier les dispos et créer des événements"}
                etat={
                  <Pastille ton={calendarConnected ? "vert" : "gris"} point className="flex-shrink-0">
                    <span className="hidden sm:inline">{calendarConnected ? "Connecté" : "Non connecté"}</span>
                  </Pastille>
                }
              />

              {/* Info quand connecté */}
              <AnimatePresence>
                {calendarConnected && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="px-5 pb-4 sm:px-6">
                      <div className="flex items-center gap-3 rounded-[18px] px-4 py-3" style={{ background: "#F1FAF4" }}>
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: "#1E7A3A" }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>
                            {agent.google_calendar_email}
                          </p>
                          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                            Les rendez-vous seront créés automatiquement dans ce calendrier.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions Google Agenda */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6" style={{ ...separation, background: FOND_DOUX }}>
                {!calendarConnected ? (
                  <Bouton variante="encre" icone={gcalLoading ? undefined : Calendar} occupe={gcalLoading}
                    onClick={handleGCalConnect} disabled={gcalLoading}>
                    {gcalLoading ? "Connexion…" : "Connecter Google Agenda"}
                  </Bouton>
                ) : (
                  <p className="text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>
                    Agenda actif · les créneaux libres sont détectés en temps réel
                  </p>
                )}
                {calendarConnected && (
                  <Bouton variante="danger" onClick={handleGCalDisconnect} disabled={gcalLoading}>
                    {gcalLoading ? "…" : "Déconnecter"}
                  </Bouton>
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

            <div className={cn(carte, "p-3 sm:p-4")} style={bordure}>
              <div className="grid gap-2.5 lg:grid-cols-3">
                <ComingSoonCard
                  icon={<IconFacebook className="h-4 w-4" />}
                  label="Facebook"
                  description="Publication, gestion des messages et commentaires"
                  accentColor="#1877F2"
                />
                <ComingSoonCard
                  icon={<IconInstagram className="h-4 w-4" />}
                  label="Instagram"
                  description="Publication de contenu et réponses automatiques"
                  accentColor="#E1306C"
                />
                <ComingSoonCard
                  icon={<IconTikTok className="h-4 w-4" />}
                  label="TikTok"
                  description="Publication de vidéos et gestion des interactions"
                  accentColor="#010101"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODE PROPRIÉTAIRE ────────────────────────────────────────────────── */}
      <motion.div {...apparait(1)} className="space-y-3">
        <SectionHeader label="Mode Propriétaire" />

        <div className={carte} style={{ border: "1px solid var(--cl-lavender)" }}>

          {/* Header */}
          <div style={{ background: "linear-gradient(90deg, #F7F4FF 0%, #fff 75%)" }}>
            <EnteteCarte
              fond="var(--cl-accent-soft)"
              icone={<KeyRound className="h-[18px] w-[18px]" style={{ color: "var(--cl-accent-deep)" }} />}
              titre={
                <span className="inline-flex flex-wrap items-center gap-2">
                  Mode Propriétaire
                  {pwSet
                    ? <Pastille ton="vert">Configuré</Pastille>
                    : <Pastille ton="gris">Non configuré</Pastille>}
                </span>
              }
              sous="Accès exclusif depuis votre WhatsApp — conseiller stratégique & CM IA"
            />
          </div>

          <div className="space-y-6 px-5 py-5 sm:px-6" style={separation}>

            {/* Comment ça marche */}
            <div className="space-y-1.5 rounded-[22px] px-4 py-3.5" style={{ background: FOND_DOUX }}>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                Envoyez <span className="rounded-full px-2 py-0.5 font-mono text-[12.5px] font-medium"
                  style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>/votre-mot-de-passe</span> à votre agent depuis WhatsApp.
              </p>
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
                L&apos;agent bascule en consultant IA : stratégie, calendriers éditoriaux, campagnes, planning. Session 8h. Tapez <span className="font-mono font-medium">/exit</span> pour quitter.
              </p>
            </div>

            {/* ─── Mot de passe ─────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="px-1 text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>
                {pwSet ? "Changer le mot de passe" : "Définir le mot de passe d'accès"}
              </p>

              <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <div className="relative">
                  <input
                    type={pwRevealNew ? "text" : "password"}
                    value={pwInput}
                    onChange={(e) => setPwInput(e.target.value)}
                    placeholder="Nouveau mot de passe"
                    className="ui-champ pr-12"
                  />
                  <button type="button" onClick={() => setPwRevealNew((v) => !v)}
                    aria-label={pwRevealNew ? "Masquer" : "Afficher"}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-white"
                    style={{ color: "var(--cl-ink-faint)" }}>
                    {pwRevealNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={pwRevealConf ? "text" : "password"}
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSavePassword()}
                    placeholder="Confirmer"
                    className="ui-champ pr-12"
                    style={pwConfirm && pwConfirm !== pwInput ? { borderColor: "#E3A496", background: "#FFF8F6" } : undefined}
                  />
                  <button type="button" onClick={() => setPwRevealConf((v) => !v)}
                    aria-label={pwRevealConf ? "Masquer" : "Afficher"}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-white"
                    style={{ color: "var(--cl-ink-faint)" }}>
                    {pwRevealConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {pwConfirm && pwConfirm !== pwInput && (
                <p className="px-1 text-[12.5px]" style={{ color: "#A63D28" }}>Les mots de passe ne correspondent pas</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Bouton
                  variante="encre"
                  icone={pwSaving ? undefined : Save}
                  occupe={pwSaving}
                  onClick={handleSavePassword}
                  disabled={pwSaving || !pwInput || !pwConfirm || pwInput !== pwConfirm}>
                  {pwSet ? "Mettre à jour" : "Définir le mot de passe"}
                </Bouton>
                {pwSet && (
                  <Bouton variante="danger" icone={Trash2} onClick={handleRemovePassword} disabled={pwSaving}>
                    Désactiver le mode proprio
                  </Bouton>
                )}
              </div>
            </div>

            {/* ─── Sessions actives ──────────────────────────────────── */}
            <div className="pt-5" style={separation}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 px-1">
                  <p className="text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>
                    Sessions WhatsApp actives
                  </p>
                  {ownerSessions.length > 0 && (
                    <Pastille ton="vert">{ownerSessions.length}</Pastille>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <BoutonRond icone={RefreshCw} tourne={sessionsLoading} label="Rafraîchir"
                    onClick={fetchOwnerSessions} disabled={sessionsLoading} />
                  {ownerSessions.length > 0 && (
                    <Bouton variante="danger" icone={revokingAll ? undefined : Trash2} occupe={revokingAll}
                      onClick={handleRevokeAll} disabled={revokingAll}>
                      Tout révoquer
                    </Bouton>
                  )}
                </div>
              </div>

              {sessionsLoading && ownerSessions.length === 0 && (
                <Squelettes n={2} hauteur={60} />
              )}

              {!sessionsLoading && ownerSessions.length === 0 && (
                <div className="rounded-[22px] px-4 py-5 text-center" style={{ background: FOND_DOUX }}>
                  <p className="text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>Aucune session propriétaire active</p>
                </div>
              )}

              {ownerSessions.length > 0 && (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {ownerSessions.map((s) => {
                      const authDate    = new Date(s.authenticated_at);
                      const expiresAt   = new Date(s.expires_at);
                      const minutesLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));
                      const timeLeft    = minutesLeft > 60
                        ? `${Math.floor(minutesLeft / 60)}h${minutesLeft % 60 > 0 ? String(minutesLeft % 60).padStart(2,"0") : ""} restant`
                        : `${minutesLeft}min restant`;

                      return (
                        <motion.div key={s.id} layout
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={RESSORT}
                          className="flex items-center gap-3 rounded-[20px] px-4 py-3"
                          style={{ background: FOND_DOUX }}>
                          <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full"
                            style={{ background: "#1DAB55", boxShadow: "0 0 0 4px #E4F6EA" }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{s.phone}</p>
                            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                              Connecté {authDate.toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                              {" · "}
                              <span style={{ color: minutesLeft < 30 ? "#A63D28" : "var(--cl-ink-faint)" }}>{timeLeft}</span>
                            </p>
                          </div>
                          <Bouton
                            variante="danger"
                            icone={revokingId === s.id ? undefined : Trash2}
                            occupe={revokingId === s.id}
                            onClick={() => handleRevokeSession(s.phone, s.id)}
                            disabled={revokingId === s.id}
                            className="!h-9 !px-3"
                            aria-label="Révoquer">
                            {revokingId === s.id ? null : <span className="hidden sm:inline">Révoquer</span>}
                          </Bouton>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

          </div>
        </div>
      </motion.div>

      {/* ── Agent ID ──────────────────────────────────────────────────────────── */}
      <Section icone={Fingerprint} titre="Agent ID" sous="L'identifiant à communiquer au support ou à vos intégrations." rang={2}
        action={<Bouton variante="clair" icone={copied ? Check : Copy} onClick={copyId}>{copied ? "Copié" : "Copier"}</Bouton>}>
        <p className="truncate rounded-[18px] px-4 py-3 font-mono text-[13px]" style={{ background: FOND_DOUX, color: "var(--cl-ink-soft)" }}>{agent.id}</p>
      </Section>
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
      <div className="py-6 lg:py-8">
        <StylesUI />
        <div className="mb-6 ui-squelette h-12 max-w-xl rounded-full" />
        <Squelettes n={3} hauteur={150} />
      </div>
    );
  }

  return (
    // Dans la coquille du tableau de bord : le nom et le statut sont déjà dans
    // le titre de la feuille. Ici, seulement les onglets et leur contenu.
    <div className="py-6 lg:py-8">
      <StylesUI />

      {/* ── Onglets, mobile et tablette : la barre de pastilles ───────────── */}
      <div className="mb-6 lg:hidden">
        <Filtres<TabId>
          id="agent-onglets"
          label="Sections de l'agent"
          valeur={tab}
          onChange={setTab}
          options={TABS.map(({ id, label }) => ({ cle: id, libelle: label }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">

        {/* ── Onglets, grand écran : le menu collant ─────────────────────── */}
        <nav aria-label="Sections de l'agent" className="hidden lg:sticky lg:top-[96px] lg:block lg:self-start">
          <div role="radiogroup" aria-label="Sections de l'agent" className="space-y-1 rounded-[28px] p-2" style={{ background: "#F4F2F7" }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const actif = tab === id;
              return (
                <button key={id} role="radio" aria-checked={actif} onClick={() => setTab(id)}
                  className="relative flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-left text-[13.5px] transition-colors duration-150 hover:bg-white/60"
                  style={{ color: actif ? "#fff" : "var(--cl-ink-soft)" }}>
                  {actif && <motion.span layoutId="ag-onglet" transition={RESSORT} className="absolute inset-0 rounded-full" style={{ background: "var(--cl-ink)" }} />}
                  <span className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: actif ? "rgba(255,255,255,0.16)" : "#fff" }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="relative truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Le contenu ─────────────────────────────────────────────────── */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
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
  );
}
