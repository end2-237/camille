// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/billing/page.tsx — Plans & Facturation — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams }                  from "next/navigation";
import { motion, AnimatePresence }           from "framer-motion";
import {
  Zap, Check, X, CreditCard, TrendingUp, AlertTriangle,
  RefreshCw, ChevronRight, Sparkles, Shield, Phone,
  MessageCircle, Clock, History, UserPlus, FileText,
  Target, Send, Users, Image, Info,
} from "lucide-react";
import { toast }       from "sonner";
import { useAuth }     from "@/hooks/useAuth";
import { useAgents }   from "@/hooks/useAgents";
import { cn }          from "@/lib/utils";
import { PLANS, UPGRADEABLE_PLANS, getPlanPriceXAF, getPlanLabel, isUnlimited } from "@/lib/plans";
import type { Agent }  from "@/types/agent";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentUsage {
  plan:    { id: string; label: string; limit: number; unlimited: boolean };
  current: { period: string; total_tokens: number; remaining: number; percent: number };
}

interface Payment {
  id:             string;
  plan_id:        string;
  agent_id:       string;
  amount:         number;
  currency:       string;
  status:         "pending" | "success" | "failed" | "cancelled";
  transaction_id: string | null;
  created_at:     string;
}

// ── Plan feature lists ────────────────────────────────────────────────────────

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "1 agent WhatsApp",
    "50 000 tokens / mois",
    "Historique 10 messages",
    "Support communautaire",
  ],
  starter: [
    "1 agent WhatsApp",
    "500 000 tokens / mois",
    "Historique 50 messages",
    "Indicateur de frappe",
    "Historique de conversation",
    "Support email prioritaire",
  ],
  pro: [
    "Agents illimités",
    "2 000 000 tokens / mois",
    "Historique 200 messages",
    "Indicateur de frappe",
    "Toutes les capacités",
    "Support dédié",
    "Analytics avancés",
  ],
  enterprise: [
    "Tokens illimités",
    "Déploiement personnalisé",
    "SLA garanti",
    "Intégrations sur mesure",
    "Account manager dédié",
    "Facturation sur devis",
  ],
};

const PLAN_ORDER: (keyof typeof PLANS)[] = ["free", "starter", "pro", "enterprise"];
const PLAN_HIGHLIGHT: Record<string, boolean> = { pro: true };

// ── Capability cost catalogue ─────────────────────────────────────────────────

const CAPABILITY_COSTS = [
  {
    id:          "support_whatsapp",
    icon:        MessageCircle,
    label:       "Support WhatsApp",
    description: "Réponses automatiques aux messages entrants",
    tokensPerMsg: 800,
    color:       "#34D399",
    plans:       ["free","starter","pro","enterprise"],
    alwaysOn:    true,          // always counted — it's the base capability
  },
  {
    id:          "typing_indicator",
    icon:        Clock,
    label:       "Indicateur de frappe",
    description: "Simulation startTyping / stopTyping avant chaque réponse",
    tokensPerMsg: 0,
    color:       "#60A5FA",
    plans:       ["starter","pro","enterprise"],
    alwaysOn:    false,
  },
  {
    id:          "conversation_history",
    icon:        History,
    label:       "Historique de conversation",
    description: "Injection des 10 à 200 derniers échanges dans le contexte",
    tokensPerMsg: 400,
    color:       "#A78BFA",
    plans:       ["starter","pro","enterprise"],
    alwaysOn:    false,
  },
  {
    id:          "lead_capture",
    icon:        UserPlus,
    label:       "Capture de leads",
    description: "Collecte d'email / téléphone + enregistrement CRM",
    tokensPerMsg: 200,
    color:       "#FB923C",
    plans:       ["starter","pro","enterprise"],
    alwaysOn:    false,
  },
  {
    id:          "content_generation",
    icon:        FileText,
    label:       "Génération de contenu",
    description: "Rédaction de posts, e-mails, descriptions produits",
    tokensPerMsg: 1_200,
    color:       "#F472B6",
    plans:       ["pro","enterprise"],
    alwaysOn:    false,
  },
  {
    id:          "strategy_advisor",
    icon:        Target,
    label:       "Conseiller stratégique",
    description: "Analyse de marché, recommandations, plan d'action",
    tokensPerMsg: 500,
    color:       "#FBBF24",
    plans:       ["pro","enterprise"],
    alwaysOn:    false,
  },
  {
    id:          "proactive_messaging",
    icon:        Send,
    label:       "Messages proactifs",
    description: "Envoi de campagnes et relances sortantes planifiées",
    tokensPerMsg: 600,
    color:       "#34D399",
    plans:       ["pro","enterprise"],
    alwaysOn:    false,
  },
  {
    id:          "community_management",
    icon:        Users,
    label:       "Gestion communauté",
    description: "Animation de groupes WhatsApp et forums",
    tokensPerMsg: 900,
    color:       "#60A5FA",
    plans:       ["pro","enterprise"],
    alwaysOn:    false,
  },
  {
    id:          "image_creation",
    icon:        Image,
    label:       "Création d'images",
    description: "Génération via DALL-E / Stable Diffusion à la demande",
    tokensPerMsg: 2_500,
    color:       "#A78BFA",
    plans:       ["enterprise"],
    alwaysOn:    false,
  },
] as const;

// ── Capability cost breakdown component ───────────────────────────────────────

function CapabilityCostBreakdown({ agent }: { agent: Agent }) {
  const caps      = (agent.capabilities ?? {}) as unknown as Record<string, boolean>;
  const plan      = agent.plan ?? "free";
  const planLimit = PLANS[plan as keyof typeof PLANS]?.monthly_tokens ?? 50_000;
  const unlimited = isUnlimited(plan);

  // Map capability id → active (true if either alwaysOn or turned on in config)
  const activeCaps = CAPABILITY_COSTS.filter(
    (c) => c.alwaysOn || caps[c.id] === true
  );

  const totalPerMsg = activeCaps.reduce((s, c) => s + c.tokensPerMsg, 0);

  // Estimated conversations per month given the plan limit
  const estimatedConvos = unlimited || totalPerMsg === 0
    ? null
    : Math.floor(planLimit / (totalPerMsg * 8)); // assume ~8 msgs/conversation

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Capacités actives & coût par message
          </p>
        </div>
        {totalPerMsg > 0 && (
          <span
            className="text-2xs font-bold px-2.5 py-1 rounded-full tabular-nums"
            style={{ background: "rgba(212,175,55,0.1)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}
          >
            ~{totalPerMsg.toLocaleString("fr-FR")} tokens / msg
          </span>
        )}
      </div>

      {/* Capability rows */}
      <div className="space-y-2">
        {CAPABILITY_COSTS.map((cap) => {
          const isActive  = cap.alwaysOn || caps[cap.id] === true;
          const inPlan    = cap.plans.includes(plan as any);
          const Icon      = cap.icon;

          return (
            <div
              key={cap.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-opacity"
              style={{
                background:  isActive ? `${cap.color}08` : "var(--bg-muted)",
                border:      `1px solid ${isActive ? `${cap.color}20` : "var(--border-subtle)"}`,
                opacity:     isActive ? 1 : 0.5,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: isActive ? `${cap.color}18` : "var(--bg-card)" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? cap.color : "var(--text-disabled)" }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate" style={{ color: isActive ? "var(--text-primary)" : "var(--text-disabled)" }}>
                    {cap.label}
                  </p>
                  {!inPlan && isActive && (
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                    >
                      Hors plan
                    </span>
                  )}
                  {!inPlan && !isActive && (
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ background: "var(--bg-card)", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}
                    >
                      Plan supérieur
                    </span>
                  )}
                </div>
                <p className="text-2xs mt-0.5 truncate" style={{ color: "var(--text-disabled)" }}>
                  {cap.description}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                {cap.tokensPerMsg === 0 ? (
                  <span className="text-2xs" style={{ color: "var(--text-disabled)" }}>0 token</span>
                ) : (
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: isActive ? cap.color : "var(--text-disabled)" }}
                  >
                    +{cap.tokensPerMsg >= 1_000
                      ? `${(cap.tokensPerMsg / 1_000).toFixed(1)}k`
                      : cap.tokensPerMsg
                    }
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-3"
        style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)" }}
      >
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Coût total estimé par message
          </p>
          <p className="text-2xs mt-0.5" style={{ color: "var(--text-disabled)" }}>
            {activeCaps.length} capacité{activeCaps.length > 1 ? "s" : ""} active{activeCaps.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-gold)" }}>
            ~{totalPerMsg.toLocaleString("fr-FR")}
            <span className="text-xs font-normal ml-1" style={{ color: "var(--text-disabled)" }}>tokens</span>
          </p>
          {estimatedConvos !== null && (
            <p className="text-2xs mt-0.5" style={{ color: "var(--text-disabled)" }}>
              ≈ {estimatedConvos.toLocaleString("fr-FR")} conversations / mois
            </p>
          )}
          {unlimited && (
            <p className="text-2xs mt-0.5" style={{ color: "var(--color-gold)" }}>
              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
              Illimité
            </p>
          )}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2" style={{ color: "var(--text-disabled)" }}>
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <p className="text-2xs leading-relaxed">
          Les tokens consommés incluent le prompt système, le contexte de conversation et la réponse générée.
          L'estimatif suppose ~8 messages échangés par conversation.
          Activez ou désactivez des capacités depuis la <a href={`/dashboard/${agent.id}`} className="underline" style={{ color: "var(--text-tertiary)" }}>page de configuration</a> de votre agent.
        </p>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  success:   { label: "Succès",    color: "#34D399", bg: "rgba(52,211,153,0.1)"  },
  pending:   { label: "En cours",  color: "#FBBF24", bg: "rgba(251,191,36,0.1)"  },
  failed:    { label: "Échoué",    color: "#F87171", bg: "rgba(248,113,113,0.1)" },
  cancelled: { label: "Annulé",    color: "#9CA3AF", bg: "rgba(156,163,175,0.1)" },
};

function formatXAF(n: number) {
  return n.toLocaleString("fr-FR") + " XAF";
}

// ── Usage bar ─────────────────────────────────────────────────────────────────

function UsageBar({ percent, unlimited }: { percent: number; unlimited: boolean }) {
  if (unlimited) return (
    <div className="flex items-center gap-2">
      <Sparkles className="w-3 h-3" style={{ color: "var(--color-gold)" }} />
      <span className="text-xs" style={{ color: "var(--color-gold)" }}>Illimité</span>
    </div>
  );
  const color = percent >= 90 ? "#f87171" : percent >= 70 ? "#fbbf24" : "var(--color-gold)";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-2xs" style={{ color: "var(--text-disabled)" }}>{percent}% utilisé</span>
        {percent >= 80 && (
          <span className="text-2xs font-medium" style={{ color }}>
            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
            {percent >= 90 ? "Limite proche !" : "Attention"}
          </span>
        )}
      </div>
      <div className="w-full rounded-full" style={{ height: 4, background: "var(--border-subtle)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, percent)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 99, background: color }}
        />
      </div>
    </div>
  );
}

// ── Upgrade modal ─────────────────────────────────────────────────────────────

function UpgradeModal({
  agent, planId, onClose, token,
}: {
  agent: Agent; planId: string; onClose: () => void; token: string | null;
}) {
  const [phone, setPhone]     = useState("");
  const [country, setCountry] = useState("CM");
  const [loading, setLoading] = useState(false);

  const price    = getPlanPriceXAF(planId);
  const planInfo = PLANS[planId as keyof typeof PLANS];

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/initiate", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ agentId: agent.id, planId, phone, country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'initiation du paiement");
      // Redirige vers Monetbil
      window.location.href = data.payment_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de paiement");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Passer au plan {planInfo?.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-disabled)" }}>
              Agent : {agent.identity.avatar_emoji} {agent.identity.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-disabled)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount */}
        <div className="rounded-xl p-4 text-center" style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)" }}>
          <p className="text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
            {formatXAF(price)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-disabled)" }}>par mois · paiement Mobile Money</p>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            <Phone className="w-3.5 h-3.5 inline mr-1.5" />
            Numéro Mobile Money (optionnel)
          </label>
          <div className="flex gap-2">
            <select
              value={country} onChange={(e) => setCountry(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs appearance-none"
              style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", minWidth: 72 }}
            >
              <option value="CM">🇨🇲 CM</option>
              <option value="SN">🇸🇳 SN</option>
              <option value="CI">🇨🇮 CI</option>
              <option value="BJ">🇧🇯 BJ</option>
              <option value="BF">🇧🇫 BF</option>
              <option value="ML">🇲🇱 ML</option>
              <option value="GN">🇬🇳 GN</option>
              <option value="TG">🇹🇬 TG</option>
              <option value="NE">🇳🇪 NE</option>
            </select>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="6XXXXXXXX"
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>
          <p className="text-2xs" style={{ color: "var(--text-disabled)" }}>
            Laissez vide pour choisir l'opérateur sur la page de paiement.
          </p>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
          <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
          <p className="text-2xs leading-relaxed" style={{ color: "var(--text-disabled)" }}>
            Paiement sécurisé via <strong style={{ color: "var(--text-tertiary)" }}>Monetbil</strong>.
            MTN, Orange Money, Wave et autres opérateurs acceptés.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handlePay} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            background: loading ? "var(--bg-muted)" : "rgba(212,175,55,0.15)",
            color:      loading ? "var(--text-disabled)" : "var(--color-gold)",
            border: "1px solid rgba(212,175,55,0.3)",
          }}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              Payer {formatXAF(price)} avec Mobile Money
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard({
  planId, agent, currentPlan, onUpgrade,
}: {
  planId: string; agent: Agent | null; currentPlan: string; onUpgrade: (planId: string) => void;
}) {
  const plan      = PLANS[planId as keyof typeof PLANS];
  const isCurrent = currentPlan === planId;
  const isHighlight = PLAN_HIGHLIGHT[planId];
  const features  = PLAN_FEATURES[planId] ?? [];
  const price     = plan.price_xaf;
  const isContact = planId === "enterprise";
  const canUpgrade = UPGRADEABLE_PLANS.includes(planId as any) && !isCurrent && currentPlan !== "enterprise";

  return (
    <div
      className="rounded-xl p-5 space-y-4 flex flex-col relative"
      style={{
        background: isHighlight ? "rgba(212,175,55,0.05)" : "var(--bg-elevated)",
        border: `1px solid ${isCurrent ? "var(--color-gold)" : isHighlight ? "rgba(212,175,55,0.2)" : "var(--border-subtle)"}`,
      }}
    >
      {isHighlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-2xs font-bold"
          style={{ background: "var(--color-gold)", color: "#0a0a0a" }}>
          Populaire
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-2xs font-bold"
          style={{ background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>
          Plan actuel
        </div>
      )}

      <div>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{plan.label}</p>
        {isContact ? (
          <p className="text-lg font-bold mt-1" style={{ color: "var(--color-gold)" }}>Sur devis</p>
        ) : price === 0 ? (
          <p className="text-lg font-bold mt-1" style={{ color: "var(--text-secondary)" }}>Gratuit</p>
        ) : (
          <p className="text-lg font-bold mt-1" style={{ color: "var(--color-gold)" }}>
            {formatXAF(price)}<span className="text-xs font-normal ml-1" style={{ color: "var(--text-disabled)" }}>/mois</span>
          </p>
        )}
        <p className="text-2xs mt-1" style={{ color: "var(--text-disabled)" }}>
          {isUnlimited(planId) ? "Tokens illimités" : `${plan.monthly_tokens.toLocaleString("fr-FR")} tokens / mois`}
        </p>
      </div>

      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="w-3 h-3 flex-shrink-0" style={{ color: "#34D399" }} />
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{f}</span>
          </li>
        ))}
      </ul>

      {isContact ? (
        <a href="mailto:hello@buyticle.com?subject=Camille Enterprise"
          className="block text-center py-2.5 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
          Nous contacter
        </a>
      ) : isCurrent ? (
        <div className="py-2.5 rounded-lg text-xs font-semibold text-center"
          style={{ background: "rgba(52,211,153,0.08)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>
          <Check className="w-3 h-3 inline mr-1.5" />
          Actif
        </div>
      ) : canUpgrade && agent ? (
        <button onClick={() => onUpgrade(planId)}
          className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:brightness-110"
          style={{
            background: isHighlight ? "rgba(212,175,55,0.15)" : "var(--bg-muted)",
            color:      isHighlight ? "var(--color-gold)" : "var(--text-secondary)",
            border: `1px solid ${isHighlight ? "rgba(212,175,55,0.3)" : "var(--border-subtle)"}`,
          }}>
          Passer à {plan.label}
          <ChevronRight className="w-3 h-3 inline ml-1" />
        </button>
      ) : (
        <div className="py-2.5 rounded-lg text-xs text-center"
          style={{ color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
          {planId === "free" ? "Plan de base" : "Non disponible"}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function BillingContent() {
  const router                  = useRouter();
  const searchParams            = useSearchParams();
  const { isLoggedIn }          = useAuth();
  const { agents, loading: agentsLoading } = useAgents();
  const token = typeof window !== "undefined" ? localStorage.getItem("camille_token") : null;

  const [usageMap,  setUsageMap]  = useState<Record<string, AgentUsage>>({});
  const [payments,  setPayments]  = useState<Payment[]>([]);
  const [modal,     setModal]     = useState<{ agent: Agent; planId: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [payResult, setPayResult] = useState<"success" | "cancel" | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => { if (!isLoggedIn) router.replace("/login"); }, [isLoggedIn, router]);

  // Récupère l'usage pour chaque agent
  const fetchUsage = useCallback(async () => {
    if (!agents.length || !token) return;
    const results = await Promise.allSettled(
      agents.map((a) =>
        fetch(`/api/usage?agentId=${a.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => d ? [a.id, d] : null)
      )
    );
    const map: Record<string, AgentUsage> = {};
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value) {
        const [id, data] = r.value as [string, AgentUsage];
        map[id] = data;
      }
    });
    setUsageMap(map);
  }, [agents, token]);

  // Historique paiements
  const fetchHistory = useCallback(async () => {
    if (!token) return;
    const res = await fetch("/api/payments/history?limit=20", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      setPayments(d.payments ?? []);
    }
  }, [token]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Gestion retour Monetbil
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const ref           = searchParams.get("ref");
    if (!paymentStatus || !ref) return;

    if (paymentStatus === "return" && ref) {
      setVerifying(true);
      const poll = async (attempts = 0) => {
        try {
          const res  = await fetch(`/api/payments/verify?ref=${ref}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json();

          if (data.status === "success") {
            setPayResult("success");
            toast.success(`🎉 Plan ${getPlanLabel(data.plan_id)} activé !`);
            fetchUsage();
            fetchHistory();
            setVerifying(false);
          } else if (data.status === "failed") {
            setPayResult("cancel");
            toast.error("Paiement échoué. Veuillez réessayer.");
            setVerifying(false);
          } else if (attempts < 8) {
            // Encore pending → réessayer dans 3s (le webhook IPN peut arriver en retard)
            setTimeout(() => poll(attempts + 1), 3000);
          } else {
            toast("Paiement en cours de vérification. Actualisez dans quelques instants.");
            setVerifying(false);
          }
        } catch { setVerifying(false); }
      };
      poll();
    } else if (paymentStatus === "cancel") {
      setPayResult("cancel");
      toast("Paiement annulé.");
    }
    // Nettoyer l'URL
    router.replace("/dashboard/billing", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Agent sélectionné pour les plans (le premier actif par défaut)
  const activeAgent = selectedAgent
    ? agents.find((a) => a.id === selectedAgent) ?? agents[0]
    : agents[0] ?? null;

  const currentPlan = activeAgent?.plan ?? "free";
  const usage       = activeAgent ? usageMap[activeAgent.id] : null;

  // Alertes agents en limite
  const agentsNearLimit = agents.filter((a) => {
    const u = usageMap[a.id];
    return u && !u.plan.unlimited && u.current.percent >= 80;
  });

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-disabled)" }} />
      </div>
    );
  }

  return (
    <>
      {/* Upgrade modal */}
      <AnimatePresence>
        {modal && (
          <UpgradeModal
            agent={modal.agent} planId={modal.planId} token={token}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 sm:px-7 py-6 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Plans & Facturation</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-disabled)" }}>
            Gérez vos abonnements et suivez votre consommation de tokens.
          </p>
        </div>

        {/* Vérification paiement en cours */}
        <AnimatePresence>
          {verifying && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
            >
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "#fbbf24" }} />
              <p className="text-sm" style={{ color: "#fbbf24" }}>Vérification du paiement en cours…</p>
            </motion.div>
          )}
          {payResult === "success" && !verifying && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
            >
              <Check className="w-4 h-4" style={{ color: "#34D399" }} />
              <p className="text-sm font-medium" style={{ color: "#34D399" }}>Paiement confirmé — votre plan est activé !</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alertes limite tokens */}
        {agentsNearLimit.length > 0 && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" style={{ color: "#f87171" }} />
              <p className="text-sm font-semibold" style={{ color: "#f87171" }}>
                {agentsNearLimit.length} agent{agentsNearLimit.length > 1 ? "s" : ""} proche{agentsNearLimit.length > 1 ? "s" : ""} de la limite
              </p>
            </div>
            {agentsNearLimit.map((a) => {
              const u = usageMap[a.id]!;
              return (
                <div key={a.id} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {a.identity.avatar_emoji} {a.identity.name} — {u.current.percent}% utilisé
                  </span>
                  <button
                    onClick={() => { setSelectedAgent(a.id); setModal({ agent: a, planId: "pro" }); }}
                    className="text-2xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(212,175,55,0.1)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}
                  >
                    Upgrader
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Agent selector (si plusieurs agents) */}
        {agents.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-disabled)" }}>Agent à gérer</p>
            <div className="flex gap-2 flex-wrap">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(a.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-150"
                  style={{
                    background: (selectedAgent ?? agents[0]?.id) === a.id ? "rgba(212,175,55,0.1)" : "var(--bg-muted)",
                    border: `1px solid ${(selectedAgent ?? agents[0]?.id) === a.id ? "rgba(212,175,55,0.3)" : "var(--border-subtle)"}`,
                    color: (selectedAgent ?? agents[0]?.id) === a.id ? "var(--color-gold)" : "var(--text-tertiary)",
                  }}
                >
                  <span>{a.identity.avatar_emoji}</span>
                  <span className="font-medium">{a.identity.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-2xs" style={{ background: "var(--bg-card)", color: "var(--text-disabled)" }}>
                    {getPlanLabel(a.plan)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Usage courant */}
        {usage && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--text-disabled)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Consommation · {usage.current.period}
                </p>
              </div>
              <span className="text-2xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(212,175,55,0.1)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}>
                {usage.plan.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total tokens", value: usage.current.total_tokens.toLocaleString("fr-FR") },
                { label: "Restant", value: usage.plan.unlimited ? "∞" : usage.current.remaining.toLocaleString("fr-FR") },
                { label: "Limite mensuelle", value: usage.plan.unlimited ? "Illimitée" : usage.plan.limit.toLocaleString("fr-FR") },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-2xs mb-0.5" style={{ color: "var(--text-disabled)" }}>{label}</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>

            <UsageBar percent={usage.current.percent} unlimited={usage.plan.unlimited} />
          </div>
        )}

        {/* Capability cost breakdown */}
        {activeAgent && (
          <CapabilityCostBreakdown agent={activeAgent} />
        )}

        {/* Plan cards */}
        <div className="space-y-3">
          <p className="text-xs font-medium" style={{ color: "var(--text-disabled)" }}>
            Choisissez le plan adapté à votre usage
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
            {PLAN_ORDER.map((planId) => (
              <PlanCard
                key={planId}
                planId={planId}
                agent={activeAgent}
                currentPlan={currentPlan}
                onUpgrade={(pid) => activeAgent && setModal({ agent: activeAgent, planId: pid })}
              />
            ))}
          </div>
        </div>

        {/* Historique paiements */}
        <div className="space-y-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Historique des paiements</p>
          {payments.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
              <CreditCard className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-disabled)", opacity: 0.4 }} />
              <p className="text-xs" style={{ color: "var(--text-disabled)" }}>Aucun paiement enregistré</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
              {payments.map((p, i) => {
                const s   = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending;
                const agent = agents.find((a) => a.id === p.agent_id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 px-4 py-3"
                    style={{
                      background: i % 2 === 0 ? "var(--bg-elevated)" : "var(--bg-muted)",
                      borderBottom: i < payments.length - 1 ? "1px solid var(--border-subtle)" : undefined,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        Plan {getPlanLabel(p.plan_id)}{agent ? ` · ${agent.identity.name}` : ""}
                      </p>
                      <p className="text-2xs mt-0.5" style={{ color: "var(--text-disabled)" }}>
                        {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        {p.transaction_id && ` · ${p.transaction_id}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                        {formatXAF(p.amount)}
                      </p>
                      <span
                        className="text-2xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Note sécurité */}
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>Paiements sécurisés par Monetbil</p>
            <p className="text-2xs mt-1 leading-relaxed" style={{ color: "var(--text-disabled)" }}>
              Tous les paiements sont traités par Monetbil, leader des paiements Mobile Money en Afrique.
              MTN Mobile Money, Orange Money, Wave, Airtel Money et d'autres opérateurs sont acceptés.
              Vos données bancaires ne transitent jamais par nos serveurs.
            </p>
          </div>
        </div>

      </div>
    </>
  );
}

// useSearchParams() doit être dans un Suspense boundary (Next.js 15 requirement)
export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--color-gold)" }} />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
