// ─────────────────────────────────────────────────────────────────────────────
// components/landing/Landing.tsx — Landing v4 · Camille by Buyticle
// Design inspiré de render.com : crème + encre + accents or, hero typographique
// géant à curseur animé, étapes numérotées, bande gradient, bento "zéro ops",
// témoignage, grille bâtisseurs, sécurité, terrain de jeu d'icônes, footer noir.
// Page autonome : header + footer propres (Navbar/Footer globaux masqués sur /).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Menu, X, ArrowRight, ArrowUpRight, Check, Plus,
  Bot, MessageCircle, Store, UtensilsCrossed, Stethoscope, GraduationCap,
  Home, Car, Plane, Scissors, Pill, Wrench, Shirt, Gem, Coffee, Truck,
  Dumbbell, Sparkles, Layers, Wand2, Languages, Image as ImageIcon,
  Gauge, Webhook, UserCheck, RefreshCw, Lock, KeyRound, Database,
  ShieldCheck, Filter, Activity,
} from "lucide-react";
import "./landing.css";

/* ══════════════════════════════════════════════════════════════════════════════
   Utilitaires
   ══════════════════════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children, delay = 0, className,
}: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" aria-label="Camille — accueil">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[9px]"
        style={{ background: "#131007", border: "1px solid rgba(212,175,55,0.5)" }}
      >
        <span style={{ fontFamily: "Blackout", fontSize: 17, color: "#D4AF37", lineHeight: 1 }}>C</span>
      </span>
      <span
        style={{
          fontFamily: "var(--font-good-timing)",
          fontSize: 16.5,
          letterSpacing: "0.03em",
          color: dark ? "#FBF7F0" : "var(--cl-ink)",
        }}
      >
        Camille
      </span>
    </Link>
  );
}

/** Cadre "mini navigateur" pour les captures produit factices */
function MiniBrowser({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
      <div
        className="flex items-center gap-1.5 px-3 py-2"
        style={{ borderBottom: "1px solid var(--cl-line-soft)", background: "#FAF7F0" }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: "#E8B4AC" }} />
        <span className="h-2 w-2 rounded-full" style={{ background: "#EBD9A2" }} />
        <span className="h-2 w-2 rounded-full" style={{ background: "#B7D9B4" }} />
        <span className="ml-2 truncate text-[10px] font-medium" style={{ color: "var(--cl-ink-faint)" }}>
          {title}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 · Bandeau d'annonce + Navigation
   ══════════════════════════════════════════════════════════════════════════ */

function AnnouncementBar() {
  return (
    <Link
      href="/company"
      className="group relative z-40 flex items-center justify-center gap-2.5 px-4 py-2.5 text-center transition-colors"
      style={{ background: "#16141A" }}
    >
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ background: "var(--cl-accent)", color: "#fff" }}
      >
        Nouveau
      </span>
      <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.9)" }}>
        <span className="font-semibold" style={{ color: "#fff" }}>Camille v3 est là</span>
        <span className="hidden sm:inline"> — monitoring en direct, sessions ultra-stables et accueils médias enrichis.</span>
      </span>
      <span
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold transition-transform group-hover:translate-x-0.5"
        style={{ color: "#fff" }}
      >
        Découvrir <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

const NAV_LINKS = [
  { label: "Fonctionnalités", href: "/#features" },
  { label: "Comment ça marche", href: "/#how" },
  { label: "Sécurité", href: "/#security" },
  { label: "Tarifs", href: "/pricing" },
  { label: "Entreprise", href: "/company" },
];

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.6)",
        backdropFilter: "blur(14px) saturate(1.4)",
        WebkitBackdropFilter: "blur(14px) saturate(1.4)",
        borderBottom: "1px solid var(--cl-line)",
      }}
    >
      <div className="cl-container flex h-[64px] items-center justify-between gap-4">
        <Wordmark />

        <nav className="hidden items-center lg:flex" aria-label="Navigation principale">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="cl-nav-link">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="cl-nav-link">Se connecter</Link>
          <Link href="/dashboard" className="cl-btn-black !px-5 !py-2.5 text-sm">
            Dashboard
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
          style={{ border: "1px solid var(--cl-line)" }}
          onClick={() => setOpen(!open)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div
          className="px-6 pb-6 pt-2 lg:hidden"
          style={{ background: "rgba(251,247,240,0.97)", borderBottom: "1px solid var(--cl-line-soft)" }}
        >
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium"
                style={{ color: "var(--cl-ink)" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex gap-3">
            <Link href="/login" className="cl-btn-outline flex-1 justify-center">Se connecter</Link>
            <Link href="/dashboard" className="cl-btn-black flex-1 justify-center">Dashboard</Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   2 · Hero — typographie géante + frappe animée + mockup WhatsApp flottant
   ══════════════════════════════════════════════════════════════════════════ */

const TYPED_WORDS = ["boutique", "restaurant", "clinique", "école", "agence", "pharmacie"];

function useTypewriter(words: readonly string[]) {
  const [text, setText] = useState("");
  useEffect(() => {
    let i = 0;
    let pos = 0;
    let dir: 1 | -1 = 1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = words[i];
      pos += dir;
      setText(word.slice(0, pos));
      let delay = dir === 1 ? 88 : 42;
      if (dir === 1 && pos === word.length) { dir = -1; delay = 2400; }
      else if (dir === -1 && pos === 0)      { dir = 1; i = (i + 1) % words.length; delay = 380; }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, [words]);
  return text;
}

/** Composant fort #1 — carte tableau de bord « analytics » (façon Render) */
function AnalyticsCard() {
  const bars = [38, 52, 44, 61, 55, 72, 68, 84, 79, 92, 88, 100];
  return (
    <div className="cl-card w-full overflow-hidden" style={{ boxShadow: "0 20px 50px rgba(25,23,27,0.10)" }}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#16141A" }}>
            <span style={{ fontFamily: "Blackout", fontSize: 15, color: "#8E6BFA", lineHeight: 1 }}>C</span>
          </span>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--cl-ink)" }}>Vue d&apos;ensemble</p>
            <p className="text-[10.5px]" style={{ color: "var(--cl-ink-faint)" }}>7 derniers jours</p>
          </div>
        </div>
        <span className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ background: "rgba(29,171,85,0.12)", color: "#1B8F47" }}>
          +18%
        </span>
      </div>

      <div className="px-5 pt-4">
        <p className="text-[30px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--cl-ink)" }}>
          9 842
        </p>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--cl-ink-soft)" }}>conversations traitées par l&apos;IA</p>
      </div>

      {/* Histogramme */}
      <div className="flex items-end gap-1.5 px-5 pb-4 pt-5" style={{ height: 96 }}>
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-[3px]"
            style={{
              height: `${h}%`,
              background: i >= bars.length - 3 ? "var(--cl-accent)" : "var(--cl-lavender)",
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 border-t" style={{ borderColor: "var(--cl-line)" }}>
        <div className="border-r px-5 py-3.5" style={{ borderColor: "var(--cl-line)" }}>
          <p className="text-[16px] font-semibold" style={{ color: "var(--cl-ink)" }}>98%</p>
          <p className="text-[10.5px]" style={{ color: "var(--cl-ink-faint)" }}>taux de réponse</p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-[16px] font-semibold" style={{ color: "var(--cl-ink)" }}>1,2 s</p>
          <p className="text-[10.5px]" style={{ color: "var(--cl-ink-faint)" }}>temps moyen</p>
        </div>
      </div>
    </div>
  );
}

/** Composant fort #2 — carte « agent en ligne » compacte (preuve produit) */
function LiveAgentCard() {
  return (
    <div className="cl-card w-[262px] overflow-hidden" style={{ boxShadow: "0 16px 40px rgba(25,23,27,0.14)" }}>
      <div className="flex items-center gap-2.5 border-b px-4 py-3" style={{ borderColor: "var(--cl-line)" }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#25D366" }}>
          <MessageCircle className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>Boutique Aïcha</p>
          <p className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--cl-green)" }}>
            <span className="cl-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--cl-green)" }} />
            agent en ligne
          </p>
        </div>
      </div>
      <div className="space-y-2 px-3.5 py-3.5">
        <div className="max-w-[86%] rounded-lg rounded-tl-[3px] px-2.5 py-1.5 text-[11.5px]" style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink)" }}>
          La robe wax en taille M ?
        </div>
        <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-[3px] px-2.5 py-1.5 text-[11.5px]" style={{ background: "var(--cl-accent-soft)", color: "#2E2158" }}>
          Oui, 3 en stock ! Je vous réserve la vôtre ? 😊
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const typed = useTypewriter(TYPED_WORDS);

  return (
    <section className="relative">
      {/* Grille décorative en arrière-plan (façon Render) */}
      <div className="cl-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="cl-container relative grid items-center gap-14 pb-16 pt-8 md:pb-20 md:pt-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Colonne texte */}
        <div>
          <h1 className="cl-h1 cl-rise" aria-label="La voie la plus rapide vers un agent IA pour votre entreprise">
            <span aria-hidden="true">
              La voie la plus rapide
              <br />
              vers un agent IA pour
              <br />
              <span style={{ color: "var(--cl-accent-deep)" }}>votre {typed}</span>
              <span className="cl-caret" />
            </span>
          </h1>

          <p className="cl-sub cl-rise cl-rise-2 mt-6 max-w-[44ch]">
            L&apos;infrastructure intuitive pour créer, connecter et faire grandir votre
            assistant WhatsApp — de votre premier client au millionième.
          </p>

          <div className="cl-rise cl-rise-3 mt-8 flex flex-wrap items-center gap-3">
            <Link href="/configure" className="cl-btn-black">
              Commencer gratuitement
            </Link>
            <Link href="/pricing" className="cl-btn-outline">
              Voir les tarifs
            </Link>
          </div>
        </div>

        {/* Colonne démo — deux composants produit forts empilés */}
        <div className="cl-rise cl-rise-4 relative hidden justify-center pb-8 lg:flex">
          <div className="w-[360px]">
            <AnalyticsCard />
          </div>
          <div className="absolute -bottom-2 -left-3">
            <LiveAgentCard />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   3 · Bande logos clients
   ══════════════════════════════════════════════════════════════════════════ */

const CLIENT_MARKS: { name: string; style: React.CSSProperties }[] = [
  { name: "OPTIMUS RETAIL", style: { fontWeight: 800, letterSpacing: "0.12em", fontSize: 13 } },
  { name: "FinEdge",        style: { fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: 19 } },
  { name: "MedLink Pro",    style: { fontFamily: "var(--font-mono, monospace)", fontWeight: 600, fontSize: 14.5 } },
  { name: "AgriConnect",    style: { fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.03em" } },
  { name: "No Limit Santé", style: { fontWeight: 650, fontSize: 15, letterSpacing: "0.01em" } },
  { name: "CLEMINUTE",      style: { fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.16em", fontSize: 12.5 } },
  { name: "Hôtel Wouri",    style: { fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 17 } },
  { name: "Buyticle",       style: { fontFamily: "var(--font-good-timing)", fontSize: 15, letterSpacing: "0.04em" } },
];

function LogoStrip() {
  return (
    <section className="pb-20 pt-6 md:pb-28">
      <div className="cl-container">
        <Reveal>
          <p className="cl-kicker text-center">
            Ils développent leur relation client avec Camille
          </p>
          <div className="mx-auto mt-9 flex max-w-[900px] flex-wrap items-center justify-center gap-x-12 gap-y-7">
            {CLIENT_MARKS.map((m) => (
              <span key={m.name} className="cl-logo" style={m.style}>{m.name}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   4 · "Clic, clic, en ligne." — 3 étapes numérotées
   ══════════════════════════════════════════════════════════════════════════ */

const QR_PATTERN = [
  [1,1,1,0,1,0,1,1,1],
  [1,0,1,0,0,1,1,0,1],
  [1,1,1,0,1,0,1,1,1],
  [0,0,0,1,1,0,0,0,0],
  [1,0,1,1,0,1,1,0,1],
  [0,1,0,0,1,1,0,1,0],
  [1,1,1,0,1,0,1,0,1],
  [1,0,1,1,0,0,0,1,0],
  [1,1,1,0,1,1,1,0,1],
];

function StepBadge({ n }: { n: number }) {
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[14px] font-bold text-white"
      style={{ background: "var(--cl-accent-deep)" }}
    >
      {n}
    </span>
  );
}

function PersonaRow({ icon: Icon, label, selected = false }: { icon: React.ElementType; label: string; selected?: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg px-3 py-2"
      style={{
        border: selected ? "1.5px solid var(--cl-gold)" : "1px solid var(--cl-line-soft)",
        background: selected ? "var(--cl-accent-soft)" : "#fff",
      }}
    >
      <Icon className="h-4 w-4" style={{ color: selected ? "var(--cl-accent-deep)" : "var(--cl-ink-faint)" }} />
      <span className="flex-1 text-[12.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</span>
      {selected && <Check className="h-4 w-4" style={{ color: "var(--cl-accent-deep)" }} />}
    </div>
  );
}

function CheckRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ border: "1px solid var(--cl-line-soft)", background: "#fff" }}>
      <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full" style={{ background: "rgba(29,171,85,0.14)", width: 18, height: 18 }}>
        <Check className="h-3 w-3" style={{ color: "var(--cl-green)" }} />
      </span>
      <span className="text-[12.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</span>
    </div>
  );
}

function StepsSection() {
  return (
    <section id="how" className="scroll-mt-24 py-16 md:py-24">
      <div className="cl-container">
        <Reveal>
          <h2 className="cl-h2">Clic, clic, en ligne.</h2>
          <p className="cl-sub mt-4 max-w-[52ch]">
            Pas de code, pas de serveur, pas d&apos;intégration interminable.
            Votre agent répond sur WhatsApp en moins de cinq minutes.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Étape 1 */}
          <Reveal delay={0.05}>
            <div className="cl-card cl-card-hover flex h-full flex-col p-6">
              <div className="flex items-center gap-3">
                <StepBadge n={1} />
                <h3 className="cl-h3">Décrivez votre agent</h3>
              </div>
              <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                Choisissez un modèle métier, donnez un nom et un ton à votre
                assistant. Camille compile le tout en un cerveau prêt à l&apos;emploi.
              </p>
              <div className="mt-auto pt-6">
                <MiniBrowser title="camille · configurer">
                  <div className="space-y-2">
                    <PersonaRow icon={Store} label="Boutique & e-commerce" selected />
                    <PersonaRow icon={UtensilsCrossed} label="Restaurant" />
                    <PersonaRow icon={Stethoscope} label="Clinique & santé" />
                  </div>
                </MiniBrowser>
              </div>
            </div>
          </Reveal>

          {/* Étape 2 */}
          <Reveal delay={0.13}>
            <div className="cl-card cl-card-hover flex h-full flex-col p-6">
              <div className="flex items-center gap-3">
                <StepBadge n={2} />
                <h3 className="cl-h3">Scannez le QR code</h3>
              </div>
              <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                Liez votre numéro WhatsApp en un scan — ou par code d&apos;appairage.
                La session reste connectée et se rétablit toute seule.
              </p>
              <div className="mt-auto pt-6">
                <MiniBrowser title="camille · connexion whatsapp">
                  <div className="flex items-center gap-4">
                    <div
                      className="grid flex-shrink-0 grid-cols-9 gap-[2px] rounded-lg p-2"
                      style={{ border: "1px solid var(--cl-line-soft)", background: "#fff" }}
                      aria-hidden="true"
                    >
                      {QR_PATTERN.flat().map((v, i) => (
                        <span key={i} className="h-[7px] w-[7px] rounded-[1.5px]" style={{ background: v ? "var(--cl-ink)" : "transparent" }} />
                      ))}
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-[12px] font-semibold" style={{ color: "var(--cl-ink)" }}>WhatsApp → Appareils connectés</p>
                      <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--cl-green)" }}>
                        <span className="cl-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--cl-green)" }} />
                        session connectée
                      </p>
                    </div>
                  </div>
                </MiniBrowser>
              </div>
            </div>
          </Reveal>

          {/* Étape 3 */}
          <Reveal delay={0.21}>
            <div className="cl-card cl-card-hover flex h-full flex-col p-6">
              <div className="flex items-center gap-3">
                <StepBadge n={3} />
                <h3 className="cl-h3">Camille fait le reste</h3>
              </div>
              <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                Accueil des nouveaux contacts, réponses IA jour et nuit, médias,
                relances — vous ne touchez plus à rien, sauf si vous le voulez.
              </p>
              <div className="mt-auto pt-6">
                <MiniBrowser title="camille · agent actif">
                  <div className="space-y-2">
                    <CheckRow label="Réponses IA 24/7" />
                    <CheckRow label="Accueil médias automatique" />
                    <CheckRow label="Reprise humaine à la demande" />
                  </div>
                </MiniBrowser>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   5 · Bande gradient — secteurs
   ══════════════════════════════════════════════════════════════════════════ */

const SECTORS: { icon: React.ElementType; label: string; bg: string; color: string }[] = [
  { icon: Store,           label: "Boutique",     bg: "#FDECEC", color: "#C2504B" },
  { icon: UtensilsCrossed, label: "Restaurant",   bg: "#FFF3E0", color: "#C77E28" },
  { icon: Stethoscope,     label: "Santé",        bg: "#E7F4EE", color: "#2E8B62" },
  { icon: GraduationCap,   label: "Éducation",    bg: "#EAF1FB", color: "#3E6FB8" },
  { icon: Home,            label: "Immobilier",   bg: "#F2ECFB", color: "#7A5BC0" },
  { icon: Car,             label: "Automobile",   bg: "#FDECF4", color: "#BC4B84" },
  { icon: Plane,           label: "Voyage",       bg: "#E6F5F8", color: "#2E8AA0" },
  { icon: Scissors,        label: "Beauté",       bg: "#FDF0E6", color: "#BE6B33" },
  { icon: Pill,            label: "Pharmacie",    bg: "#EAF7EA", color: "#3E8B3E" },
  { icon: Wrench,          label: "Artisans",     bg: "#F0EFEA", color: "#6B655A" },
  { icon: Shirt,           label: "Mode",         bg: "#EEF0FA", color: "#5460B4" },
  { icon: Gem,             label: "Bijouterie",   bg: "#FBF3DF", color: "#A9822B" },
  { icon: Coffee,          label: "Café",         bg: "#F4EDE6", color: "#8A5A34" },
  { icon: Truck,           label: "Livraison",    bg: "#E9F3F1", color: "#33827A" },
  { icon: Dumbbell,        label: "Fitness",      bg: "#F6ECEC", color: "#A34F4F" },
];

function SectorBand() {
  return (
    <section className="py-6">
      <div className="cl-container">
        <Reveal>
          <div className="cl-band grid items-center gap-12 overflow-hidden rounded-2xl px-8 py-14 md:grid-cols-[1fr_1.05fr] md:px-14 md:py-20">
            {/* Texte à gauche — comme Render */}
            <div>
              <h2 className="cl-h2 max-w-[16ch]">
                Quel que soit votre métier, Camille répond.
              </h2>
              <p className="cl-sub mt-5 max-w-[42ch]" style={{ color: "rgba(25,23,27,0.72)" }}>
                Des modèles d&apos;agents pensés pour chaque activité — le vôtre
                parle déjà la langue de vos clients.
              </p>
              <div className="mt-9">
                <Link href="/configure" className="cl-btn-black">
                  Découvrir les modèles
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Grille de tuiles blanches à droite — comme Render */}
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:gap-3.5">
              {SECTORS.map((s, i) => (
                <motion.div
                  key={s.label}
                  title={s.label}
                  role="img"
                  aria-label={s.label}
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: 0.025 * i, ease: EASE }}
                  whileHover={{ scale: 1.08 }}
                  className="cl-band-tile cursor-default"
                >
                  <s.icon className="h-6 w-6" style={{ color: s.color }} />
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   6 · "Des agents IA, zéro maintenance." — bento fonctionnalités
   ══════════════════════════════════════════════════════════════════════════ */

function SessionRow({ name, status, msgs }: { name: string; status: "ok" | "qr"; msgs: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ border: "1px solid var(--cl-line-soft)", background: "#fff" }}>
      <span
        className={status === "ok" ? "cl-pulse h-2 w-2 rounded-full" : "h-2 w-2 rounded-full"}
        style={{ background: status === "ok" ? "var(--cl-green)" : "#D9A62E" }}
      />
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold" style={{ color: "var(--cl-ink)", fontFamily: "var(--font-mono, monospace)" }}>
        {name}
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-wide"
        style={{
          background: status === "ok" ? "rgba(29,171,85,0.12)" : "rgba(217,166,46,0.14)",
          color: status === "ok" ? "#22834A" : "#9A7414",
        }}
      >
        {status === "ok" ? "CONNECTED" : "SCAN_QR"}
      </span>
      <span className="hidden text-[10.5px] sm:block" style={{ color: "var(--cl-ink-faint)" }}>{msgs}</span>
    </div>
  );
}

const LOG_LINES: { t: string; cls: string; msg: string }[] = [
  { t: "12:04:11", cls: "cl-t-green",  msg: "✓ session boutique-douala connectée (device :11)" },
  { t: "12:04:12", cls: "",            msg: "→ message reçu de +237 6·· ··· ·79" },
  { t: "12:04:12", cls: "cl-t-green",  msg: "✓ webhook n8n OK (202) — 184 ms" },
  { t: "12:04:15", cls: "cl-t-green",  msg: "✓ réponse IA envoyée (1,2 s)" },
  { t: "12:07:03", cls: "cl-t-orange", msg: "⚠ reconnexion programmée — stream errored" },
  { t: "12:07:05", cls: "cl-t-green",  msg: "✓ session rétablie — 0 message perdu" },
];

function ZeroOpsSection() {
  return (
    <section id="features" className="scroll-mt-24 py-16 md:py-24">
      <div className="cl-container">
        <Reveal>
          <h2 className="cl-h2 mx-auto max-w-[22ch] text-center">
            Déployez des agents IA avec{" "}
            <span style={{ color: "var(--cl-accent)" }}>zéro ops</span>
          </h2>
          <p className="cl-sub mx-auto mt-5 max-w-[52ch] text-center">
            Camille héberge, connecte et surveille tout — vous vous concentrez
            sur vos clients, pas sur la tuyauterie.
          </p>
        </Reveal>

        <div className="mt-12 rounded-2xl p-5 sm:p-7 md:p-9" style={{ background: "var(--cl-bg-soft)" }}>

          <div className="grid gap-5 md:grid-cols-6">
            {/* Hébergement + mots-clés colorés */}
            <Reveal className="md:col-span-4" delay={0.04}>
              <div className="cl-card cl-card-hover h-full p-7">
                <h3 className="cl-h3 max-w-[30ch] !leading-snug">
                  Un hébergement intuitif et des sessions WhatsApp gérées pour{" "}
                  <span className="cl-keyword" style={{ color: "#7C5AF8" }}>réponses IA</span>,{" "}
                  <span className="cl-keyword" style={{ color: "#2E9E63" }}>accueils médias</span>,{" "}
                  <span className="cl-keyword" style={{ color: "#3D77E3" }}>prise de rendez-vous</span>,{" "}
                  <span className="cl-keyword" style={{ color: "#E07A2E" }}>relances</span>,{" "}
                  <span className="cl-keyword" style={{ color: "#E05262" }}>FAQ</span> et{" "}
                  <span className="cl-keyword" style={{ color: "#2A9D8F" }}>multilingue</span>.
                </h3>
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--cl-ink-faint)" }}>
                      Sessions WhatsApp
                    </p>
                    <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                      <Plus className="h-3 w-3" /> Nouvelle session
                    </span>
                  </div>
                  <SessionRow name="boutique-douala" status="ok" msgs="324 msgs / j" />
                  <SessionRow name="clinique-akwa"   status="ok" msgs="141 msgs / j" />
                  <SessionRow name="resto-bonanjo"   status="qr" msgs="—" />
                </div>
              </div>
            </Reveal>

            {/* Reprise humaine */}
            <Reveal className="md:col-span-2" delay={0.1}>
              <div className="cl-card cl-card-hover flex h-full flex-col p-7">
                <h3 className="cl-h3">Une reprise humaine sur chaque conversation</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                  Prenez la main quand ça compte : l&apos;IA se met en pause et vous rend le clavier.
                </p>
                <div className="mt-auto space-y-2 pt-5">
                  <div className="max-w-[90%] rounded-lg rounded-tl-[3px] px-3 py-2 text-[11.5px]" style={{ background: "var(--cl-bg)", color: "var(--cl-ink)" }}>
                    Je préfère parler à un humain 🙏
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                    <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                    Le Dr Ngo a repris la conversation
                  </div>
                  <p className="text-[10.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                    Camille reste silencieuse jusqu&apos;au /release.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Pics de charge — pleine largeur, comme l'autoscaling Render */}
            <Reveal className="md:col-span-6" delay={0.05}>
              <div className="cl-card cl-card-hover h-full p-7">
                <h3 className="cl-h3">Des pics de messages absorbés sans broncher</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                  Promo flash, passage TV, fêtes — files d&apos;attente et quotas
                  encaissent des rafales ×100 sans perdre un seul message.
                </p>
                <div className="relative mt-6">
                  <svg viewBox="0 0 720 150" className="w-full" role="img" aria-label="Courbe de trafic avec pic absorbé" preserveAspectRatio="none" style={{ height: 150 }}>
                    <defs>
                      <linearGradient id="clSpike" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7C5AF8" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#7C5AF8" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[30, 60, 90, 120].map((y) => (
                      <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="rgba(25,23,27,0.06)" strokeWidth="1" />
                    ))}
                    <path
                      d="M0,126 C80,124 140,120 200,114 C260,108 300,102 340,92 C372,84 396,40 424,26 C443,17 462,33 492,68 C526,100 620,112 720,116 L720,150 L0,150 Z"
                      fill="url(#clSpike)"
                    />
                    <path
                      d="M0,126 C80,124 140,120 200,114 C260,108 300,102 340,92 C372,84 396,40 424,26 C443,17 462,33 492,68 C526,100 620,112 720,116"
                      fill="none" stroke="#7C5AF8" strokeWidth="2.5" strokeLinecap="round"
                    />
                    <circle cx="424" cy="26" r="4.5" fill="#7C5AF8" stroke="#fff" strokeWidth="2" />
                  </svg>
                  <span
                    className="absolute rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                    style={{ background: "var(--cl-black)", left: "51%", top: "-2px" }}
                  >
                    pic ×100 absorbé
                  </span>
                </div>
              </div>
            </Reveal>

            {/* Scénarios d'accueil */}
            <Reveal className="md:col-span-3" delay={0.1}>
              <div className="cl-card cl-card-hover h-full p-7">
                <h3 className="cl-h3">Des scénarios d&apos;accueil réglés au millimètre</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                  Message, vidéo, vocal, lien — composez la première impression
                  parfaite pour chaque nouveau contact.
                </p>
                <div className="cl-terminal mt-6 overflow-x-auto p-4">
                  <pre className="whitespace-pre">
{`{`}
{`
  `}<span className="cl-t-key">&quot;accueil&quot;</span>{`: {`}
{`
    `}<span className="cl-t-key">&quot;message&quot;</span>{`: `}<span className="cl-t-green">&quot;Bienvenue chez Boutique Aïcha 👋&quot;</span>{`,`}
{`
    `}<span className="cl-t-key">&quot;video&quot;</span>{`:   `}<span className="cl-t-green">&quot;presentation.mp4&quot;</span>{`,`}
{`
    `}<span className="cl-t-key">&quot;langues&quot;</span>{`: [`}<span className="cl-t-green">&quot;fr&quot;</span>{`, `}<span className="cl-t-green">&quot;en&quot;</span>{`]`}
{`
  },`}
{`
  `}<span className="cl-t-key">&quot;ia&quot;</span>{`: { `}<span className="cl-t-key">&quot;ton&quot;</span>{`: `}<span className="cl-t-green">&quot;chaleureux&quot;</span>{` },`}
{`
  `}<span className="cl-t-key">&quot;reprise_humaine&quot;</span>{`: `}<span className="cl-t-blue">true</span>
{`
}`}
                  </pre>
                </div>
              </div>
            </Reveal>

            {/* Logs & monitoring — pleine largeur, en dernière ligne */}
            <Reveal className="md:order-last md:col-span-6" delay={0.05}>
              <div className="cl-card cl-card-hover h-full p-7">
                <h3 className="cl-h3">Des logs et un monitoring en direct pour chaque session</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                  Connexions, webhooks, réponses IA, reconnexions : tout est tracé
                  seconde par seconde dans votre console.
                </p>
                <div className="cl-terminal mt-6 overflow-x-auto p-4">
                  {LOG_LINES.map((l, i) => (
                    <div key={i} className="flex gap-3 whitespace-nowrap">
                      <span className="cl-t-dim flex-shrink-0">{l.t}</span>
                      <span className={l.cls || undefined}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Base de données */}
            <Reveal className="md:col-span-3" delay={0.1}>
              <div className="cl-card cl-card-hover flex h-full flex-col p-7">
                <h3 className="cl-h3">Contacts &amp; historiques en base sécurisée</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                  Chaque contact, sa langue, son parcours — persistés et isolés par agent.
                </p>
                <div className="mt-auto space-y-1.5 pt-5">
                  {[
                    { n: "Awa N.",  l: "fr", s: "accueillie", ok: true },
                    { n: "John D.", l: "en", s: "accueilli",  ok: true },
                    { n: "Kofi M.", l: "fr", s: "reprise",    ok: false },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px]" style={{ border: "1px solid var(--cl-line-soft)", background: "#fff" }}>
                      <Database className="h-3 w-3 flex-shrink-0" style={{ color: "var(--cl-ink-faint)" }} />
                      <span className="flex-1 font-semibold" style={{ color: "var(--cl-ink)" }}>{r.n}</span>
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink-faint)" }}>{r.l}</span>
                      <span style={{ color: r.ok ? "#22834A" : "#9A7414" }}>{r.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   7 · Témoignage
   ══════════════════════════════════════════════════════════════════════════ */

function TestimonialSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="cl-container">
        <Reveal>
          <div className="mx-auto flex max-w-[720px] flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {CLIENT_MARKS.slice(0, 4).map((m) => (
              <span key={m.name} className="cl-logo" style={{ ...m.style, fontSize: Number(m.style.fontSize) - 2 }}>
                {m.name}
              </span>
            ))}
          </div>

          <blockquote className="mx-auto mt-12 max-w-[880px] text-center">
            <p
              className="text-[clamp(1.45rem,3vw,2.15rem)] font-medium leading-[1.3] tracking-[-0.025em]"
              style={{ color: "var(--cl-ink)" }}
            >
              « Avant Camille, 3 agents traitaient 200 conversations par jour.
              Aujourd&apos;hui, Camille en gère{" "}
              <span style={{ color: "var(--cl-accent-deep)" }}>1 400 seule</span> —
              et nos clients ne voient aucune différence. »
            </p>
          </blockquote>

          <div className="mt-8 flex items-center justify-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#8E6BFA,#6442E8)" }}
            >
              AB
            </span>
            <div className="text-left">
              <p className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Aissatou Balde</p>
              <p className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                Directrice Service Client · Optimus Retail
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   8 · Grille "pensée pour les bâtisseurs"
   ══════════════════════════════════════════════════════════════════════════ */

const BUILDER_FEATURES: { icon: React.ElementType; title: string; desc: string }[] = [
  { icon: Layers,     title: "Sessions multi-numéros",   desc: "Connectez plusieurs numéros WhatsApp et pilotez-les depuis un seul tableau de bord." },
  { icon: Wand2,      title: "No-code de bout en bout",  desc: "Persona, ton, scénarios : tout se configure sans écrire une ligne de code." },
  { icon: Languages,  title: "Multilingue natif",        desc: "Français, anglais et plus — Camille répond dans la langue de chaque client." },
  { icon: ImageIcon,  title: "Médias riches",            desc: "Photos, vidéos, vocaux et documents dans vos parcours d'accueil." },
  { icon: Gauge,      title: "Quotas & usage",           desc: "Suivez la consommation IA de chaque agent, en temps réel." },
  { icon: Webhook,    title: "Webhooks & API",           desc: "Branchez n8n, votre CRM ou n'importe quel outil via l'API Camille Core." },
  { icon: UserCheck,  title: "Reprise humaine",          desc: "Prenez la main sur une conversation à tout moment — l'IA se met en pause." },
  { icon: RefreshCw,  title: "Reconnexion automatique",  desc: "Les sessions se rétablissent seules, sans perdre un seul message." },
];

function BuilderGridSection() {
  return (
    <section className="py-16 md:py-24" style={{ borderTop: "1px solid var(--cl-line-soft)" }}>
      <div className="cl-container">
        <Reveal>
          <h2 className="cl-h2 max-w-[20ch]">Une plateforme intuitive, pensée pour les bâtisseurs.</h2>
          <p className="cl-sub mt-4 max-w-[52ch]">
            Lancez plus vite grâce à des briques intégrées qui font juste… ce qu&apos;elles doivent faire.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {BUILDER_FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={0.04 * i}>
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--cl-accent-soft)" }}>
                  <f.icon className="h-[18px] w-[18px]" style={{ color: "var(--cl-accent-deep)" }} />
                </span>
                <h3 className="mt-4 text-[15.5px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>
                  {f.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                  {f.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   9 · Sécurité
   ══════════════════════════════════════════════════════════════════════════ */

const SECURITY_CARDS: { icon: React.ElementType; title: string; desc: string; badges?: string[] }[] = [
  { icon: Lock,        title: "Chiffrement WhatsApp natif",  desc: "Vos conversations transitent par le chiffrement de WhatsApp, de l'appareil du client à votre agent." },
  { icon: KeyRound,    title: "Clés API dédiées",            desc: "Chaque agent expose sa propre clé, révocable en un clic depuis le dashboard." },
  { icon: Database,    title: "Données isolées",             desc: "Contacts et historiques cloisonnés agent par agent, sans fuite entre comptes.", badges: ["RGPD", "Chiffré", "Isolé"] },
  { icon: ShieldCheck, title: "Contrôle des accès",          desc: "Dashboard protégé, sessions propriétaire authentifiées et rôles séparés." },
  { icon: Filter,      title: "Anti-spam intégré",           desc: "Groupes, statuts et messages indésirables filtrés avant même d'atteindre l'IA." },
  { icon: Activity,    title: "Résilience réseau",           desc: "Reconnexion automatique et files d'attente — zéro message perdu, même en cas d'incident." },
];

function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-24 py-16 md:py-24" style={{ borderTop: "1px solid var(--cl-line-soft)" }}>
      <div className="cl-container">
        <Reveal>
          <h2 className="cl-h2 max-w-[18ch]">Sécurisé et résilient par défaut.</h2>
          <p className="cl-sub mt-4 max-w-[52ch]">
            Développez votre activité, pas votre conformité. Camille s&apos;occupe des fondations.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_CARDS.map((c, i) => (
            <Reveal key={c.title} delay={0.05 * i}>
              <div className="cl-card cl-card-hover h-full p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--cl-bg-soft)" }}>
                  <c.icon className="h-[18px] w-[18px]" style={{ color: "var(--cl-ink)" }} />
                </span>
                <h3 className="mt-4 text-[15.5px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>
                  {c.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                  {c.desc}
                </p>
                {c.badges && (
                  <div className="mt-4 flex gap-2">
                    {c.badges.map((b) => (
                      <span key={b} className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   10 · Terrain de jeu final + CTA
   ══════════════════════════════════════════════════════════════════════════ */

const PLAYGROUND_TILES: { icon: React.ElementType; left: string; top: string; size: number; bg: string; color: string; hideMobile?: boolean }[] = [
  { icon: MessageCircle, left: "4%",  top: "12%", size: 54, bg: "#DCF5E4", color: "#1DAB55" },
  { icon: Store,         left: "13%", top: "58%", size: 46, bg: "#FDECEC", color: "#C2504B", hideMobile: true },
  { icon: Bot,           left: "7%",  top: "80%", size: 58, bg: "#EFEAFF", color: "#7C5AF8" },
  { icon: Stethoscope,   left: "21%", top: "26%", size: 42, bg: "#E7F4EE", color: "#2E9E63", hideMobile: true },
  { icon: Coffee,        left: "27%", top: "74%", size: 44, bg: "#F4EDE6", color: "#8A5A34", hideMobile: true },
  { icon: Languages,     left: "17%", top: "5%",  size: 40, bg: "#EAF1FB", color: "#3E6FB8", hideMobile: true },
  { icon: Gem,           left: "31%", top: "10%", size: 46, bg: "#FBF3DF", color: "#A9822B", hideMobile: true },
  { icon: Plane,         left: "68%", top: "8%",  size: 46, bg: "#E6F5F8", color: "#2E8AA0", hideMobile: true },
  { icon: UtensilsCrossed, left: "78%", top: "22%", size: 52, bg: "#FFF3E0", color: "#C77E28" },
  { icon: Webhook,       left: "89%", top: "10%", size: 44, bg: "#F2ECFB", color: "#7A5BC0", hideMobile: true },
  { icon: Shirt,         left: "84%", top: "52%", size: 46, bg: "#EEF0FA", color: "#5460B4", hideMobile: true },
  { icon: Sparkles,      left: "93%", top: "38%", size: 40, bg: "#EFEAFF", color: "#7C5AF8" },
  { icon: Truck,         left: "74%", top: "78%", size: 50, bg: "#E9F3F1", color: "#33827A", hideMobile: true },
  { icon: Pill,          left: "90%", top: "76%", size: 54, bg: "#EAF7EA", color: "#3E8B3E" },
  { icon: GraduationCap, left: "62%", top: "88%", size: 42, bg: "#EAF1FB", color: "#3E6FB8", hideMobile: true },
  { icon: Scissors,      left: "36%", top: "88%", size: 40, bg: "#FDF0E6", color: "#BE6B33", hideMobile: true },
];

function PlaygroundCta() {
  return (
    <section className="relative overflow-hidden py-28 md:py-40" style={{ borderTop: "1px solid var(--cl-line-soft)" }}>
      {/* Tuiles décoratives */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {PLAYGROUND_TILES.map((t, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: 0.05 + 0.045 * i, ease: [0.34, 1.56, 0.64, 1] }}
            className={`absolute items-center justify-center rounded-2xl ${t.hideMobile ? "hidden md:flex" : "flex"}`}
            style={{
              left: t.left, top: t.top, width: t.size, height: t.size,
              background: t.bg, boxShadow: "0 4px 14px rgba(20,17,11,0.08)",
            }}
          >
            <t.icon style={{ color: t.color, width: t.size * 0.44, height: t.size * 0.44 }} />
          </motion.span>
        ))}
      </div>

      <div className="cl-container relative text-center">
        <Reveal>
          <h2 className="cl-h2 mx-auto max-w-[16ch]">Commencez à bâtir avec Camille.</h2>
          <p className="cl-sub mx-auto mt-5 max-w-[36ch]">
            Zéro code. Zéro ops. Votre agent répond dans cinq minutes.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Link href="/configure" className="cl-btn-black">
              Créer mon agent gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="cl-btn-outline">
              Parler à l&apos;équipe
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   11 · Footer noir
   ══════════════════════════════════════════════════════════════════════════ */

const FOOTER_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités",   href: "/#features" },
      { label: "Comment ça marche", href: "/#how" },
      { label: "Tarifs",            href: "/pricing" },
      { label: "Configurer un agent", href: "/configure" },
      { label: "Dashboard",         href: "/dashboard" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Sécurité",   href: "/#security" },
      { label: "Contact",    href: "/contact" },
      { label: "Support",    href: "mailto:support@buyticle.com" },
      { label: "Politiques", href: "/policies" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos",        href: "/company" },
      { label: "Confidentialité", href: "/privacy" },
      { label: "Conditions",      href: "/terms" },
    ],
  },
];

function LandingFooter() {
  return (
    <footer style={{ background: "var(--cl-black)" }}>
      <div className="cl-container pb-10 pt-16 md:pt-20">
        <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          {/* Marque */}
          <div>
            <Wordmark dark />
            <p className="mt-5 max-w-[30ch] text-[13.5px] leading-relaxed" style={{ color: "rgba(251,247,240,0.55)" }}>
              Créez et déployez des agents IA personnalisés sur WhatsApp.
              No-code. En minutes.
            </p>
            <p className="mt-5 flex items-center gap-2 text-[12.5px]" style={{ color: "rgba(251,247,240,0.45)" }}>
              <span className="cl-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#31C463" }} />
              Tous les systèmes opérationnels
            </p>
            <p className="mt-2 text-[12.5px]" style={{ color: "rgba(251,247,240,0.45)" }}>
              Fait avec passion à Douala, Cameroun 🇨🇲
            </p>
          </div>

          {/* Colonnes de liens */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(251,247,240,0.4)" }}>
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="cl-footer-link">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 flex flex-col items-center justify-between gap-4 pt-7 md:flex-row"
          style={{ borderTop: "1px solid rgba(251,247,240,0.1)" }}
        >
          <p className="text-[12.5px]" style={{ color: "rgba(251,247,240,0.55)" }} suppressHydrationWarning>
            © {new Date().getFullYear()} Buyticle. Tous droits réservés.
          </p>
          <a
            href="https://buyticle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="cl-footer-link inline-flex items-center gap-1.5"
          >
            buyticle.com
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Assemblage
   ══════════════════════════════════════════════════════════════════════════ */

export function Landing() {
  return (
    <div className="cl-landing">
      <AnnouncementBar />
      <LandingNav />
      <Hero />
      <LogoStrip />
      <StepsSection />
      <SectorBand />
      <ZeroOpsSection />
      <TestimonialSection />
      <BuilderGridSection />
      <SecuritySection />
      <PlaygroundCta />
      <LandingFooter />
    </div>
  );
}
