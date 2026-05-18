// app/terms/page.tsx — Camille by Buyticle
// Terms of Service — required for Google OAuth verification
// Publicly accessible, no auth required.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Camille by Buyticle",
  description:
    "Conditions générales d'utilisation de Camille, la plateforme d'agents IA WhatsApp pour les entreprises.",
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-24">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--color-gold)" }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Table of contents ─────────────────────────────────────────────────────────

const TOC = [
  { id: "objet",              label: "Objet" },
  { id: "acces",              label: "Accès au service" },
  { id: "comptes",            label: "Comptes utilisateurs" },
  { id: "plans",              label: "Plans et facturation" },
  { id: "utilisation",        label: "Utilisation acceptable" },
  { id: "integrations",       label: "Intégrations tierces" },
  { id: "ia",                 label: "Intelligence artificielle" },
  { id: "propriete",          label: "Propriété intellectuelle" },
  { id: "responsabilite",     label: "Limitation de responsabilité" },
  { id: "resiliation",        label: "Résiliation" },
  { id: "modifications-cgu",  label: "Modifications des CGU" },
  { id: "droit-applicable",   label: "Droit applicable" },
  { id: "contact-terms",      label: "Contact" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TermsPage() {
  const lastUpdated = "18 mai 2026";

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center gap-4 px-6 h-14 flex-shrink-0"
        style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-subtle)" }}>
        <Link href="/" className="flex items-center gap-2 text-sm font-bold"
          style={{ color: "var(--color-gold)" }}>
          ✦ Camille
        </Link>
        <span className="flex-1" />
        <Link href="/privacy" className="text-xs transition-colors hover:text-white"
          style={{ color: "var(--text-disabled)" }}>
          Politique de confidentialité
        </Link>
        <Link href="/dashboard" className="text-xs transition-colors hover:text-white"
          style={{ color: "var(--text-disabled)" }}>
          Dashboard
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-14 lg:py-20">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16">

          {/* ── Sidebar TOC (desktop) ──────────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--text-disabled)" }}>
                Sommaire
              </p>
              {TOC.map(({ id, label }) => (
                <a key={id} href={`#${id}`}
                  className="block text-xs py-1 px-2 rounded-md transition-colors duration-100 hover:text-white"
                  style={{ color: "var(--text-disabled)" }}>
                  {label}
                </a>
              ))}
            </div>
          </aside>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <main className="space-y-12">

            {/* Hero */}
            <div className="space-y-4 pb-10"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: "rgba(212,175,55,0.08)", color: "var(--color-gold)", border: "1px solid rgba(212,175,55,0.2)" }}>
                Document légal
              </div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                Conditions générales d'utilisation
              </h1>
              <p className="text-sm" style={{ color: "var(--text-disabled)" }}>
                Dernière mise à jour : <strong style={{ color: "var(--text-tertiary)" }}>{lastUpdated}</strong>
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                En accédant à la plateforme{" "}
                <strong style={{ color: "var(--color-gold)" }}>Camille</strong> éditée par{" "}
                <strong style={{ color: "var(--text-primary)" }}>Buyticle</strong>, vous acceptez les
                présentes Conditions Générales d'Utilisation (CGU). Veuillez les lire attentivement avant
                d'utiliser le service.
              </p>
            </div>

            {/* 1 — Objet */}
            <Section id="objet" title="1. Objet du service">
              <P>
                Camille est une plateforme SaaS (Software as a Service) permettant aux entreprises et
                professionnels de déployer des agents conversationnels basés sur l'intelligence artificielle
                sur WhatsApp. Le service comprend notamment :
              </P>
              <Ul items={[
                "La création et la configuration d'agents IA personnalisés selon l'identité et la base de connaissance de l'entreprise.",
                "La réponse automatique aux messages WhatsApp entrants via des modèles de langage (LLM).",
                "La planification automatique de rendez-vous via Google Calendar (fonctionnalité optionnelle).",
                "La capture et le stockage de leads qualifiés issus des conversations WhatsApp.",
                "Un tableau de bord de suivi des performances et de gestion des agents.",
              ]} />
            </Section>

            {/* 2 — Accès */}
            <Section id="acces" title="2. Accès au service">
              <P>
                Le service Camille est accessible via l'URL{" "}
                <a href="https://camille.vps.buyticle.com" style={{ color: "var(--color-gold)" }}>
                  https://camille.vps.buyticle.com
                </a>{" "}
                depuis tout navigateur moderne disposant d'une connexion Internet. L'accès nécessite la
                création d'un compte utilisateur.
              </P>
              <P>
                Buyticle se réserve le droit de suspendre temporairement l'accès au service pour des
                opérations de maintenance, des mises à jour de sécurité ou des améliorations. Ces
                interruptions planifiées seront notifiées par e-mail dans un délai raisonnable.
              </P>
              <P>
                Buyticle ne garantit pas une disponibilité de 100 % du service. Un objectif de disponibilité
                de 99 % est visé sur une base mensuelle, hors maintenances planifiées et cas de force
                majeure.
              </P>
            </Section>

            {/* 3 — Comptes */}
            <Section id="comptes" title="3. Comptes utilisateurs">
              <P>
                Pour utiliser Camille, vous devez créer un compte en fournissant des informations exactes et
                complètes. Vous êtes seul responsable de la confidentialité de vos identifiants.
              </P>
              <Ul items={[
                "Vous vous engagez à ne pas partager vos identifiants avec des tiers non autorisés.",
                "Vous devez nous signaler immédiatement tout accès non autorisé à votre compte à privacy@buyticle.com.",
                "Chaque compte est associé à une entreprise ou une entité légale. Plusieurs agents peuvent être créés sous un même compte.",
                "Vous êtes responsable de toutes les actions effectuées depuis votre compte, qu'elles soient réalisées par vous ou par des tiers ayant accès à vos identifiants.",
              ]} />
            </Section>

            {/* 4 — Plans */}
            <Section id="plans" title="4. Plans d'abonnement et facturation">
              <P>
                Camille propose plusieurs niveaux d'abonnement (Free, Starter, Pro, Enterprise) avec des
                quotas de tokens mensuels et des fonctionnalités différentes. Les détails des plans sont
                disponibles sur la page de tarification de la plateforme.
              </P>
              <Ul items={[
                "Les abonnements payants sont facturés mensuellement ou annuellement selon l'option choisie.",
                "Les paiements sont traités de manière sécurisée via notre prestataire de paiement.",
                "En cas de dépassement du quota mensuel de tokens, l'agent cesse de répondre jusqu'au renouvellement du cycle ou à la mise à niveau du plan.",
                "Aucun remboursement n'est accordé pour les périodes d'abonnement entamées, sauf obligation légale.",
                "Les tarifs peuvent évoluer. Tout changement tarifaire sera notifié 30 jours à l'avance par e-mail.",
              ]} />
            </Section>

            {/* 5 — Utilisation acceptable */}
            <Section id="utilisation" title="5. Utilisation acceptable">
              <P>
                En utilisant Camille, vous vous engagez à respecter les règles suivantes. Toute violation
                peut entraîner la suspension ou la résiliation immédiate de votre compte.
              </P>

              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                Usages interdits
              </p>
              <Ul items={[
                "Utiliser le service à des fins illégales, frauduleuses ou contraires aux lois en vigueur.",
                "Envoyer des communications non sollicitées (spam) ou du contenu à caractère haineux, discriminatoire ou pornographique.",
                "Tenter de contourner les mécanismes de sécurité ou de quotas de la plateforme.",
                "Utiliser des agents IA pour tromper délibérément des utilisateurs finaux en leur faisant croire qu'ils interagissent avec un humain, sans divulgation appropriée.",
                "Collecter des données personnelles de manière illégale via les agents déployés.",
                "Revendre ou sous-licencier l'accès à la plateforme à des tiers sans autorisation écrite de Buyticle.",
              ]} />

              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                Obligations de l'utilisateur
              </p>
              <Ul items={[
                "Vous êtes responsable du contenu que vous configurez dans vos agents (base de connaissance, prompts système, réponses).",
                "Vous devez respecter les Conditions d'utilisation de WhatsApp Business et de Meta pour tout usage professionnel.",
                "Vous devez informer vos propres clients et contacts WhatsApp qu'ils interagissent avec un agent IA.",
                "Vous êtes responsable de la légalité des données collectées via votre agent auprès de vos contacts.",
              ]} />
            </Section>

            {/* 6 — Intégrations tierces */}
            <Section id="integrations" title="6. Intégrations tierces">
              <P>
                Camille s'intègre à des services tiers dont les conditions d'utilisation s'appliquent
                indépendamment des présentes CGU. En connectant ces services, vous acceptez également leurs
                propres conditions :
              </P>
              <div className="space-y-3">
                {[
                  {
                    service: "Google Calendar",
                    detail: "La connexion à Google Calendar est optionnelle et activée uniquement sur votre initiative explicite via le processus OAuth. Vous pouvez révoquer cet accès à tout moment. L'utilisation de l'API Google Calendar est soumise aux Conditions d'utilisation des services Google.",
                    lien: "https://policies.google.com/terms",
                    label: "CGU Google",
                  },
                  {
                    service: "WhatsApp Business (via WAHA)",
                    detail: "L'utilisation de WhatsApp doit être conforme aux Conditions d'utilisation de WhatsApp Business et aux politiques d'utilisation acceptable de Meta. Buyticle décline toute responsabilité en cas de suspension de votre compte WhatsApp par Meta.",
                    lien: "https://www.whatsapp.com/legal/business-terms",
                    label: "CGU WhatsApp Business",
                  },
                  {
                    service: "Groq (API LLM)",
                    detail: "Les messages traités par les agents sont transmis à Groq pour génération des réponses IA. Le contenu des conversations est soumis à la politique d'utilisation acceptable de Groq.",
                    lien: "https://groq.com/terms-of-service/",
                    label: "CGU Groq",
                  },
                ].map(({ service, detail, lien, label }) => (
                  <div key={service} className="rounded-xl p-4"
                    style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{service}</p>
                      <a href={lien} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] flex-shrink-0 transition-colors hover:opacity-80"
                        style={{ color: "var(--color-gold)" }}>
                        {label} →
                      </a>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--text-disabled)" }}>{detail}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* 7 — IA */}
            <Section id="ia" title="7. Intelligence artificielle — limitations">
              <P>
                Les agents Camille sont alimentés par des modèles de langage large (LLM) qui peuvent
                produire des réponses incorrectes, incomplètes ou non adaptées à certaines situations.
              </P>
              <Ul items={[
                "Les réponses générées par les agents IA ne constituent pas un avis médical, juridique, financier ou professionnel.",
                "Buyticle n'est pas responsable des décisions prises par vos clients sur la base des réponses de vos agents.",
                "Il vous appartient de configurer des limites claires dans votre agent (sujets interdits, redirections vers un humain) pour les situations critiques.",
                "Les modèles LLM peuvent parfois générer des informations inexactes (hallucinations). Nous vous encourageons à surveiller les conversations de vos agents et à affiner régulièrement leur base de connaissance.",
              ]} />
            </Section>

            {/* 8 — Propriété intellectuelle */}
            <Section id="propriete" title="8. Propriété intellectuelle">
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Propriété de Buyticle :</strong> La plateforme
                Camille, son code source, son interface, ses algorithmes et sa marque sont la propriété
                exclusive de Buyticle. Toute reproduction, modification ou utilisation commerciale sans
                autorisation écrite est interdite.
              </P>
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Propriété de l'utilisateur :</strong> Le
                contenu que vous créez (prompts, base de connaissance, configurations d'agents) reste votre
                propriété. En l'uploadant sur la plateforme, vous nous accordez une licence limitée,
                non-exclusive et révocable pour l'utiliser uniquement dans le cadre de la fourniture du
                service.
              </P>
              <P>
                Buyticle ne revendique aucun droit de propriété sur vos données clients, vos conversations
                WhatsApp ou les leads collectés par vos agents.
              </P>
            </Section>

            {/* 9 — Responsabilité */}
            <Section id="responsabilite" title="9. Limitation de responsabilité">
              <P>
                Dans les limites autorisées par la loi applicable, la responsabilité totale de Buyticle
                envers vous, pour tout préjudice découlant de l'utilisation du service, est limitée au
                montant que vous avez payé pour le service au cours des 3 derniers mois.
              </P>
              <P>
                Buyticle ne saurait être tenu responsable :
              </P>
              <Ul items={[
                "Des interruptions de service causées par des services tiers (Google, WhatsApp, Groq, hébergeurs).",
                "Des réponses incorrectes ou inappropriées générées par les modèles LLM.",
                "De la perte de données résultant d'un cas de force majeure ou d'une attaque informatique malgré les mesures de sécurité en place.",
                "Des conséquences de votre non-respect des conditions d'utilisation de WhatsApp Business ou de Meta.",
                "De tout manque à gagner, perte de clientèle ou préjudice indirect lié à l'utilisation du service.",
              ]} />
            </Section>

            {/* 10 — Résiliation */}
            <Section id="resiliation" title="10. Résiliation">
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Par l'utilisateur :</strong> Vous pouvez
                résilier votre abonnement à tout moment depuis votre tableau de bord. La résiliation prend
                effet à la fin du cycle de facturation en cours. Vos données seront supprimées dans un délai
                de 90 jours après la date effective de résiliation.
              </P>
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Par Buyticle :</strong> Nous nous réservons
                le droit de suspendre ou de résilier votre compte sans préavis en cas de violation grave des
                présentes CGU, notamment en cas d'utilisation du service à des fins illégales ou frauduleuses.
                Pour les violations moins graves, un préavis de 15 jours sera accordé, permettant la mise en
                conformité.
              </P>
              <P>
                En cas de résiliation, vous pouvez demander une exportation de vos données (configurations
                d'agents, leads) avant la suppression effective en contactant{" "}
                <a href="mailto:privacy@buyticle.com" style={{ color: "var(--color-gold)" }}>
                  privacy@buyticle.com
                </a>.
              </P>
            </Section>

            {/* 11 — Modifications CGU */}
            <Section id="modifications-cgu" title="11. Modifications des CGU">
              <P>
                Buyticle se réserve le droit de modifier les présentes CGU à tout moment. Les modifications
                substantielles seront notifiées par e-mail au moins 30 jours avant leur entrée en vigueur.
                La poursuite de l'utilisation du service après cette période vaut acceptation des nouvelles
                conditions. Si vous n'acceptez pas les modifications, vous pouvez résilier votre abonnement
                avant la date d'entrée en vigueur.
              </P>
            </Section>

            {/* 12 — Droit applicable */}
            <Section id="droit-applicable" title="12. Droit applicable et juridiction">
              <P>
                Les présentes CGU sont régies par le droit français. En cas de litige, les parties
                s'engagent à rechercher une solution amiable avant tout recours judiciaire.
              </P>
              <P>
                À défaut d'accord amiable dans un délai de 60 jours, tout litige relatif à l'interprétation
                ou à l'exécution des présentes CGU sera soumis aux tribunaux compétents du ressort de
                Paris, France, nonobstant pluralité de défendeurs ou appel en garantie.
              </P>
              <P>
                Les utilisateurs domiciliés dans l'Union Européenne peuvent également recourir à la
                plateforme de résolution en ligne des litiges mise en place par la Commission Européenne :{" "}
                <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--color-gold)" }}>
                  ec.europa.eu/consumers/odr
                </a>.
              </P>
            </Section>

            {/* 13 — Contact */}
            <Section id="contact-terms" title="13. Contact">
              <P>
                Pour toute question relative aux présentes CGU :
              </P>
              <div className="rounded-xl p-5"
                style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>E-mail</p>
                    <a href="mailto:legal@buyticle.com" style={{ color: "var(--color-gold)" }}>
                      legal@buyticle.com
                    </a>
                  </div>
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Confidentialité</p>
                    <a href="mailto:privacy@buyticle.com" style={{ color: "var(--color-gold)" }}>
                      privacy@buyticle.com
                    </a>
                  </div>
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Site web</p>
                    <a href="https://camille.vps.buyticle.com" style={{ color: "var(--color-gold)" }}>
                      camille.vps.buyticle.com
                    </a>
                  </div>
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Politique de confidentialité</p>
                    <Link href="/privacy" style={{ color: "var(--color-gold)" }}>
                      camille.vps.buyticle.com/privacy
                    </Link>
                  </div>
                </div>
              </div>
            </Section>

            {/* Footer note */}
            <div className="pt-8 flex items-center justify-between flex-wrap gap-4"
              style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-xs" style={{ color: "var(--text-disabled)" }}>
                © {new Date().getFullYear()} Buyticle — Camille. Tous droits réservés.
              </p>
              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-disabled)" }}>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Politique de confidentialité
                </Link>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Tableau de bord
                </Link>
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
