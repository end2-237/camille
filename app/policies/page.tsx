// ─────────────────────────────────────────────────────────────────────────────
// app/policies/page.tsx — Politiques & Conditions — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Shield, Lock, FileText, Eye } from "lucide-react";
import { COMPANY } from "@/lib/company";

const SECTIONS = [
  {
    id: "terms",
    icon: FileText,
    title: "Conditions d'utilisation",
    items: [
      {
        q: "Acceptation des conditions",
        a: "En utilisant Camille, vous acceptez les présentes conditions d'utilisation dans leur intégralité. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le service.",
      },
      {
        q: "Description du service",
        a: `Camille est une plateforme No-Code permettant de créer et déployer des agents IA conversationnels. Le service est fourni en mode SaaS (Software as a Service) par ${COMPANY.name} (${COMPANY.legalForm}), basé à ${COMPANY.address}.`,
      },
      {
        q: "Utilisation acceptable",
        a: "Vous vous engagez à utiliser le service à des fins légales uniquement, à ne pas tenter de compromettre la sécurité du service, et à respecter les droits des tiers.",
      },
      {
        q: "Propriété intellectuelle",
        a: `Le code, les designs et la marque Camille sont la propriété exclusive de ${COMPANY.name}. Les prompts et configurations générés par vous vous appartiennent.`,
      },
      {
        q: "Résiliation",
        a: `Vous pouvez résilier votre abonnement à tout moment depuis le dashboard. ${COMPANY.name} se réserve le droit de suspendre un compte en cas de violation des conditions.`,
      },
    ],
  },
  {
    id: "privacy",
    icon: Eye,
    title: "Politique de confidentialité",
    items: [
      {
        q: "Données collectées",
        a: "Nous collectons les informations que vous nous fournissez lors de la création de votre compte (email, nom), ainsi que les données de configuration de vos agents et les métriques d'usage anonymisées.",
      },
      {
        q: "Utilisation des données",
        a: "Vos données sont utilisées pour fournir et améliorer le service, vous envoyer des communications essentielles, et générer des statistiques agrégées anonymes.",
      },
      {
        q: "Partage des données",
        a: "Nous ne vendons jamais vos données. Nous partageons uniquement les données nécessaires avec nos sous-traitants (OpenAI, Anthropic pour les modèles IA, Supabase pour le stockage) sous contrat de confidentialité.",
      },
      {
        q: "Durée de conservation",
        a: "Vos données sont conservées pendant la durée de votre abonnement et jusqu'à 90 jours après résiliation, sauf obligation légale contraire.",
      },
    ],
  },
  {
    id: "security",
    icon: Lock,
    title: "Sécurité des données",
    items: [
      {
        q: "Chiffrement",
        a: "Toutes les données sont chiffrées en transit (TLS 1.3) et au repos (AES-256). Les clés API sont stockées de manière sécurisée et jamais exposées en clair.",
      },
      {
        q: "Accès aux données",
        a: "L'accès aux données de production est limité aux ingénieurs autorisés, soumis à une authentification forte (2FA) et journalisé intégralement.",
      },
      {
        q: "Signalement de vulnérabilités",
        a: `Si vous découvrez une faille de sécurité, merci de nous contacter à ${COMPANY.emailSecurity}. Nous nous engageons à traiter les signalements dans les 72 heures.`,
      },
    ],
  },
  {
    id: "rgpd",
    icon: Shield,
    title: "RGPD & Droits",
    items: [
      {
        q: "Vos droits",
        a: "Conformément au RGPD, vous disposez des droits d'accès, de rectification, d'effacement, de portabilité, d'opposition et de limitation du traitement de vos données.",
      },
      {
        q: "Exercer vos droits",
        a: `Pour exercer vos droits, contactez-nous à l'adresse ${COMPANY.emailPrivacy}. Nous traiterons votre demande dans un délai maximum de 30 jours.`,
      },
      {
        q: "Cookies",
        a: "Nous utilisons uniquement les cookies strictement nécessaires au fonctionnement du service. Aucun cookie publicitaire ou de tracking tiers n'est déposé.",
      },
      {
        q: "Réclamation",
        a: "Vous avez le droit de déposer une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) si vous estimez que vos droits ne sont pas respectés.",
      },
    ],
  },
];

function AccordionItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PoliciesPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(212,175,55,0.07) 0%, transparent 60%)" }} />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-gold)" }}
          >
            Légal
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-4xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Politiques & <span className="text-gold-gradient">Conditions</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm" style={{ color: "var(--text-tertiary)" }}
          >
            Dernière mise à jour : mai 2026
          </motion.p>
        </div>
      </section>

      {/* Sections */}
      <div className="max-w-2xl mx-auto px-6 pb-24 space-y-16">
        {SECTIONS.map((section, si) => {
          const Icon = section.icon;
          return (
            <section key={section.id} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 40 }}>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-3 mb-6"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)" }}>
                  <Icon className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
                </div>
                <h2 className="font-good-timing text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {section.title}
                </h2>
              </motion.div>
              <div>
                {section.items.map((item, i) => (
                  <AccordionItem key={item.q} q={item.q} a={item.a} index={i} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl px-6 py-5"
          style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.15)" }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Des questions ?</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Contactez notre équipe juridique à{" "}
            <a href={`mailto:${COMPANY.emailLegal}`} className="transition-colors" style={{ color: "var(--color-gold)" }}>
              {COMPANY.emailLegal}
            </a>
            . Nous répondons dans les 5 jours ouvrés.
          </p>
        </motion.div>
      </div>
    </main>
  );
}
