// ─────────────────────────────────────────────────────────────────────────────
// app/company/page.tsx — Informations sur Buyticle / Camille
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { motion } from "framer-motion";
import { Building2, MapPin, Mail, Globe, Users, Calendar, Shield, Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";

const INFOS = [
  { icon: Building2, label: "Raison sociale",   value: COMPANY.name },
  { icon: Shield,    label: "Forme juridique",  value: COMPANY.legalForm },
  { icon: MapPin,    label: "Siège social",      value: COMPANY.address },
  { icon: Mail,      label: "Contact général",   value: COMPANY.emailPrimary },
  { icon: Mail,      label: "Email secondaire",  value: COMPANY.emailSecondary },
  { icon: Phone,     label: "Téléphone",         value: COMPANY.phone },
  { icon: Globe,     label: "Site web",          value: COMPANY.website },
  { icon: Users,     label: "Équipe",            value: "Startup early-stage" },
  { icon: Calendar,  label: "Fondée en",         value: String(COMPANY.foundedYear) },
];

function Row({
  icon: Icon,
  label,
  value,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  index: number;
}) {
  const isEmail = value.includes("@");
  const isPhone = value.startsWith("+");
  const isUrl   = value.startsWith("http") || value === COMPANY.website;

  const content = isEmail ? (
    <a href={`mailto:${value}`} className="transition-colors hover:opacity-70"
      style={{ color: "var(--color-gold)" }}>{value}</a>
  ) : isPhone ? (
    <a href={`tel:${COMPANY.phoneRaw}`} className="transition-colors hover:opacity-70"
      style={{ color: "var(--text-primary)" }}>{value}</a>
  ) : isUrl ? (
    <a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer"
      className="transition-colors hover:opacity-70"
      style={{ color: "var(--color-gold)" }}>{value}</a>
  ) : (
    <span style={{ color: "var(--text-primary)" }}>{value}</span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="flex items-center gap-4 py-4"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)" }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} />
      </div>
      <span className="text-xs w-40 flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className="text-xs font-medium">{content}</span>
    </motion.div>
  );
}

export default function CompanyPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Ambient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(212,175,55,0.08) 0%, transparent 60%)" }}
      />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-gold)" }}
          >
            À propos
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-4xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Informations <span className="text-gold-gradient">entreprise</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm leading-relaxed max-w-md mx-auto"
            style={{ color: "var(--text-tertiary)" }}
          >
            Camille est un produit de {COMPANY.name}, un établissement basé à {COMPANY.city}, {COMPANY.country} — qui construit des outils IA pour les entrepreneurs et les équipes commerciales.
          </motion.p>
        </div>
      </section>

      {/* Info table */}
      <section className="px-6 pb-16" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto pt-12">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-good-timing text-xl font-bold mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Informations légales
          </motion.h2>
          <div>
            {INFOS.map((info, i) => (
              <Row key={`${info.label}-${i}`} icon={info.icon} label={info.label} value={info.value} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto pt-12 space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-good-timing text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Notre mission
          </motion.h2>
          {[
            `Camille démocratise l'accès aux agents IA conversationnels pour les entreprises de toute taille. Notre conviction : chaque marque mérite un agent qui lui ressemble.`,
            `Nous construisons des outils No-Code qui permettent à n'importe quel entrepreneur de déployer un agent IA performant en moins de 5 minutes — sans développeur, sans expertise technique.`,
            `Basés à ${COMPANY.city}, ${COMPANY.country}, nous servons des clients en Afrique, en Europe et dans le monde entier. Notre priorité : des agents multilingues, contextualisés, et vraiment utiles.`,
          ].map((text, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-tertiary)" }}
            >
              {text}
            </motion.p>
          ))}
        </div>
      </section>
    </main>
  );
}
