// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/[agentId]/page.tsx — Camille by Buyticle
// Configuration complète d'un agent avec navigation par onglets.
// Inspiré de l'interface ElevenLabs : sidebar gauche + contenu tabulé.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter }             from "next/navigation";
import { motion, AnimatePresence }          from "framer-motion";
import {
  ArrowLeft, Sparkles, Bot, BookOpen,
  Zap, Code2, Plug2, RefreshCw, Copy, Check,
  Save, Pencil, Plus, Trash2, Play, Pause,
  MessageCircle, Globe, Phone, Clock,
  Users, ChevronDown, LayoutDashboard,
} from "lucide-react";
import { toast }                from "sonner";
import { useAuth }             from "@/hooks/useAuth";
import { useAgent }            from "@/hooks/useAgent";
import { generateSystemPrompt } from "@/lib/generateSystemPrompt";
import { cn }                      from "@/lib/utils";
import type { Agent, AgentModel, FAQEntry } from "@/types/agent";

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

const MODEL_OPTIONS = [
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", sub: "Recommandé · Meilleur équilibre" },
  { value: "claude-3-haiku-20240307",    label: "Claude 3 Haiku",    sub: "Ultra-rapide · Économique" },
  { value: "gpt-4o",                     label: "GPT-4o",             sub: "OpenAI · Très capable" },
  { value: "gpt-4o-mini",               label: "GPT-4o mini",        sub: "OpenAI · Rapide & léger" },
];

const EMOJI_PRESETS = ["✨","🤖","💼","🛍️","🏥","📚","🏠","⚖️","💄","🍽️","💻","🤝","💡","🎯","🦁","🦊","🦋","🌟","🔮","🎨"];

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

function OverviewTab({ agent, onToggleStatus }: { agent: Agent; onToggleStatus: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyId = async () => {
    await navigator.clipboard.writeText(agent.id);
    setCopied(true);
    toast.success("ID copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const CAPS_META = [
    { key: "support_whatsapp",     label: "WhatsApp",  icon: MessageCircle },
    { key: "content_generation",   label: "Contenu",   icon: Sparkles },
    { key: "community_management", label: "Community", icon: Users },
    { key: "strategy_advisor",     label: "Stratégie", icon: LayoutDashboard },
    { key: "lead_capture",         label: "Leads",     icon: Zap },
    { key: "proactive_messaging",  label: "Proactif",  icon: MessageCircle },
    { key: "image_creation",       label: "Images",    icon: Sparkles },
  ] as const;

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
          {CAPS_META.map(({ key, label, icon: Icon }) => {
            const active = agent.capabilities[key];
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: active ? "rgba(212,175,55,0.08)" : "var(--bg-muted)", border: `1px solid ${active ? "rgba(212,175,55,0.2)" : "var(--border-subtle)"}`, opacity: active ? 1 : 0.4 }}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: active ? "var(--color-gold)" : "var(--text-disabled)" }} />
                <span className="text-2xs font-medium" style={{ color: active ? "var(--color-gold)" : "var(--text-tertiary)" }}>{label}</span>
              </div>
            );
          })}
        </div>
      </SectionCard>

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

function CapabilitiesTab({ agent, onSave }: { agent: Agent; onSave: (p: Partial<Agent>) => void }) {
  const [caps, setCaps] = useState({ ...agent.capabilities });
  const dirty = JSON.stringify(caps) !== JSON.stringify(agent.capabilities);
  const save = () => { onSave({ capabilities: { ...caps } }); toast.success("Capacités mises à jour !"); };

  const CAPS_META = [
    { key: "support_whatsapp" as const,     icon: MessageCircle, label: "Support WhatsApp",         desc: "Répond automatiquement aux messages WhatsApp entrants.", tag: "Core" },
    { key: "content_generation" as const,   icon: Sparkles,      label: "Génération de contenu",    desc: "Crée posts, captions, newsletters sur demande.", tag: null },
    { key: "community_management" as const, icon: Users,         label: "Community Management",     desc: "Planifie et publie du contenu sur les réseaux.", tag: null },
    { key: "strategy_advisor" as const,     icon: LayoutDashboard, label: "Conseiller Stratégique", desc: "Recommandations stratégiques et résumés analytiques.", tag: null },
    { key: "lead_capture" as const,         icon: Zap,           label: "Capture de Leads",         desc: "Qualifie et pousse les prospects vers votre CRM.", tag: null },
    { key: "proactive_messaging" as const,  icon: MessageCircle, label: "Messagerie Proactive",     desc: "Messages de suivi et broadcasts ciblés.", tag: null },
    { key: "image_creation" as const,       icon: Sparkles,      label: "Création d'images",        desc: "Génère des visuels IA pour vos campagnes.", tag: "Bêta" },
  ] as const;

  return (
    <div className="space-y-4">
      <SaveBar dirty={dirty} onSave={save} />
      {CAPS_META.map(({ key, icon: Icon, label, desc, tag }) => {
        const active = caps[key];
        const isLive = key === "support_whatsapp";
        return (
          <div key={key}
            onClick={isLive ? () => setCaps((c) => ({ ...c, [key]: !c[key] })) : undefined}
            className={cn("flex items-center gap-4 py-3 transition-colors duration-100", isLive ? "cursor-pointer" : "cursor-not-allowed opacity-50")}
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {/* Toggle */}
            <div className="relative w-8 h-4 rounded-full flex-shrink-0"
              style={{ background: isLive && active ? "var(--color-gold)" : "var(--bg-muted)", border: `1px solid ${isLive && active ? "var(--color-gold)" : "var(--border-default)"}` }}>
              <motion.div animate={{ x: isLive && active ? 16 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-0.5 w-3 h-3 rounded-full"
                style={{ background: isLive && active ? "#000" : "var(--text-disabled)" }} />
            </div>
            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isLive && active ? "var(--color-gold)" : "var(--text-disabled)" }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium" style={{ color: isLive && active ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</p>
                {isLive && tag && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(212,175,55,0.12)", color: "var(--color-gold)" }}>{tag}</span>}
                {!isLive && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-disabled)" }}>Bientôt</span>}
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-disabled)" }}>{desc}</p>
            </div>
          </div>
        );
      })}
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
            <div key={opt.value} onClick={() => setModel(opt.value as AgentModel)} className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200"
              style={{ background: model === opt.value ? "rgba(212,175,55,0.08)" : "var(--bg-elevated)", border: `1px solid ${model === opt.value ? "var(--border-gold)" : "var(--border-subtle)"}` }}>
              <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${model === opt.value ? "var(--color-gold)" : "var(--border-default)"}` }}>
                {model === opt.value && <div className="w-2 h-2 rounded-full" style={{ background: "var(--color-gold)" }} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: model === opt.value ? "var(--color-gold)" : "var(--text-primary)" }}>{opt.label}</p>
                <p className="text-2xs mt-0.5" style={{ color: "var(--text-disabled)" }}>{opt.sub}</p>
              </div>
              <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: model === opt.value ? "var(--color-gold)" : "var(--text-disabled)", opacity: model === opt.value ? 1 : 0.3 }} />
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

// ── Tab: Integration (WhatsApp connection) ────────────────────────────────────

type WahaStatus = "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED" | "ERROR" | null;

function IntegrationTab({ agent }: { agent: Agent }) {
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

  const token = typeof window !== "undefined" ? localStorage.getItem("camille_token") : null;
  const authH: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

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
  }, []);

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
  }, [agent.id, fetchQr, connectMode]);

  function stopPolling() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }
  function startPolling() {
    stopPolling();
    intervalRef.current = setInterval(() => fetchStatus(), 3000);
  }

  useEffect(() => { fetchStatus(); return () => stopPolling(); }, [fetchStatus]);

  const handleConnect = async () => {
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

  const handleDisconnect = async () => {
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

  const copyId = async () => {
    await navigator.clipboard.writeText(agent.id);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const isWorking  = wahaStatus === "WORKING";
  const isScanning = wahaStatus === "SCAN_QR_CODE";
  const isStarting = wahaStatus === "STARTING";
  const isStopped  = !wahaStatus || wahaStatus === "STOPPED" || wahaStatus === "FAILED" || wahaStatus === "ERROR";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: "var(--bg-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)" }}>
            <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>WhatsApp</p>
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

        {/* Mode toggle (QR / Phone) — visible quand en attente de scan */}
        <AnimatePresence>
          {isScanning && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              {/* Toggle */}
              <div className="flex px-5 pt-5 gap-2">
                {(["qr", "phone"] as const).map((m) => (
                  <button key={m} onClick={() => setConnectMode(m)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                    style={connectMode === m
                      ? { background: "var(--surface-gold)", color: "var(--color-gold)", border: "1px solid var(--border-gold)" }
                      : { background: "transparent", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
                    {m === "qr" ? <><Globe className="w-3 h-3" /> QR Code</> : <><Phone className="w-3 h-3" /> Numéro</>}
                  </button>
                ))}
              </div>

              {/* QR mode */}
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

              {/* Phone mode */}
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
                      {phoneLoading ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Obtenir le code"}
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

        {/* Connected phone */}
        <AnimatePresence>
          {isWorking && phoneNumber && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-4">
              <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#25D366" }} />
              <span className="text-sm font-mono flex-1" style={{ color: "#25D366" }}>+{phoneNumber}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {isStopped ? (
            <button onClick={handleConnect} disabled={connecting}
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
            <button onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150 flex-shrink-0"
              style={{ color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              Déconnecter
            </button>
          )}
        </div>
      </div>

      {/* Agent ID */}
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
  const { agentId }                = useParams<{ agentId: string }>();
  const router                     = useRouter();
  const { isLoggedIn }             = useAuth();
  const { agent, loading, update } = useAgent(agentId);
  const [tab, setTab]              = useState<TabId>("overview");

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
                {tab === "overview"     && <OverviewTab     agent={agent} onToggleStatus={handleToggleStatus} />}
                {tab === "identity"     && <IdentityTab     agent={agent} onSave={handleSave} />}
                {tab === "business"     && <BusinessTab     agent={agent} onSave={handleSave} />}
                {tab === "knowledge"    && <KnowledgeTab    agent={agent} onSave={handleSave} />}
                {tab === "capabilities" && <CapabilitiesTab agent={agent} onSave={handleSave} />}
                {tab === "model"        && <ModelTab        agent={agent} onSave={handleSave} />}
                {tab === "prompt"       && <PromptTab       agent={agent} onSave={handleSave} />}
                {tab === "integration"  && <IntegrationTab  agent={agent} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
