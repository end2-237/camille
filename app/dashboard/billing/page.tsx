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
  Target, Send, Users, Image, Info, Calendar,
} from "lucide-react";
import { toast }       from "sonner";
import { useAuth }     from "@/hooks/useAuth";
import { useAgents }   from "@/hooks/useAgents";
import { cn }          from "@/lib/utils";
import type { Agent }  from "@/types/agent";
import type { DbPlan, DbCapability } from "@/lib/plans-db";

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

// ── Icon map capacités (icon name en DB → composant lucide) ──────────────────

const CAP_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  MessageCircle, Clock, History, UserPlus, FileText,
  Target, Send, Users, Image, Zap, Calendar,
};
function CapIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = CAP_ICON_MAP[name] ?? Zap;
  return <Icon className={className} style={style} />;
}

// ── Capability cost breakdown (DB-driven) ────────────────────────────────────

function CapabilityCostBreakdown({ agent, capabilities }: { agent: Agent; capabilities: DbCapability[] }) {
  const caps      = (agent.capabilities ?? {}) as unknown as Record<string, boolean>;
  const planId    = agent.plan ?? "free";

  // support_whatsapp toujours actif (capacité de base)
  const activeCaps = capabilities.filter(
    (c) => c.id === "support_whatsapp" || caps[c.id] === true
  );
  const totalPerMsg = activeCaps.reduce((s, c) => s + c.tokens_per_msg, 0);

  // Si capabilities pas encore chargées
  if (capabilities.length === 0) return null;

  return (
    <div className="rounded-xl p-5 space-y-4"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Capacités actives & coût par message
          </p>
        </div>
        {totalPerMsg > 0 && (
          <span className="text-2xs font-bold px-2.5 py-1 rounded-full tabular-nums"
            style={{ background: "rgba(212,175,55,0.1)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}>
            ~{totalPerMsg.toLocaleString("fr-FR")} tokens / msg
          </span>
        )}
      </div>

      <div className="space-y-2">
        {capabilities.map((cap) => {
          const isActive = cap.id === "support_whatsapp" || caps[cap.id] === true;
          const inPlan   = cap.plans.includes(planId);
          return (
            <div key={cap.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: isActive ? `${cap.color}08` : "var(--bg-muted)",
                border:     `1px solid ${isActive ? `${cap.color}20` : "var(--border-subtle)"}`,
                opacity:    isActive ? 1 : 0.5,
              }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: isActive ? `${cap.color}18` : "var(--bg-card)" }}>
                <CapIcon name={cap.icon} className="w-3.5 h-3.5"
                  style={{ color: isActive ? cap.color : "var(--text-disabled)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate"
                    style={{ color: isActive ? "var(--text-primary)" : "var(--text-disabled)" }}>
                    {cap.label}
                  </p>
                  {!inPlan && isActive && (
                    <span className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                      Hors plan
                    </span>
                  )}
                  {!inPlan && !isActive && (
                    <span className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ background: "var(--bg-card)", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
                      Plan supérieur
                    </span>
                  )}
                </div>
                <p className="text-2xs mt-0.5 truncate" style={{ color: "var(--text-disabled)" }}>
                  {cap.description}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                {cap.tokens_per_msg === 0 ? (
                  <span className="text-2xs" style={{ color: "var(--text-disabled)" }}>0 token</span>
                ) : (
                  <span className="text-xs font-bold tabular-nums"
                    style={{ color: isActive ? cap.color : "var(--text-disabled)" }}>
                    +{cap.tokens_per_msg >= 1_000
                      ? `${(cap.tokens_per_msg / 1_000).toFixed(1)}k`
                      : cap.tokens_per_msg}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg px-3 py-3"
        style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)" }}>
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Coût total estimé par message</p>
          <p className="text-2xs mt-0.5" style={{ color: "var(--text-disabled)" }}>
            {activeCaps.length} capacité{activeCaps.length > 1 ? "s" : ""} active{activeCaps.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-gold)" }}>
            ~{totalPerMsg.toLocaleString("fr-FR")}
            <span className="text-xs font-normal ml-1" style={{ color: "var(--text-disabled)" }}>tokens</span>
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2" style={{ color: "var(--text-disabled)" }}>
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <p className="text-2xs leading-relaxed">
          L'estimatif suppose ~8 messages échangés par conversation.
          Activez ou désactivez des capacités depuis la{" "}
          <a href={`/dashboard/${agent.id}`} className="underline" style={{ color: "var(--text-tertiary)" }}>
            page de configuration
          </a>{" "}de votre agent.
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
  agent, planRow, onClose, token,
}: {
  agent: Agent; planRow: DbPlan; onClose: () => void; token: string | null;
}) {
  const [phone, setPhone]     = useState("");
  const [country, setCountry] = useState("CM");
  const [loading, setLoading] = useState(false);

  const price   = planRow.price_xaf;
  const planId  = planRow.id;

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
              Passer au plan {planRow.label}
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

// ── Plan card (DB-driven) ─────────────────────────────────────────────────────

function PlanCard({
  plan, agent, currentPlan, onUpgrade,
}: {
  plan: DbPlan; agent: Agent | null; currentPlan: string; onUpgrade: (plan: DbPlan) => void;
}) {
  const isCurrent    = currentPlan === plan.id;
  const isContact    = plan.price_xaf === -1;
  const unlimited    = plan.monthly_tokens === -1;
  const canUpgrade   = plan.is_purchasable && !isCurrent;

  return (
    <div
      className="rounded-xl p-5 space-y-4 flex flex-col relative"
      style={{
        background: plan.highlight ? "rgba(212,175,55,0.05)" : "var(--bg-elevated)",
        border: `1px solid ${isCurrent ? "var(--color-gold)" : plan.highlight ? "rgba(212,175,55,0.2)" : "var(--border-subtle)"}`,
      }}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-2xs font-bold"
          style={{ background: "var(--color-gold)", color: "#0a0a0a" }}>
          {plan.badge}
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
        ) : plan.price_xaf === 0 ? (
          <p className="text-lg font-bold mt-1" style={{ color: "var(--text-secondary)" }}>Gratuit</p>
        ) : (
          <p className="text-lg font-bold mt-1" style={{ color: "var(--color-gold)" }}>
            {formatXAF(plan.price_xaf)}
            <span className="text-xs font-normal ml-1" style={{ color: "var(--text-disabled)" }}>/mois</span>
          </p>
        )}
        <p className="text-2xs mt-1" style={{ color: "var(--text-disabled)" }}>
          {unlimited ? "Tokens illimités" : `${plan.monthly_tokens.toLocaleString("fr-FR")} tokens / mois`}
        </p>
      </div>

      <ul className="space-y-2 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            {f.included
              ? <Check className="w-3 h-3 flex-shrink-0" style={{ color: "#34D399" }} />
              : <X className="w-3 h-3 flex-shrink-0 opacity-20" style={{ color: "var(--text-disabled)" }} />}
            <span className="text-xs" style={{ color: f.included ? "var(--text-tertiary)" : "var(--text-disabled)", opacity: f.included ? 1 : 0.5 }}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {isContact ? (
        <a href={plan.cta_href}
          className="block text-center py-2.5 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
          {plan.cta_label}
        </a>
      ) : isCurrent ? (
        <div className="py-2.5 rounded-lg text-xs font-semibold text-center"
          style={{ background: "rgba(52,211,153,0.08)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>
          <Check className="w-3 h-3 inline mr-1.5" />
          Actif
        </div>
      ) : canUpgrade && agent ? (
        <button onClick={() => onUpgrade(plan)}
          className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:brightness-110"
          style={{
            background: plan.highlight ? "rgba(212,175,55,0.15)" : "var(--bg-muted)",
            color:      plan.highlight ? "var(--color-gold)" : "var(--text-secondary)",
            border: `1px solid ${plan.highlight ? "rgba(212,175,55,0.3)" : "var(--border-subtle)"}`,
          }}>
          {plan.cta_label}
          <ChevronRight className="w-3 h-3 inline ml-1" />
        </button>
      ) : (
        <div className="py-2.5 rounded-lg text-xs text-center"
          style={{ color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
          {plan.id === "free" ? "Plan de base" : "Non disponible"}
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

  const [usageMap,   setUsageMap]   = useState<Record<string, AgentUsage>>({});
  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [modal,      setModal]      = useState<{ agent: Agent; planRow: DbPlan } | null>(null);
  const [verifying,  setVerifying]  = useState(false);
  const [payResult,  setPayResult]  = useState<"success" | "cancel" | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // ── Plans & capabilities depuis la DB ──────────────────────────────────────
  const [plansData, setPlansData] = useState<{ plans: DbPlan[]; capabilities: DbCapability[] }>({
    plans: [], capabilities: [],
  });
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPlansData({ plans: d.plans ?? [], capabilities: d.capabilities ?? [] }); })
      .finally(() => setPlansLoading(false));
  }, []);

  // Helper : label d'un plan depuis la liste DB
  const getPlanLabel = (planId: string) =>
    plansData.plans.find((p) => p.id === planId)?.label ?? planId;

  useEffect(() => { if (!isLoggedIn) router.replace("/login"); }, [isLoggedIn, router]);

  // ── Usage par agent ────────────────────────────────────────────────────────
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

  // ── Historique paiements ───────────────────────────────────────────────────
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

  // ── Gestion retour Monetbil ────────────────────────────────────────────────
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
            // plan label depuis plansData si déjà chargé, sinon fallback sur plan_id
            const label = plansData.plans.find((p) => p.id === data.plan_id)?.label ?? data.plan_id;
            toast.success(`🎉 Plan ${label} activé !`);
            fetchUsage();
            fetchHistory();
            setVerifying(false);
          } else if (data.status === "failed") {
            setPayResult("cancel");
            toast.error("Paiement échoué. Veuillez réessayer.");
            setVerifying(false);
          } else if (attempts < 8) {
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
    router.replace("/dashboard/billing", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Agent actif ────────────────────────────────────────────────────────────
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

  // Plan "pro" pour le bouton "Upgrader" rapide
  const proPlan = plansData.plans.find((p) => p.id === "pro") ?? plansData.plans[plansData.plans.length - 2] ?? null;

  if (agentsLoading || plansLoading) {
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
            agent={modal.agent}
            planRow={modal.planRow}
            token={token}
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
                  {proPlan && (
                    <button
                      onClick={() => { setSelectedAgent(a.id); setModal({ agent: a, planRow: proPlan }); }}
                      className="text-2xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(212,175,55,0.1)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}
                    >
                      Upgrader
                    </button>
                  )}
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
                    {getPlanLabel(a.plan ?? "free")}
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
        {activeAgent && plansData.capabilities.length > 0 && (
          <CapabilityCostBreakdown agent={activeAgent} capabilities={plansData.capabilities} />
        )}

        {/* Plan cards */}
        {plansData.plans.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium" style={{ color: "var(--text-disabled)" }}>
              Choisissez le plan adapté à votre usage
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
              {plansData.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  agent={activeAgent}
                  currentPlan={currentPlan}
                  onUpgrade={(p) => activeAgent && setModal({ agent: activeAgent, planRow: p })}
                />
              ))}
            </div>
          </div>
        )}

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
                const s     = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending;
                const agent = agents.find((a) => a.id === p.agent_id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 px-4 py-3"
                    style={{
                      background:   i % 2 === 0 ? "var(--bg-elevated)" : "var(--bg-muted)",
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
