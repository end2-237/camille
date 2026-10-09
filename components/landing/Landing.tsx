// ─────────────────────────────────────────────────────────────────────────────
// components/landing/Landing.tsx — Landing v6 · Camille by Buyticle
//
// La structure de la v5 (hero typographique à curseur, étapes, bande violette,
// bento, briques, sécurité, terrain de jeu, footer noir), passée dans
// l'identité du tableau de bord : le logo en dégradé #A792F4 → #6442E8, les
// formes très arrondies, les boutons pilule, la lavande, les Open Doodles et
// les petites animations à ressort.
//
// Ce qui est annoncé ici est ce que Camille fait AUJOURD'HUI : aucun logo de
// client inventé, aucun témoignage fabriqué, aucune promesse de fonction pas
// encore livrée.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, ArrowUpRight, Check, ShoppingBag, UtensilsCrossed, Shirt, Sparkles,
  Smartphone, Coffee, Gem, Cake, Store, Truck, Mic, UserCheck, BellRing, Users,
  FileText, MapPin, Clock, Package, Layers, Wand2, Languages, Image as ImageIcon,
  Gauge, Webhook, Lock, KeyRound, Database, ShieldCheck, HardDrive, Fingerprint,
  MessageCircle, Plus, Minus, Wallet,
} from "lucide-react";
import { Doodle, type NomDoodle } from "@/components/dashboard/Doodle";
import { MarqueCamille, TuileCamille } from "@/components/brand/LogoCamille";
import { TelephoneWhatsApp, TelephoneCarrousel } from "./TelephoneWhatsApp";
import "./landing.css";

/* ══════════════════════════════════════════════════════════════════════════════
   Utilitaires
   ══════════════════════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Ce qu'on peut dire de notre lien avec Meta. « Partenaire Meta » est un
 * statut que Meta accorde (programme Meta Business Partners) : tant qu'il
 * n'est pas obtenu, on dit ce qui est vrai — Camille est construite sur
 * l'API officielle WhatsApp Business de Meta. Le jour où le badge est
 * accordé, il suffit de passer `partenaire` à true.
 */
const STATUT_META = (() => {
  const partenaire = false;
  return partenaire
    ? { badge: "Partenaire Meta · API officielle", bande: "Partenaire Meta", sous: "Camille est partenaire Meta et passe par l'API officielle WhatsApp Business." }
    : { badge: "API officielle WhatsApp Business", bande: "Construite sur la plateforme officielle de Meta", sous: "Pas une application détournée : l'API WhatsApp Business de Meta, celle des grandes marques." };
})();
const RESSORT = { type: "spring", stiffness: 320, damping: 30 } as const;

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

/** Une puce d'icône lavande, comme les tuiles du tableau de bord. */
function Puce({ icon: Icon, fort = false }: { icon: React.ElementType; fort?: boolean }) {
  return (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: fort ? "var(--cl-ink)" : "var(--cl-accent-soft)", color: fort ? "#fff" : "var(--cl-accent-deep)" }}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 · Hero — typographie géante + frappe animée + conversation WhatsApp
   ══════════════════════════════════════════════════════════════════════════ */

const TYPED_WORDS = ["boutique", "restaurant", "pâtisserie", "friperie", "épicerie"];

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

/** La notification « ka-ching » qui arrive chez le commerçant. */
function NotifCommande() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...RESSORT, delay: 8 }}
      className="flex w-[250px] items-center gap-3 rounded-[22px] bg-white/90 px-3.5 py-3 backdrop-blur"
      style={{ boxShadow: "0 18px 40px rgba(70,40,190,0.18)" }}
    >
      <TuileCamille taille={36} />
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>Nouvelle commande 💸</p>
        <p className="truncate text-[11.5px]" style={{ color: "var(--cl-ink-soft)" }}>CMD-2410 · 46 000 FCFA · livraison</p>
      </div>
    </motion.div>
  );
}

function Hero() {
  const typed = useTypewriter(TYPED_WORDS);

  return (
    <section className="relative overflow-hidden">
      {/* Le ciel lavande du tableau de bord, qui se fond dans le blanc */}
      <div className="cl-ciel pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="cl-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="cl-container relative grid items-center gap-14 pb-20 pt-10 md:pb-24 md:pt-16 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <span className="cl-rise inline-flex items-center gap-2.5 rounded-full bg-white/80 py-1.5 pl-2 pr-4 text-[12.5px] font-medium backdrop-blur"
            style={{ color: "var(--cl-ink-soft)", boxShadow: "0 0 0 1px rgba(255,255,255,0.9) inset, 0 4px 14px rgba(70,40,190,0.08)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/whatsapp.svg" alt="WhatsApp" className="h-6 w-6" />
            <span>{STATUT_META.badge}</span>
            <span className="h-3.5 w-px" style={{ background: "var(--cl-line)" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/meta.svg" alt="Meta" className="h-[13px] w-auto" />
          </span>

          <h1 className="cl-h1 cl-rise cl-rise-1 mt-6" aria-label="Une vendeuse WhatsApp pour votre commerce">
            <span aria-hidden="true">
              Une vendeuse
              <br />
              WhatsApp pour
              <br />
              votre <span className="cl-degrade">{typed}</span>
              <span className="cl-caret" />
            </span>
          </h1>

          <p className="cl-sub cl-rise cl-rise-2 mt-6 max-w-[46ch]">
            Jour et nuit, Camille montre vos articles, remplit le panier, vérifie le stock,
            prend l&apos;adresse et confirme la commande — pendant que vous, vous
            préparez les colis.
          </p>

          <div className="cl-rise cl-rise-3 mt-8 flex flex-wrap items-center gap-3">
            <Link href="/configure" className="cl-btn-black">
              Créer ma vendeuse gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="cl-btn-outline">
              Voir les tarifs
            </Link>
          </div>

          <ul className="cl-rise cl-rise-4 mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>
            {["Prête en 5 minutes", "Sans code", "Paiement en FCFA"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" style={{ color: "var(--cl-accent-deep)" }} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="cl-rise cl-rise-4 relative">
          <Doodle nom="selfie" className="cl-flotte pointer-events-none absolute -left-24 bottom-6 hidden h-[190px] w-auto xl:block" />
          <TelephoneWhatsApp />
          <div className="absolute -bottom-6 left-1/2 hidden translate-x-[-10%] sm:block">
            <NotifCommande />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 bis · Meta — l'API officielle, pas de bannissement
   ══════════════════════════════════════════════════════════════════════════ */

const GARANTIES_META: { titre: string; texte: string }[] = [
  { titre: "Pas de bannissement", texte: "Votre numéro n'est pas branché sur une application détournée : aucun risque d'être bloqué pour usage non autorisé." },
  { titre: "Aucun téléphone à laisser allumé", texte: "Camille répond depuis les serveurs de Meta, même quand votre téléphone est éteint ou hors réseau." },
  { titre: "Les vrais outils de WhatsApp", texte: "Catalogue, fiches produit, panier, boutons : ce que vos clients voient, ce sont les composants officiels." },
];

function MetaBand() {
  return (
    <section className="pb-16 pt-2 md:pb-20">
      <div className="cl-container">
        <Reveal>
          <div className="rounded-[32px] px-6 py-9 md:px-12 md:py-12" style={{ background: "#F6F4FA" }}>
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-[560px]">
                <h2 className="cl-h3 !text-[clamp(1.5rem,2.6vw,2rem)] !leading-[1.15]">{STATUT_META.bande}</h2>
                <p className="mt-3 max-w-[48ch] text-[14.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{STATUT_META.sous}</p>
              </div>
              <div className="flex items-center gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/meta.svg" alt="Meta" className="h-9 w-auto md:h-11" />
                <span className="h-10 w-px" style={{ background: "#DCD7E6" }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/whatsapp.svg" alt="WhatsApp" className="h-11 w-11 md:h-14 md:w-14" />
              </div>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 md:gap-4">
              {GARANTIES_META.map((g, i) => (
                <motion.div key={g.titre}
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ ...RESSORT, delay: 0.06 * i }}
                  className="rounded-[24px] bg-white p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "#E4F6EA", color: "#1E7A3A" }}>
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>{g.titre}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{g.texte}</p>
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
   4 bis · Pensée pour vendre au Cameroun et en Afrique
   ══════════════════════════════════════════════════════════════════════════ */

const ICI: { icon: React.ElementType; titre: string; texte: string; exemple: string }[] = [
  { icon: MapPin,    titre: "Les adresses comme on les donne ici", texte: "Pas de code postal : un quartier et un repère suffisent. Ou la position partagée.", exemple: "« Bonamoussadi, derrière la pharmacie »" },
  { icon: Mic,       titre: "Vos clients parlent, elle écoute",    texte: "Beaucoup préfèrent le vocal à l'écrit. Camille comprend la note vocale et répond.", exemple: "🎤 0:07" },
  { icon: Languages, titre: "Français et anglais",                 texte: "Un pays bilingue, une vendeuse bilingue : elle répond dans la langue du client.", exemple: "« Do you have it in black? »" },
  { icon: Wallet,    titre: "Tout en FCFA",                        texte: "Prix, paniers, bons de commande. Et votre abonnement se paie par Mobile Money ou en agence.", exemple: "45 000 FCFA" },
  { icon: Truck,     titre: "La livraison à moto, suivie",         texte: "Vos livreurs ont leur application ; le client voit qui arrive et l'appelle d'un geste.", exemple: "« Jean-Paul est en route »" },
  { icon: Clock,     titre: "Vos horaires, vos fermetures",        texte: "Hors des heures d'ouverture, Camille le dit et propose de commander pour la réouverture.", exemple: "« On ouvre demain à 8 h »" },
];

function AfriqueSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="cl-container">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <p className="cl-kicker">Fait à Douala 🇨🇲</p>
            <h2 className="cl-h2 mt-3 max-w-[18ch]">Pensée pour vendre au Cameroun et en Afrique.</h2>
            <p className="cl-sub mt-4 max-w-[54ch]">
              Pas un outil américain traduit à la va-vite : Camille connaît la
              façon dont on achète ici, sur WhatsApp, avec un vocal et un repère.
            </p>
          </Reveal>
          <Doodle nom="sitting-reading" className="cl-flotte hidden h-[130px] w-auto md:block" />
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
          {ICI.map((c, i) => (
            <Reveal key={c.titre} delay={0.05 * i}>
              <div className="cl-card cl-card-hover flex h-full flex-col p-6">
                <Puce icon={c.icon} />
                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>{c.titre}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{c.texte}</p>
                <span className="mt-auto self-start pt-4">
                  <span className="inline-block rounded-[14px] rounded-tl-[4px] px-3 py-1.5 text-[12.5px]" style={{ background: "#D9FDD3", color: "#111B21" }}>
                    {c.exemple}
                  </span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   2 · Bande « pensé pour » — les commerces que Camille sert déjà
   ══════════════════════════════════════════════════════════════════════════ */

const COMMERCES: { icon: React.ElementType; label: string }[] = [
  { icon: Shirt,           label: "Mode & wax" },
  { icon: Sparkles,        label: "Cosmétique" },
  { icon: Smartphone,      label: "Électronique" },
  { icon: UtensilsCrossed, label: "Restaurant" },
  { icon: Cake,            label: "Pâtisserie" },
  { icon: Coffee,          label: "Traiteur & café" },
  { icon: Gem,             label: "Bijoux & accessoires" },
  { icon: Store,           label: "Boutique en ligne" },
];

function CommercesStrip() {
  return (
    <section className="pb-16 pt-4 md:pb-24">
      <div className="cl-container">
        <Reveal>
          <p className="cl-kicker text-center">Pensée pour les commerces qui vendent sur WhatsApp</p>
          <div className="mx-auto mt-7 flex max-w-[920px] flex-wrap items-center justify-center gap-2.5">
            {COMMERCES.map((c, i) => (
              <motion.span
                key={c.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...RESSORT, delay: 0.035 * i }}
                className="inline-flex items-center gap-2 rounded-full py-2 pl-2 pr-4 text-[13.5px] font-medium"
                style={{ background: "#F6F4FA", color: "var(--cl-ink)" }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white" style={{ color: "var(--cl-accent-deep)" }}>
                  <c.icon className="h-3.5 w-3.5" />
                </span>
                {c.label}
              </motion.span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   3 · « Clic, clic, en vente. » — 3 étapes, chacune avec son doodle
   ══════════════════════════════════════════════════════════════════════════ */

function Etape({ n, titre, texte, doodle, children, delai }: {
  n: number; titre: string; texte: string; doodle: NomDoodle; children: React.ReactNode; delai: number;
}) {
  return (
    <Reveal delay={delai}>
      <div className="cl-card cl-card-hover flex h-full flex-col overflow-hidden">
        <div className="relative flex h-[150px] items-end justify-center" style={{ background: "var(--cl-lilas-doux)" }}>
          <span className="absolute left-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold text-white"
            style={{ background: "var(--cl-ink)" }}>
            {n}
          </span>
          <Doodle nom={doodle} className="cl-flotte h-[138px] w-auto" />
        </div>
        <div className="flex flex-1 flex-col p-6">
          <h3 className="cl-h3">{titre}</h3>
          <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{texte}</p>
          <div className="mt-auto pt-5">{children}</div>
        </div>
      </div>
    </Reveal>
  );
}

function Ligne({ icon: Icon, label, actif = false }: { icon: React.ElementType; label: string; actif?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-full px-3 py-2"
      style={{ background: actif ? "var(--cl-accent-soft)" : "#F7F6FA" }}>
      <Icon className="h-4 w-4" style={{ color: actif ? "var(--cl-accent-deep)" : "var(--cl-ink-faint)" }} />
      <span className="flex-1 text-[12.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</span>
      {actif && <Check className="h-4 w-4" style={{ color: "var(--cl-accent-deep)" }} />}
    </div>
  );
}

function StepsSection() {
  return (
    <section id="how" className="scroll-mt-24 py-16 md:py-24">
      <div className="cl-container">
        <Reveal>
          <h2 className="cl-h2">Clic, clic, en vente.</h2>
          <p className="cl-sub mt-4 max-w-[52ch]">
            Pas de code, pas de serveur, pas d&apos;intégration interminable.
            Votre vendeuse répond sur votre numéro WhatsApp Business en quelques minutes.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Etape n={1} delai={0.05} doodle="reading" titre="Décrivez votre commerce"
            texte="Votre métier, votre nom, le ton à prendre avec vos clients. Camille en fait une vendeuse qui parle comme vous.">
            <div className="space-y-2">
              <Ligne icon={ShoppingBag} label="Boutique & e-commerce" actif />
              <Ligne icon={UtensilsCrossed} label="Restaurant & traiteur" />
            </div>
          </Etape>

          <Etape n={2} delai={0.13} doodle="sitting-reading" titre="Connectez votre WhatsApp"
            texte="Un bouton, votre compte Facebook, votre numéro : c'est l'API officielle de Meta, sans téléphone à laisser allumé.">
            <div className="flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-white" style={{ background: "#1877F2" }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] font-bold" style={{ color: "#1877F2" }}>f</span>
              Continuer avec Facebook
            </div>
          </Etape>

          <Etape n={3} delai={0.21} doodle="unboxing" titre="Ajoutez vos articles"
            texte="Photos, prix, stock, variantes. Ils partent dans votre catalogue WhatsApp et Camille commence à vendre.">
            <div className="space-y-2">
              <Ligne icon={Package} label="Catalogue synchronisé avec Meta" actif />
              <Ligne icon={Layers} label="Couleurs & tailles" actif />
            </div>
          </Etape>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   3 bis · Le carrousel — un second téléphone, incliné
   ══════════════════════════════════════════════════════════════════════════ */

function CarrouselSection() {
  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <div className="cl-container grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal>
          <p className="cl-kicker">Le catalogue dans la conversation</p>
          <h2 className="cl-h2 mt-3 max-w-[15ch]">Votre vitrine, à portée de pouce.</h2>
          <p className="cl-sub mt-5 max-w-[46ch]">
            « Vous avez quoi comme nouveautés ? » Camille répond avec un
            carrousel : vos photos, vos prix, et le bouton pour ajouter au
            panier. Le client fait défiler, choisit, commande — sans quitter
            WhatsApp.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              "Une fiche quand il demande un article précis",
              "Un carrousel jusqu'à 10 articles, une liste par catégorie au-delà",
              "Seulement ce qui est en stock, au bon prix",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[14.5px]" style={{ color: "var(--cl-ink)" }}>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                  <Check className="h-3.5 w-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative flex justify-center py-6" style={{ perspective: "1800px" }}>
            <div className="absolute inset-x-6 bottom-0 top-10 rounded-[48px]" style={{ background: "linear-gradient(160deg,#A792F4 0%,#D6CCFB 100%)" }} aria-hidden="true" />
            <Doodle nom="unboxing" className="cl-flotte pointer-events-none absolute -left-4 bottom-2 z-10 hidden h-[120px] w-auto md:block" />
            <div className="cl-incline relative origin-center scale-[0.86] sm:scale-100">
              <TelephoneCarrousel />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   4 · Bande violette — le parcours d'achat
   ══════════════════════════════════════════════════════════════════════════ */

const PARCOURS: { icon: React.ElementType; label: string }[] = [
  { icon: MessageCircle, label: "Question" },
  { icon: ShoppingBag,   label: "Catalogue" },
  { icon: Package,       label: "Panier" },
  { icon: MapPin,        label: "Adresse" },
  { icon: FileText,      label: "Bon de commande" },
  { icon: Truck,         label: "Livraison" },
];

function ParcoursBand() {
  return (
    <section className="py-6">
      <div className="cl-container">
        <Reveal>
          <div className="cl-band relative grid items-center gap-12 overflow-hidden rounded-[32px] px-7 py-14 md:grid-cols-[1fr_1.05fr] md:px-14 md:py-20">
            <div className="relative">
              <h2 className="cl-h2 max-w-[15ch] !text-white">
                De «&nbsp;c&apos;est combien&nbsp;?&nbsp;» à la livraison.
              </h2>
              <p className="cl-sub mt-5 max-w-[42ch]" style={{ color: "rgba(255,255,255,0.86)" }}>
                Tout le parcours d&apos;achat se fait dans la conversation. Votre client
                ne quitte jamais WhatsApp, et vous ne recopiez plus rien à la main.
              </p>
              <div className="mt-9">
                <Link href="/configure" className="cl-btn-white">
                  Essayer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PARCOURS.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.7 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ ...RESSORT, delay: 0.06 * i }}
                    className="flex flex-col items-center gap-2.5 rounded-[22px] bg-white px-3 py-5 text-center"
                    style={{ boxShadow: "0 10px 24px rgba(40,20,110,0.16)" }}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="text-[12.5px] font-medium" style={{ color: "var(--cl-ink)" }}>
                      <span className="mr-1 tabular-nums" style={{ color: "var(--cl-ink-faint)" }}>{i + 1}.</span>
                      {s.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   5 · Bento — ce que Camille fait vraiment
   ══════════════════════════════════════════════════════════════════════════ */

function Carte({ className, delai = 0, children }: { className?: string; delai?: number; children: React.ReactNode }) {
  return (
    <Reveal className={className} delay={delai}>
      <div className="cl-card cl-card-hover flex h-full flex-col p-7">{children}</div>
    </Reveal>
  );
}

function TitreCarte({ icon, titre, texte }: { icon: React.ElementType; titre: string; texte: string }) {
  return (
    <>
      <Puce icon={icon} />
      <h3 className="cl-h3 mt-5">{titre}</h3>
      <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{texte}</p>
    </>
  );
}

function StockDemo() {
  const lignes = [
    { nom: "Robe wax Ndop", stock: 1, max: 12 },
    { nom: "Sac cuir Mbalmayo", stock: 4, max: 12 },
    { nom: "Sandales tressées", stock: 11, max: 12 },
  ];
  return (
    <div className="mt-6 space-y-2.5">
      {lignes.map((l) => {
        const bas = l.stock <= 5;
        return (
          <div key={l.nom} className="rounded-[18px] px-4 py-3" style={{ background: "#F7F6FA" }}>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="font-medium" style={{ color: "var(--cl-ink)" }}>{l.nom}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: bas ? "#FDF1DC" : "#E4F6EA", color: bas ? "#9A6510" : "#1E7A3A" }}>
                {l.stock} en stock
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${(l.stock / l.max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: EASE }}
                className="h-full rounded-full"
                style={{ background: bas ? "#E3A33B" : "var(--cl-accent)" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OptionsDemo() {
  return (
    <div className="mt-6 rounded-[20px] p-4" style={{ background: "#F7F6FA" }}>
      <p className="text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>Poulet DG × 2 — accompagnement ?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Plantain mûr", "Frites", "Miondo +500"].map((o, i) => (
          <span key={o} className="rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={i === 0 ? { background: "var(--cl-ink)", color: "#fff" } : { background: "#fff", color: "var(--cl-ink)" }}>
            {o}
          </span>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>
        <Clock className="h-3.5 w-3.5" /> Pour ce soir, 20 h 30
      </p>
    </div>
  );
}

function LivreurDemo() {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-[20px] p-4" style={{ background: "#F7F6FA" }}>
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: "var(--cl-accent)" }}>
        JP
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>Jean-Paul est en route</p>
        <p className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>Position mise à jour il y a 2 min</p>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: "var(--cl-accent-deep)" }}>
        <MapPin className="h-4 w-4" />
      </span>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 py-16 md:py-24">
      <div className="cl-container">
        <Reveal>
          <h2 className="cl-h2 mx-auto max-w-[20ch] text-center">
            Une vendeuse qui connaît <span className="cl-degrade">votre stock</span>
          </h2>
          <p className="cl-sub mx-auto mt-5 max-w-[52ch] text-center">
            Camille ne promet jamais ce que vous n&apos;avez pas. Elle lit votre
            catalogue, votre stock et vos horaires avant de répondre.
          </p>
        </Reveal>

        <div className="mt-12 rounded-[32px] p-4 sm:p-6 md:p-8" style={{ background: "#F6F4FA" }}>
          <div className="grid gap-4 md:grid-cols-6 md:gap-5">
            <Carte className="md:col-span-3" delai={0.04}>
              <TitreCarte icon={Package} titre="Le stock, vérifié à chaque panier"
                texte="Article épuisé : retiré du panier. Plus que deux : le client le sait, photo à l'appui. Et chaque vente met votre catalogue WhatsApp à jour." />
              <StockDemo />
            </Carte>

            <Carte className="md:col-span-3" delai={0.1}>
              <TitreCarte icon={UtensilsCrossed} titre="Le mode restaurant"
                texte="Accompagnements, sauces, suppléments payants, créneaux de service. Restaurant fermé ? Camille prend la commande pour l'ouverture." />
              <OptionsDemo />
            </Carte>

            <Carte className="md:col-span-2" delai={0.04}>
              <TitreCarte icon={FileText} titre="Bon de commande en PDF"
                texte="À chaque commande, le client reçoit son bon de commande dans la conversation." />
            </Carte>

            <Carte className="md:col-span-2" delai={0.08}>
              <TitreCarte icon={Mic} titre="Elle écoute les vocaux"
                texte="Votre client préfère parler ? Camille comprend la note vocale et répond par écrit." />
            </Carte>

            <Carte className="md:col-span-2" delai={0.12}>
              <TitreCarte icon={BellRing} titre="Le bruit de la caisse"
                texte="Chaque commande arrive sur votre téléphone avec son petit « ka-ching »." />
            </Carte>

            <Carte className="md:col-span-3" delai={0.04}>
              <TitreCarte icon={Truck} titre="Vos livreurs, suivis en direct"
                texte="Chaque livreur a son application. Le client touche « Mon livreur » et voit qui arrive, avec son numéro et sa position." />
              <LivreurDemo />
            </Carte>

            <Carte className="md:col-span-3" delai={0.1}>
              <TitreCarte icon={UserCheck} titre="Vous reprenez la main quand il faut"
                texte="Un souci, une réclamation, une négociation : Camille passe la main, se tait, et vous prévient tout de suite." />
              <div className="mt-6 space-y-2">
                <div className="max-w-[86%] rounded-[16px] rounded-tl-[5px] px-3 py-2 text-[12.5px]" style={{ background: "#F7F6FA", color: "var(--cl-ink)" }}>
                  J&apos;ai un souci avec ma commande 🙏
                </div>
                <div className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-medium" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                  <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                  Un conseiller prend la suite dans cette conversation
                </div>
              </div>
            </Carte>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   6 · Le tableau de bord — à la place d'un témoignage inventé
   ══════════════════════════════════════════════════════════════════════════ */

function TableauDeBordSection() {
  const barres = [34, 48, 41, 63, 57, 72, 66, 88, 79, 94, 86, 100];
  return (
    <section className="py-16 md:py-24">
      <div className="cl-container grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <h2 className="cl-h2 max-w-[15ch]">Votre commerce, d&apos;un coup d&apos;œil.</h2>
          <p className="cl-sub mt-5 max-w-[44ch]">
            Les commandes du jour, ce qui part en livraison, ce qui manque en
            rayon, ce que disent vos clients. Sur ordinateur, sur téléphone, ou
            installé sur l&apos;écran d&apos;accueil comme une application.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              { icon: Users,  t: "Votre équipe, avec des rôles : propriétaire, gérant, vendeur" },
              { icon: Store,  t: "Plusieurs commerces dans un seul compte" },
              { icon: Gauge,  t: "Votre consommation et votre forfait, en clair" },
            ].map((l) => (
              <li key={l.t} className="flex items-center gap-3 text-[14.5px]" style={{ color: "var(--cl-ink)" }}>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                  <l.icon className="h-4 w-4" />
                </span>
                {l.t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative rounded-[32px] p-4 sm:p-6" style={{ background: "linear-gradient(160deg,#A792F4 0%,#BFAFF8 55%,#D6CCFB 100%)" }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-white">
                <TuileCamille taille={28} />
                <span className="text-[15px] font-bold" style={{ fontFamily: "var(--font-good-timing)" }}>Camille</span>
              </span>
              <span className="rounded-full bg-white/25 px-3 py-1 text-[11.5px] font-medium text-white">Aujourd&apos;hui</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] p-4" style={{ background: "var(--cl-ink)" }}>
                <p className="text-[12px] text-white/70">Ventes livrées</p>
                <p className="mt-2 text-[26px] font-light leading-none tracking-[-0.03em] text-white tabular-nums">184 500</p>
                <p className="mt-1 text-[11.5px] text-white/60">FCFA · 11 commandes</p>
              </div>
              <div className="rounded-[24px] bg-white p-4">
                <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>À préparer</p>
                <p className="mt-2 text-[26px] font-light leading-none tracking-[-0.03em] tabular-nums" style={{ color: "var(--cl-ink)" }}>4</p>
                <p className="mt-1 text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>dont 2 en livraison</p>
              </div>
              <div className="col-span-2 rounded-[24px] bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Conversations, 12 derniers jours</p>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "#E4F6EA", color: "#1E7A3A" }}>en hausse</span>
                </div>
                <div className="mt-3 flex h-[88px] items-end gap-1.5">
                  {barres.map((h, i) => (
                    <motion.span
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.03 * i, ease: EASE }}
                      className="flex-1 rounded-[7px]"
                      style={{ background: i >= barres.length - 3 ? "var(--cl-accent)" : "var(--cl-lavender)" }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Doodle nom="laying" className="cl-flotte pointer-events-none absolute -bottom-16 -left-24 hidden h-[100px] w-auto xl:block" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   7 · Les briques
   ══════════════════════════════════════════════════════════════════════════ */

const BRIQUES: { icon: React.ElementType; title: string; desc: string }[] = [
  { icon: Wand2,     title: "Sans code, de bout en bout", desc: "Métier, ton, accueil, catalogue : tout se règle depuis le tableau de bord." },
  { icon: Languages, title: "Français et anglais",        desc: "Camille répond dans la langue de chaque client." },
  { icon: ImageIcon, title: "Photos et variantes",        desc: "Plusieurs photos par article, couleurs et tailles avec leur propre image." },
  { icon: MapPin,    title: "Adresse sans prise de tête", desc: "Position partagée, ou « quartier + repère » quand le client écrit depuis un ordinateur." },
  { icon: Clock,     title: "Horaires respectés",          desc: "Fermé ? Camille le dit, et propose de commander pour l'ouverture." },
  { icon: Webhook,   title: "API pour votre site",        desc: "Votre site web envoie ses commandes au même endroit que WhatsApp." },
  { icon: Users,     title: "Équipe et rôles",            desc: "Invitez gérants et vendeurs ; chacun voit ce qu'il doit voir." },
  { icon: BellRing,  title: "Notifications",              desc: "Sur l'application mobile et sur le web installé sur l'écran d'accueil." },
];

function BriquesSection() {
  return (
    <section className="py-16 md:py-24" style={{ borderTop: "1px solid var(--cl-line-soft)" }}>
      <div className="cl-container">
        <Reveal>
          <h2 className="cl-h2 max-w-[20ch]">Tout ce qu&apos;il faut, rien de compliqué.</h2>
          <p className="cl-sub mt-4 max-w-[52ch]">
            Des briques déjà prêtes, qui font juste ce qu&apos;elles doivent faire.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {BRIQUES.map((f, i) => (
            <Reveal key={f.title} delay={0.04 * i}>
              <div>
                <Puce icon={f.icon} />
                <h3 className="mt-4 text-[15.5px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   8 · Sécurité — ce qui est réellement en place
   ══════════════════════════════════════════════════════════════════════════ */

const SECURITE: { icon: React.ElementType; title: string; desc: string }[] = [
  { icon: MessageCircle, title: "API officielle de Meta",        desc: "Votre numéro passe par la plateforme WhatsApp Business de Meta, pas par une application détournée : pas de bannissement pour usage non autorisé." },
  { icon: KeyRound,      title: "Jetons Meta chiffrés",           desc: "Les accès à votre compte WhatsApp sont chiffrés en base ; ils ne s'affichent jamais en clair." },
  { icon: Database,      title: "Données isolées",                desc: "Clients, commandes et conversations sont cloisonnés commerce par commerce." },
  { icon: Fingerprint,   title: "Accès maîtrisés",                desc: "E-mail vérifié, tentatives de connexion limitées, rôles d'équipe séparés." },
  { icon: Lock,          title: "Messages vérifiés",              desc: "Chaque message reçu de Meta est authentifié par sa signature avant d'être traité." },
  { icon: HardDrive,     title: "Sauvegardes chiffrées",          desc: "Une sauvegarde complète chaque nuit, chiffrée, hors du serveur." },
];

function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-24 py-16 md:py-24" style={{ borderTop: "1px solid var(--cl-line-soft)" }}>
      <div className="cl-container">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <h2 className="cl-h2 max-w-[18ch]">Sérieuse avec vos données.</h2>
            <p className="cl-sub mt-4 max-w-[52ch]">
              Développez votre commerce, pas votre informatique. Camille s&apos;occupe des fondations.
            </p>
          </Reveal>
          <Doodle nom="meditating" className="cl-flotte hidden h-[120px] w-auto md:block" />
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITE.map((c, i) => (
            <Reveal key={c.title} delay={0.05 * i}>
              <div className="cl-card cl-card-hover h-full p-6">
                <Puce icon={c.icon} fort />
                <h3 className="mt-4 text-[15.5px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>{c.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   9 · FAQ courte
   ══════════════════════════════════════════════════════════════════════════ */

const FAQ: { q: string; r: string }[] = [
  { q: "Faut-il un téléphone allumé en permanence ?", r: "Non. Camille passe par l'API officielle de WhatsApp Business : votre numéro fonctionne même téléphone éteint." },
  { q: "Mes clients savent-ils qu'ils parlent à une IA ?", r: "Camille se présente au nom de votre commerce et passe la main à un humain dès que la demande le mérite : réclamation, négociation, question délicate." },
  { q: "Comment je paie ?", r: "En FCFA, par Mobile Money, ou en agence. Vous commencez gratuitement, sans carte bancaire." },
  { q: "Et si un article n'est plus en stock ?", r: "Camille le retire du panier et prévient le client, photo à l'appui. Elle ne vend jamais ce que vous n'avez pas." },
];

function FaqSection() {
  const [ouvert, setOuvert] = useState<number | null>(0);
  return (
    <section className="py-16 md:py-24" style={{ borderTop: "1px solid var(--cl-line-soft)" }}>
      <div className="cl-container grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <h2 className="cl-h2 max-w-[12ch]">Les questions qu&apos;on nous pose.</h2>
          <Doodle nom="float" className="cl-flotte mt-8 hidden h-[150px] w-auto lg:block" />
        </Reveal>
        <div className="space-y-3">
          {FAQ.map((f, i) => {
            const actif = ouvert === i;
            return (
              <Reveal key={f.q} delay={0.04 * i}>
                <div className="rounded-[24px] transition-colors" style={{ background: actif ? "#F6F4FA" : "#fff", boxShadow: actif ? "none" : "inset 0 0 0 1px var(--cl-line)" }}>
                  <button type="button" onClick={() => setOuvert(actif ? null : i)} aria-expanded={actif}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                    <span className="text-[15.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{f.q}</span>
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: actif ? "var(--cl-ink)" : "#F4F2F7", color: actif ? "#fff" : "var(--cl-ink)" }}>
                      {actif ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                  {actif && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={RESSORT}
                      className="px-6 pb-5 text-[14.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
                      {f.r}
                    </motion.p>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   10 · Terrain de jeu final + CTA
   ══════════════════════════════════════════════════════════════════════════ */

const TUILES: { icon: React.ElementType; left: string; top: string; size: number; hideMobile?: boolean }[] = [
  { icon: MessageCircle,   left: "5%",  top: "14%", size: 54 },
  { icon: ShoppingBag,     left: "15%", top: "60%", size: 46, hideMobile: true },
  { icon: Package,         left: "8%",  top: "82%", size: 56 },
  { icon: Shirt,           left: "24%", top: "24%", size: 42, hideMobile: true },
  { icon: Truck,           left: "72%", top: "10%", size: 46, hideMobile: true },
  { icon: UtensilsCrossed, left: "82%", top: "26%", size: 52 },
  { icon: BellRing,        left: "91%", top: "62%", size: 44, hideMobile: true },
  { icon: Sparkles,        left: "88%", top: "84%", size: 54 },
  { icon: MapPin,          left: "64%", top: "86%", size: 42, hideMobile: true },
];

function PlaygroundCta() {
  return (
    <section className="relative overflow-hidden py-28 md:py-40" style={{ borderTop: "1px solid var(--cl-line-soft)" }}>
      <div className="cl-ciel cl-ciel-bas pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {TUILES.map((t, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: 0.05 + 0.045 * i, ease: [0.34, 1.56, 0.64, 1] }}
            className={`absolute items-center justify-center rounded-full bg-white ${t.hideMobile ? "hidden md:flex" : "flex"}`}
            style={{ left: t.left, top: t.top, width: t.size, height: t.size, boxShadow: "0 10px 24px rgba(70,40,190,0.14)" }}
          >
            <t.icon style={{ color: "var(--cl-accent-deep)", width: t.size * 0.42, height: t.size * 0.42 }} />
          </motion.span>
        ))}
        <Doodle nom="levitate" className="cl-flotte absolute bottom-6 left-[16%] hidden h-[110px] w-auto lg:block" />
      </div>

      <div className="cl-container relative text-center">
        <Reveal>
          <TuileCamille taille={64} className="mx-auto" />
          <h2 className="cl-h2 mx-auto mt-7 max-w-[16ch]">Votre prochaine vente arrive sur WhatsApp.</h2>
          <p className="cl-sub mx-auto mt-5 max-w-[38ch]">
            Laissez Camille y répondre. Gratuit pour commencer, prête en cinq minutes.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Link href="/configure" className="cl-btn-black">
              Créer ma vendeuse gratuitement
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
      { label: "Fonctionnalités",     href: "/#features" },
      { label: "Comment ça marche",   href: "/#how" },
      { label: "Tarifs",              href: "/pricing" },
      { label: "Créer ma vendeuse",   href: "/configure" },
      { label: "Tableau de bord",     href: "/dashboard" },
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
          <div>
            <MarqueCamille sombre sous />
            <p className="mt-5 max-w-[30ch] text-[13.5px] leading-relaxed" style={{ color: "rgba(251,247,240,0.55)" }}>
              La vendeuse WhatsApp des commerces qui grandissent. Sans code, en cinq minutes.
            </p>
            <p className="mt-5 text-[12.5px]" style={{ color: "rgba(251,247,240,0.45)" }}>
              Fait avec passion à Douala, Cameroun 🇨🇲
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(251,247,240,0.4)" }}>{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}><Link href={l.href} className="cl-footer-link">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 pt-7 md:flex-row" style={{ borderTop: "1px solid rgba(251,247,240,0.1)" }}>
          <p className="text-[12.5px]" style={{ color: "rgba(251,247,240,0.55)" }} suppressHydrationWarning>
            © {new Date().getFullYear()} Buyticle. Tous droits réservés.
          </p>
          <a href="https://buyticle.com" target="_blank" rel="noopener noreferrer" className="cl-footer-link inline-flex items-center gap-1.5">
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
      <Hero />
      <MetaBand />
      <CommercesStrip />
      <StepsSection />
      <CarrouselSection />
      <ParcoursBand />
      <AfriqueSection />
      <FeaturesSection />
      <TableauDeBordSection />
      <BriquesSection />
      <SecuritySection />
      <FaqSection />
      <PlaygroundCta />
      <LandingFooter />
    </div>
  );
}
