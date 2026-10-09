// app/privacy/page.tsx — Camille by Buyticle
// Privacy Policy — required for Google OAuth verification
// Publicly accessible, no auth required.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Camille by Buyticle",
  description:
    "Politique de confidentialité de Camille, la plateforme d'agents IA WhatsApp pour les entreprises.",
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
  { id: "qui-sommes-nous",       label: "Qui sommes-nous ?" },
  { id: "donnees-collectees",    label: "Données collectées" },
  { id: "application-mobile",    label: "Application mobile Android" },
  { id: "meta-whatsapp",         label: "Données WhatsApp (Meta)" },
  { id: "google-api",            label: "Utilisation des données Google" },
  { id: "finalites",             label: "Finalités du traitement" },
  { id: "partage",               label: "Partage des données" },
  { id: "conservation",          label: "Durée de conservation" },
  { id: "securite",              label: "Sécurité" },
  { id: "droits",                label: "Vos droits" },
  { id: "suppression",           label: "Supprimer son compte" },
  { id: "cookies",               label: "Cookies" },
  { id: "modifications",         label: "Modifications" },
  { id: "contact",               label: "Contact" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const lastUpdated = "8 octobre 2026";

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
        <Link href="/terms" className="text-xs transition-colors hover:text-white"
          style={{ color: "var(--text-disabled)" }}>
          Conditions d'utilisation
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
                style={{ background: "rgba(124,90,248,0.08)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.2)" }}>
                Document légal
              </div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                Politique de confidentialité
              </h1>
              <p className="text-sm" style={{ color: "var(--text-disabled)" }}>
                Dernière mise à jour : <strong style={{ color: "var(--text-tertiary)" }}>{lastUpdated}</strong>
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                Chez <strong style={{ color: "var(--text-primary)" }}>Buyticle</strong>, nous nous engageons
                à protéger la vie privée des utilisateurs de la plateforme{" "}
                <strong style={{ color: "var(--color-gold)" }}>Camille</strong>. Ce document décrit quelles
                données nous collectons, pourquoi et comment nous les utilisons.
              </p>
            </div>

            {/* 1 — Qui sommes-nous */}
            <Section id="qui-sommes-nous" title="1. Qui sommes-nous ?">
              <P>
                Camille est une plateforme SaaS éditée par <strong style={{ color: "var(--text-primary)" }}>Buyticle</strong>,
                permettant aux entreprises de déployer des agents IA conversationnels sur WhatsApp.
                Elle s'appuie sur l'API officielle WhatsApp Business de Meta (WhatsApp Cloud API) et sur des services tiers (Groq, Google Calendar) pour offrir
                des fonctionnalités de planification de rendez-vous, de capture de leads et de réponses
                automatisées.
              </P>
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Responsable du traitement :</strong> BUYTICLE ETS
                <br />
                <strong style={{ color: "var(--text-primary)" }}>N° RCCM :</strong> CM-DLA-01-2025-A10-01482
                <br />
                <strong style={{ color: "var(--text-primary)" }}>Siège :</strong> Bonamoussadi, Douala — Cameroun
                <br />
                <strong style={{ color: "var(--text-primary)" }}>Téléphone :</strong> (+237) 696 99 58 79
                <br />
                <strong style={{ color: "var(--text-primary)" }}>Site web :</strong>{" "}
                <a href="https://camille.vps.buyticle.com" style={{ color: "var(--color-gold)" }}>
                  https://camille.vps.buyticle.com
                </a>
                <br />
                <strong style={{ color: "var(--text-primary)" }}>Contact :</strong>{" "}
                <a href="mailto:privacy@buyticle.com" style={{ color: "var(--color-gold)" }}>
                  privacy@buyticle.com
                </a>
              </P>
            </Section>

            {/* 2 — Données collectées */}
            <Section id="donnees-collectees" title="2. Données collectées">
              <P>
                Nous collectons uniquement les données strictement nécessaires au fonctionnement de la
                plateforme. Elles se répartissent en trois catégories :
              </P>

              <div className="space-y-4">
                <div className="rounded-xl p-4" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: "var(--text-disabled)" }}>Données de compte</p>
                  <Ul items={[
                    "Adresse e-mail et mot de passe (hashé, jamais stocké en clair)",
                    "Nom de l'entreprise et secteur d'activité",
                    "Numéro WhatsApp Business",
                    "Plan d'abonnement souscrit",
                  ]} />
                </div>

                <div className="rounded-xl p-4" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: "var(--text-disabled)" }}>Données de l'agent IA</p>
                  <Ul items={[
                    "Configuration de l'agent (nom, personnalité, base de connaissance)",
                    "Historique des conversations WhatsApp (messages entrants et réponses générées), y compris la transcription texte des notes vocales",
                    "Commandes passées sur WhatsApp : articles, montants, mode de réception, adresse ou position partagée par le client",
                    "Leads capturés (nom, e-mail, numéro de téléphone des contacts WhatsApp)",
                    "Tokens d'utilisation des modèles LLM",
                  ]} />
                </div>

                <div className="rounded-xl p-4" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: "var(--text-disabled)" }}>Données d'intégration tierce</p>
                  <Ul items={[
                    "Connexion WhatsApp Business (Meta) : identifiants du compte et du numéro, nom vérifié, jeton d'accès chiffré — voir « Données WhatsApp (Meta) »",
                    "Token de rafraîchissement (refresh_token) Google OAuth — voir section « Données Google »",
                    "Adresse e-mail Google associée au calendrier connecté",
                    "Données techniques de connexion (logs d'accès, adresse IP, user-agent)",
                  ]} />
                </div>
              </div>
            </Section>

            {/* 3 — Google API — section clé pour la vérification Google */}
            {/* Application mobile — ce que collecte l'app Android */}
            <Section id="application-mobile" title="3. Application mobile Android">
              <P>
                L&apos;application Camille pour Android, destinée aux commerçants,
                traite deux catégories de données que le site web ne traite pas.
                Elles sont détaillées ici parce qu&apos;elles apparaissent dans la
                section « Sécurité des données » de Google Play.
              </P>
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Notifications push.</strong>{" "}
                Si vous les autorisez, l&apos;application enregistre un jeton
                d&apos;appareil fourni par Firebase Cloud Messaging (Google). Ce jeton
                identifie votre appareil, pas votre personne, et sert uniquement à
                vous prévenir d&apos;une nouvelle commande ou d&apos;un événement sur vos
                agents. Il est supprimé à la déconnexion, au refus de
                l&apos;autorisation, et à la suppression du compte. Refuser les
                notifications n&apos;empêche aucune autre fonction de l&apos;application.
              </P>
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Localisation des commandes.</strong>{" "}
                Lorsqu&apos;un de vos clients partage sa position dans WhatsApp pour
                être livré, ces coordonnées sont enregistrées avec la commande et
                affichées dans l&apos;application, avec un itinéraire pour le livreur.
                Il s&apos;agit de la position du <em>client</em>, transmise volontairement
                par lui dans sa conversation. L&apos;application ne demande ni n&apos;utilise
                la localisation de votre propre appareil, et ne la suit jamais en
                arrière-plan.
              </P>
              <P>
                Les fonds de carte et le calcul d&apos;itinéraire sont fournis par des
                services cartographiques ouverts (OpenStreetMap, CARTO, OSRM),
                interrogés sans identifiant de compte.
              </P>
            </Section>

            <Section id="meta-whatsapp" title="Données WhatsApp (Meta Platform)">
              <P>
                Camille utilise l&apos;API officielle <strong style={{ color: "var(--text-primary)" }}>WhatsApp Business
                Platform (Cloud API)</strong> de Meta. Lorsqu&apos;un commerçant connecte son compte WhatsApp Business
                à Camille par la fenêtre officielle de Meta (« Embedded Signup »), il nous autorise à envoyer et
                recevoir des messages en son nom, avec son numéro.
              </P>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Ce que nous recevons de Meta et pourquoi :
              </p>
              <Ul items={[
                "Identifiants du compte WhatsApp Business et du numéro, nom vérifié et numéro affiché : pour relier le numéro au bon agent et l'afficher au commerçant.",
                "Un jeton d'accès propre au commerçant : uniquement pour envoyer et recevoir les messages de son agent, gérer ses modèles de message et son catalogue.",
                "Les messages de ses clients (texte, notes vocales, images, positions, paniers du catalogue) : pour y répondre, enregistrer les commandes et les suivre.",
                "Le catalogue de produits relié au compte : pour montrer les articles et recevoir les paniers.",
              ]} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Ce que nous ne faisons pas :
              </p>
              <Ul items={[
                "Nous ne vendons ni ne louons aucune donnée reçue de Meta, et ne l'utilisons à aucune fin publicitaire.",
                "Nous n'accédons ni aux paiements, ni aux utilisateurs, ni aux autres paramètres du compte Meta du commerçant : seuls les droits nécessaires à la messagerie, aux numéros, aux modèles et au catalogue sont demandés.",
                "Nous n'envoyons pas de messages non sollicités : l'agent répond aux clients qui écrivent au commerce, et les messages hors conversation passent par des modèles approuvés par Meta.",
                "Les conversations des clients d'un commerçant ne sont jamais visibles par un autre commerçant.",
              ]} />
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Stockage du jeton :</strong> le jeton d&apos;accès
                Meta et le code PIN du numéro sont chiffrés (AES-256-GCM) dans notre base ; la clé de chiffrement est
                conservée hors de la base. Ils ne sont jamais renvoyés au navigateur.
              </P>
              <P>
                <strong style={{ color: "var(--text-primary)" }}>Déconnexion :</strong> le commerçant peut déconnecter
                son WhatsApp à tout moment depuis la page <em>WhatsApp officiel</em> de son agent : le jeton est effacé
                et notre application cesse d&apos;écouter son compte. Il peut aussi retirer l&apos;accès depuis les
                paramètres de son entreprise sur Meta (Business Manager → Intégrations). La suppression du compte
                Camille efface ces données, comme indiqué plus bas.
              </P>
              <P>
                Le traitement est conforme aux{" "}
                <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-gold)" }}>
                  Conditions de la plateforme Meta
                </a>{" "}
                et aux{" "}
                <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-gold)" }}>
                  Politiques commerciales de WhatsApp
                </a>.
              </P>
            </Section>

            <Section id="google-api" title="3. Utilisation des données Google (Google API Services)">
              <div className="rounded-xl p-5 space-y-4"
                style={{ background: "rgba(66,133,244,0.05)", border: "1px solid rgba(66,133,244,0.2)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: "rgba(66,133,244,0.12)" }}>
                    📅
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "#4285F4" }}>
                    Conformité Google API Services User Data Policy
                  </p>
                </div>
                <P>
                  L'utilisation par Camille des informations reçues des API Google est conforme à la{" "}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#4285F4" }}>
                    Google API Services User Data Policy
                  </a>
                  , y compris les exigences relatives à l'utilisation limitée (<em>Limited Use</em>).
                </P>
              </div>

              <P>
                Lorsqu'un utilisateur connecte son compte Google Agenda à Camille, nous demandons
                l'autorisation d'accéder aux événements de son calendrier via le scope OAuth{" "}
                <code className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "var(--bg-muted)", color: "var(--color-gold)", border: "1px solid var(--border-subtle)" }}>
                  https://www.googleapis.com/auth/calendar.events
                </code>.
              </P>

              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Ce que nous faisons avec vos données Google :
              </p>
              <Ul items={[
                "Lire les événements existants de votre calendrier principal pour identifier les créneaux libres sur les 14 prochains jours ouvrés.",
                "Créer de nouveaux événements dans votre calendrier lorsqu'un contact WhatsApp confirme un rendez-vous.",
                "Afficher votre adresse e-mail Google dans le tableau de bord pour confirmer quelle compte est connecté.",
              ]} />

              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Ce que nous ne faisons PAS avec vos données Google :
              </p>
              <Ul items={[
                "Nous ne lisons pas, ne stockons pas et ne traitons pas le contenu de vos événements existants au-delà des horaires de début et de fin (pour détecter les créneaux occupés).",
                "Nous ne partageons jamais vos données Google avec des tiers à des fins publicitaires ou commerciales.",
                "Nous n'utilisons pas vos données Google pour entraîner des modèles d'intelligence artificielle.",
                "Nous ne transférons pas votre refresh_token à des services externes — il est uniquement utilisé pour générer des access_tokens de courte durée, directement depuis nos serveurs.",
                "Nous ne lisons pas vos contacts Google, vos e-mails, vos fichiers Google Drive ou tout autre service Google non autorisé.",
              ]} />

              <P>
                <strong style={{ color: "var(--text-primary)" }}>Stockage du refresh_token :</strong> Votre
                token de rafraîchissement Google est stocké de manière chiffrée dans notre base de données
                sécurisée (PostgreSQL hébergé sur un VPS privé). Il n'est jamais exposé dans les réponses API
                ni transmis à des services tiers. Seul un access_token de courte durée (1 heure) est généré
                à la demande pour interagir avec l'API Google Calendar.
              </P>

              <P>
                <strong style={{ color: "var(--text-primary)" }}>Révocation de l'accès :</strong> Vous pouvez
                déconnecter votre Google Agenda à tout moment depuis l'onglet <em>Intégration</em> de votre
                agent. Cette action révoque immédiatement le token auprès de Google et efface toutes les
                données associées de notre base de données. Vous pouvez également révoquer l'accès directement
                depuis votre compte Google :{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-gold)" }}>
                  myaccount.google.com/permissions
                </a>.
              </P>
            </Section>

            {/* 4 — Finalités */}
            <Section id="finalites" title="4. Finalités du traitement">
              <div className="space-y-3">
                {[
                  {
                    finalite: "Fourniture du service",
                    base: "Exécution du contrat",
                    detail: "Faire fonctionner l'agent IA, traiter les messages WhatsApp, gérer votre compte.",
                  },
                  {
                    finalite: "Planification de rendez-vous",
                    base: "Consentement explicite",
                    detail: "Accéder à votre Google Agenda pour détecter les disponibilités et créer des événements — uniquement après connexion OAuth volontaire.",
                  },
                  {
                    finalite: "Facturation et abonnement",
                    base: "Obligation légale / contrat",
                    detail: "Suivi de la consommation de tokens, gestion des plans payants.",
                  },
                  {
                    finalite: "Amélioration du service",
                    base: "Intérêt légitime",
                    detail: "Analyses agrégées et anonymisées de performance de la plateforme (jamais de données personnelles).",
                  },
                  {
                    finalite: "Sécurité et prévention des abus",
                    base: "Intérêt légitime",
                    detail: "Logs d'accès, détection d'activités anormales, protection contre les accès non autorisés.",
                  },
                ].map(({ finalite, base, detail }) => (
                  <div key={finalite} className="rounded-xl p-4 grid sm:grid-cols-[1fr_auto] gap-3"
                    style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{finalite}</p>
                      <p className="text-xs" style={{ color: "var(--text-disabled)" }}>{detail}</p>
                    </div>
                    <span className="self-start text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap"
                      style={{ background: "rgba(124,90,248,0.08)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.15)" }}>
                      {base}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 5 — Partage */}
            <Section id="partage" title="5. Partage des données">
              <P>
                Nous ne vendons jamais vos données personnelles. Nous partageons certaines données avec
                les sous-traitants strictement nécessaires au fonctionnement du service :
              </P>
              <div className="space-y-3">
                {[
                  {
                    nom: "Meta Platforms (WhatsApp Business Platform)",
                    role: "Acheminement des messages WhatsApp via l'API officielle WhatsApp Cloud API",
                    donnees: "Numéros de téléphone, nom de profil WhatsApp, contenu des messages (texte, notes vocales, images, positions partagées), catalogue de produits et paniers",
                    lien: "https://www.whatsapp.com/legal/business-data-processing-terms",
                  },
                  {
                    nom: "Groq Inc.",
                    role: "Fournisseur de modèles LLM et de transcription vocale",
                    donnees: "Contenu des messages WhatsApp et notes vocales (pour comprendre la demande et générer les réponses ; les notes vocales sont transcrites en texte)",
                    lien: "https://groq.com/privacy-policy/",
                  },
                  {
                    nom: "Google LLC",
                    role: "Fournisseur Google Calendar API",
                    donnees: "Événements de calendrier (uniquement sur votre demande explicite)",
                    lien: "https://policies.google.com/privacy",
                  },
                ].map(({ nom, role, donnees, lien }) => (
                  <div key={nom} className="rounded-xl p-4"
                    style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{nom}</p>
                      <a href={lien} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] flex-shrink-0 transition-colors hover:opacity-80"
                        style={{ color: "var(--color-gold)" }}>
                        Politique →
                      </a>
                    </div>
                    <p className="text-[11px] mb-1" style={{ color: "var(--text-disabled)" }}>
                      <strong style={{ color: "var(--text-tertiary)" }}>Rôle :</strong> {role}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
                      <strong style={{ color: "var(--text-tertiary)" }}>Données transmises :</strong> {donnees}
                    </p>
                  </div>
                ))}
              </div>
              <P>
                Transition : certains comptes créés avant le passage à l&apos;API officielle restent
                connectés par une liaison « appareil lié » WhatsApp, exploitée par Buyticle sur ses propres
                serveurs, sans autre intermédiaire. Ils migrent progressivement vers l&apos;API officielle de Meta.
              </P>
              <P>
                En dehors de ces sous-traitants, vos données ne sont partagées qu'en cas d'obligation
                légale (décision judiciaire, réquisition d'autorité compétente).
              </P>
            </Section>

            {/* 6 — Conservation */}
            <Section id="conservation" title="6. Durée de conservation">
              <Ul items={[
                "Données de compte : conservées pendant toute la durée de l'abonnement actif, puis supprimées dans un délai de 90 jours après résiliation.",
                "Historique des conversations WhatsApp : conservé 12 mois glissants par défaut, configurable par l'utilisateur.",
                "Données Google (refresh_token, e-mail Google) : supprimées immédiatement lors de la déconnexion du calendrier ou de la suppression du compte.",
                "Jeton et identifiants WhatsApp (Meta) : supprimés immédiatement lors de la déconnexion du WhatsApp ou de la suppression du compte.",
                "Paniers WhatsApp non terminés : effacés automatiquement après 2 heures.",
                "Leads capturés : conservés jusqu'à suppression manuelle ou résiliation du compte.",
                "Logs techniques : conservés 30 jours à des fins de sécurité.",
              ]} />
            </Section>

            {/* 7 — Sécurité */}
            <Section id="securite" title="7. Sécurité des données">
              <P>
                Nous appliquons des mesures techniques et organisationnelles adaptées pour protéger vos
                données contre tout accès non autorisé, perte ou divulgation :
              </P>
              <Ul items={[
                "Chiffrement des communications par TLS 1.3 (HTTPS obligatoire sur toutes les routes).",
                "Authentification par JWT avec expiration et rotation régulière.",
                "Mots de passe hashés avec bcrypt (facteur de coût élevé).",
                "Jetons Google et Meta stockés dans une base PostgreSQL privée, accessible uniquement depuis nos serveurs ; les jetons Meta sont en plus chiffrés (AES-256-GCM).",
                "Aucun jeton n'est jamais exposé dans les réponses API côté client.",
                "Messages WhatsApp reçus vérifiés par signature (HMAC SHA-256) avant tout traitement.",
                "Infrastructure hébergée sur un serveur privé, sans accès public à la base de données ; pare-feu et blocage automatique des adresses malveillantes.",
                "Accès administrateur aux serveurs par clé cryptographique uniquement (aucun mot de passe).",
                "Sauvegardes quotidiennes chiffrées.",
              ]} />
            </Section>

            {/* Suppression du compte — exigence Google Play */}
            <Section id="suppression" title="Supprimer son compte et ses données">
              <P>
                Vous pouvez effacer votre compte et l&apos;ensemble des données
                associées à tout moment, vous-même, sans passer par notre support.
                Dans l&apos;application&nbsp;: <strong style={{ color: "var(--text-primary)" }}>Profil → Supprimer mon compte</strong>.
                La marche à suivre complète, ainsi que le recours pour qui n&apos;a plus
                accès à l&apos;application, sont détaillés sur la page{" "}
                <Link href="/supprimer-compte" style={{ color: "var(--color-gold)" }}>
                  Supprimer mon compte
                </Link>.
              </P>
              <P>
                Sont effacés définitivement&nbsp;: le compte, les agents, les
                catalogues, les commandes, les conversations, les clés d&apos;API et les
                jetons de notification. La suppression est immédiate et
                irréversible.
              </P>
              <P>
                Deux choses subsistent, et nous préférons le dire clairement&nbsp;:
                les messages déjà envoyés restent dans les conversations WhatsApp de
                vos clients, sur leur téléphone, hors de notre portée ; et les
                pièces comptables liées à un paiement sont conservées le temps
                imposé par la loi commerciale, puis détruites.
              </P>
            </Section>

            {/* 8 — Droits */}
            <Section id="droits" title="8. Vos droits">
              <P>
                Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez
                des droits suivants concernant vos données personnelles :
              </P>
              <Ul items={[
                "Droit d'accès : obtenir une copie de toutes les données que nous détenons sur vous.",
                "Droit de rectification : corriger toute donnée inexacte ou incomplète.",
                "Droit à l'effacement (« droit à l'oubli ») : demander la suppression de vos données.",
                "Droit à la portabilité : recevoir vos données dans un format structuré et lisible par machine.",
                "Droit d'opposition : vous opposer au traitement fondé sur notre intérêt légitime.",
                "Droit de retrait du consentement : révoquer à tout moment l'accès à votre Google Agenda.",
                "Droit de réclamation : déposer une plainte auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés).",
              ]} />
              <P>
                Pour exercer vos droits, contactez-nous à :{" "}
                <a href="mailto:privacy@buyticle.com" style={{ color: "var(--color-gold)" }}>
                  privacy@buyticle.com
                </a>. Nous répondons dans un délai de 30 jours.
              </P>
            </Section>

            {/* 9 — Cookies */}
            <Section id="cookies" title="9. Cookies et stockage local">
              <P>
                Camille utilise un stockage minimal côté navigateur :
              </P>
              <Ul items={[
                "Session de connexion : un jeton d'authentification, pour ne pas vous redemander votre mot de passe à chaque page (et, si vous ne cochez pas « Se souvenir de moi », un repère effacé à la fermeture du navigateur).",
                "Préférences : le thème d'affichage, l'agent sélectionné dans le tableau de bord, votre choix pour les notifications, et le fait que vous avez lu l'information sur ce stockage.",
                "Tout est gardé dans le stockage local de votre navigateur (localStorage), pas dans des cookies, et n'est jamais lu par un tiers. Ce stockage est strictement nécessaire au service : il ne demande pas de consentement.",
                "Aucun cookie publicitaire, aucun outil de mesure ni traceur tiers (Google Analytics, Facebook Pixel, etc.) n'est utilisé.",
                "Aucune donnée n'est partagée avec des régies publicitaires.",
              ]} />
            </Section>

            {/* 10 — Modifications */}
            <Section id="modifications" title="10. Modifications de cette politique">
              <P>
                Nous pouvons mettre à jour cette politique ponctuellement. En cas de modification
                substantielle affectant vos droits, nous vous en informerons par e-mail au moins 30 jours
                avant l'entrée en vigueur des changements. La date de dernière mise à jour est indiquée en
                haut de ce document.
              </P>
            </Section>

            {/* 11 — Contact */}
            <Section id="contact" title="11. Contact">
              <P>
                Pour toute question relative à cette politique ou à vos données personnelles :
              </P>
              <div className="rounded-xl p-5 space-y-3"
                style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>E-mail (DPO)</p>
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
                    <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Révoquer accès Google</p>
                    <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--color-gold)" }}>
                      myaccount.google.com/permissions
                    </a>
                  </div>
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Autorité de contrôle</p>
                    <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--color-gold)" }}>
                      cnil.fr
                    </a>
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
                <Link href="/terms" className="hover:text-white transition-colors">
                  Conditions d'utilisation
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
