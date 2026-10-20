// ─────────────────────────────────────────────────────────────────────────────
// app/pricing/page.tsx — Camille by Buyticle
// Plans chargés depuis /api/plans (base de données) — zéro valeur hardcodée.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import Link                             from "next/link";
import {
  Check, Minus, Sparkles, Zap, MessageCircle, Brain,
  BarChart3, Users, Target, Megaphone, Image, ChevronDown,
  ChevronUp, Info, RefreshCw,
} from "lucide-react";
import type { DbPlan, DbCapability } from "@/lib/plans-db";
import { libelleConversations, PRIX_OPTION_SITE_XAF } from "@/lib/plans";

// ── Icon map (icon field stocké en DB → composant lucide) ─────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  MessageCircle, Brain, Zap, Target, Sparkles,
  BarChart3, Megaphone, Users, Image,
};

function CapIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] ?? Zap;
  return <Icon className={className} style={style} />;
}

// ── FAQ — le prix de l'option Site vient de la base, le reste est fixe ───────

const faq = (optionSite: string) => [
  {
    q: "Qu'est-ce qu'une conversation ?",
    a: "Un client qui écrit à votre boutique et que Camille sert : questions, photos des produits, panier, commande. Les nombres indiqués sont des moyennes : un échange très long compte un peu plus, une simple question un peu moins.",
  },
  {
    q: "Que se passe-t-il si j'atteins ma limite du mois ?",
    a: "Vous êtes prévenu dans le tableau de bord dès 80 %. À 100 %, Camille cesse de répondre seule jusqu'au mois suivant : vous gardez la main dans la boîte de réception. Vous pouvez changer de forfait à tout moment pour rétablir le service.",
  },
  {
    q: "Je garde mon application WhatsApp Business ?",
    a: "Oui. Vous connectez le numéro que vous utilisez déjà, en scannant un QR code. Vous continuez à répondre depuis votre téléphone quand vous le voulez ; Camille se met en retrait dès que vous écrivez à un client.",
  },
  {
    q: "Comment payer ?",
    a: "Par MTN Mobile Money ou Orange Money. Pas de carte bancaire, pas d'engagement : l'abonnement se paie au mois.",
  },
  {
    q: "Qu'est-ce que l'option « Site » ?",
    a: `Un site à votre image, unique, branché sur votre catalogue : prix, stock et horaires se mettent à jour tout seuls, et les commandes arrivent dans le même tableau de bord. ${optionSite} de plus par mois, en plus de votre forfait.`,
  },
  {
    q: "Puis-je changer de forfait à tout moment ?",
    a: "Oui. Le changement est immédiat dès confirmation du paiement, et les conversations du nouveau forfait sont disponibles tout de suite.",
  },
];

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, index, allPlanIds }: {
  plan:       DbPlan;
  index:      number;
  allPlanIds: string[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spot", "1");
  }
  function onMouseLeave() { cardRef.current?.style.setProperty("--spot", "0"); }

  const isFree       = plan.price_xaf === 0;
  const isEnterprise = plan.price_xaf === -1;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative flex flex-col rounded-2xl overflow-hidden"
      style={{
        ["--mx" as string]: "50%",
        ["--my" as string]: "50%",
        ["--spot" as string]: "0",
        background: plan.highlight ? "rgba(124,90,248,0.04)" : "var(--bg-elevated)",
        border: `1px solid ${plan.highlight ? "rgba(124,90,248,0.32)" : "var(--border-subtle)"}`,
        boxShadow: plan.highlight
          ? "0 0 0 1px rgba(124,90,248,0.16), 0 24px 60px rgba(124,90,248,0.08)"
          : "0 4px 24px rgba(0,0,0,0.18)",
      }}
    >
      {/* Spotlight */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{ background: "radial-gradient(circle 260px at var(--mx) var(--my), rgba(124,90,248,0.07) 0%, transparent 70%)", opacity: "var(--spot)" }} />

      {plan.badge && (
        <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(124,90,248,0.15)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.28)" }}>
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-disabled)" }}>
          {plan.label}
        </p>
        {isFree ? (
          <p className="font-good-timing text-3xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>Gratuit</p>
        ) : isEnterprise ? (
          <p className="font-good-timing text-2xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>Sur devis</p>
        ) : (
          <div>
            <span className="font-good-timing text-2xl font-bold leading-none"
              style={{ color: plan.highlight ? "var(--color-gold)" : "var(--text-primary)" }}>
              {plan.price_xaf.toLocaleString("fr-FR")}
            </span>
            <span className="text-[10px] ml-1.5 uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>XAF / mois</span>
          </div>
        )}
        <p className="text-xs leading-relaxed mt-2.5" style={{ color: "var(--text-tertiary)" }}>{plan.description}</p>

        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(124,90,248,0.06)", border: "1px solid rgba(124,90,248,0.12)", color: "var(--color-gold)" }}>
          <Zap className="w-2.5 h-2.5" />
          {plan.monthly_tokens === -1 ? "Conversations illimitées" : `${libelleConversations(plan.monthly_tokens)} / mois`}
        </div>
      </div>

      {/* Features */}
      <ul className="flex-1 px-6 py-5 space-y-2.5">
        {plan.features.map((f, fi) => (
          <li key={fi} className="flex items-center gap-2.5">
            {f.included
              ? <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
              : <Minus className="w-3.5 h-3.5 flex-shrink-0 opacity-20" style={{ color: "var(--text-disabled)" }} />}
            <span className="text-xs" style={{ color: f.included ? "var(--text-secondary)" : "var(--text-disabled)", opacity: f.included ? 1 : 0.45 }}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="px-6 pb-6">
        <Link href={plan.cta_href}
          className="block w-full text-center py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          style={
            plan.highlight
              ? { background: "linear-gradient(135deg,#7C5AF8 0%,#A78BFA 50%,#6442E8 100%)", color: "#000", boxShadow: "0 2px 16px rgba(124,90,248,0.22)" }
              : { background: "var(--surface-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }
          }>
          {plan.cta_label}
        </Link>
      </div>
    </motion.div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="py-4 cursor-pointer"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{q}</p>
        {open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25 }}
            className="text-xs leading-relaxed overflow-hidden"
            style={{ color: "var(--text-tertiary)" }}
          >
            {a}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className ?? ""}`}
      style={{ background: "var(--bg-elevated)", ...style }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [plans,        setPlans]        = useState<DbPlan[]>([]);
  const [capabilities, setCapabilities] = useState<DbCapability[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [optionSite,   setOptionSite]   = useState(PRIX_OPTION_SITE_XAF);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(({ plans: p, capabilities: c, option_site_xaf: o }: { plans: DbPlan[]; capabilities: DbCapability[]; option_site_xaf?: number }) => {
        setPlans(p);
        setCapabilities(c);
        if (Number.isFinite(Number(o))) setOptionSite(Number(o));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger les plans. Actualisez la page.");
        setLoading(false);
      });
  }, []);

  const planIds = plans.map((p) => p.id);
  // Un forfait peut avoir son propre supplément Site : on annonce le moins cher.
  const prixSite = [optionSite, ...plans.filter((p) => p.is_purchasable && p.site_addon_xaf != null).map((p) => p.site_addon_xaf as number)];
  const siteMin = Math.min(...prixSite);
  const siteVarie = new Set(prixSite).size > 1;
  const siteTexte = `${siteVarie ? "à partir de " : ""}${siteMin.toLocaleString("fr-FR")} FCFA`;

  return (
    <main className="relative overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(124,90,248,0.09) 0%, transparent 60%)", zIndex: 0 }} />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--color-gold)" }}>
            Tarifs
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            Simple,{" "}
            <span className="text-gold-gradient">transparent</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
            className="text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Un prix par mois, compté en clients servis.{" "}
            Paiement Mobile Money (MTN, Orange), sans engagement.
          </motion.p>
        </div>
      </section>

      {/* ── Plans ───────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 420 }} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
              <button onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "rgba(124,90,248,0.1)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.2)" }}>
                <RefreshCw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {plans.map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} index={i} allPlanIds={planIds} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Option Site ─────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl p-6"
            style={{ background: "rgba(124,90,248,0.04)", border: "1px solid rgba(124,90,248,0.16)" }}>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: "var(--color-gold)" }}>
                Option · bientôt
              </p>
              <h2 className="font-good-timing text-xl font-bold mb-1.5" style={{ color: "var(--text-primary)" }}>
                Votre site, unique, relié à Camille
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                Un site à votre image, léger sur mobile. Catalogue, prix, stock et horaires se mettent à jour tout seuls ;
                les commandes arrivent dans le même tableau de bord que WhatsApp.
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums whitespace-nowrap" style={{ color: "var(--color-gold)" }}>
              {siteVarie ? <span className="text-xs font-normal mr-1" style={{ color: "var(--text-disabled)" }}>dès</span> : null}
              +{siteMin.toLocaleString("fr-FR")}
              <span className="text-xs font-normal ml-1" style={{ color: "var(--text-disabled)" }}>FCFA / mois</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto pt-16">
          <motion.h2 initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-good-timing text-2xl font-bold text-center mb-8" style={{ color: "var(--text-primary)" }}>
            Questions fréquentes
          </motion.h2>
          {faq(siteTexte).map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} index={i} />
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <section className="relative px-6 pb-28 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55 }}
          className="max-w-lg mx-auto space-y-6">
          <h2 className="font-good-timing text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Prêt à démarrer ?
          </h2>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Créez votre premier agent gratuitement, sans carte bancaire requise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/configure"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#7C5AF8 0%,#A78BFA 50%,#6442E8 100%)", color: "#000", boxShadow: "0 4px 24px rgba(124,90,248,0.22)" }}>
              <Sparkles className="w-3.5 h-3.5" />
              Créer mon agent
            </Link>
            <Link href="/dashboard/billing"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: "var(--surface-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
              Voir les plans
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
