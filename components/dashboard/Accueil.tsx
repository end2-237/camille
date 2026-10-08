"use client";

// ─────────────────────────────────────────────────────────────────────────────
// L'accueil du tableau de bord.
//
// Tout le haut tient dans l'écran, sans défiler : le menu, « Tous vos
// agents » et, juste à côté, l'appel à connecter le WhatsApp officiel — la
// première chose à faire pour un commerçant —, le carrousel des agents, puis
// les premiers indicateurs de l'agent choisi et ses conversations du moment.
// Plus bas : le chiffre d'affaires, l'activité, et la gestion des agents.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3, Plus, RefreshCw, ArrowUpRight, Wallet, MessagesSquare, LifeBuoy, ShoppingBag,
  Activity, Pause, Play, Trash2, Check, MessageCircle, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { authHeaders } from "@/lib/auth-client";
import type { Agent } from "@/types/agent";
import { Eventail } from "./Eventail";
import { Doodle } from "./Doodle";
import { useAgentCourant } from "./coquille/AgentCourant";
import { useMontee } from "./coquille/montee";
import { RESSORT } from "./coquille/Entete";

// ── Données ─────────────────────────────────────────────────────────────────

type Stats = {
  overview?: {
    messages_received: number; messages_sent: number; messages_from_user: number;
    unique_contacts: number; total_leads: number; total_escalations: number; escalation_rate: number;
  };
  revenue?: {
    delivered: number; delivered_count: number; pending: number; pending_count: number;
    total: number; orders_count: number; avg_basket: number; currency: string;
  };
  usage?: { tokens_used: number; tokens_limit: number; unlimited: boolean };
  daily_series?: { date: string; messages: number }[];
};
type EtatMeta = { connecte: boolean; numero: string | null; nom_verifie: string | null; transport: string };
type Message = { role: "agent" | "client"; texte: string; le: string; contact: string };

async function lire<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { ...authHeaders() } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

const SECTEURS: Record<string, string> = {
  ecommerce: "Boutique", tech_saas: "High-tech", food_beverage: "Restaurant", hospitality: "Hôtellerie",
  beauty_wellness: "Beauté", consulting: "Services", healthcare: "Santé", real_estate: "Immobilier",
  education: "Éducation", legal: "Juridique", finance: "Finance", nonprofit: "Associatif", other: "Autre",
};

const montant = (n: number, cur = "XAF") =>
  `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} ${cur === "XAF" ? "FCFA" : cur}`;
const court = (x: number) => { const n = Number(x) || 0; return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} k` : String(Math.round(n)); };
const pct = (x: number) => `${(Math.round(x * 100) / 100).toFixed(2).replace(".", ",")}%`;
const heure = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// ── Les cartes d'indicateurs ────────────────────────────────────────────────

/**
 * Un nombre qui glisse vers sa nouvelle valeur au lieu de sauter : en
 * changeant d'agent, on voit les chiffres passer de l'un à l'autre.
 */
function useGlisse(cible: number, duree = 700): number {
  const [v, setV] = useState(cible);
  const depart = useRef(cible);
  const courant = useRef(cible);
  useEffect(() => {
    const calme = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calme || !Number.isFinite(cible)) { courant.current = cible; setV(cible); return; }
    depart.current = courant.current;
    const t0 = performance.now();
    let image = 0;
    const pas = (t: number) => {
      const k = Math.min(1, (t - t0) / duree);
      const e = 1 - Math.pow(1 - k, 3);
      courant.current = depart.current + (cible - depart.current) * e;
      setV(courant.current);
      if (k < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible, duree]);
  return v;
}

function Glisse({ valeur, format }: { valeur: number; format: (n: number) => string }) {
  return <>{format(useGlisse(valeur))}</>;
}

/** Une rangée de barres fines : la part colorée dit la proportion, comme une jauge. */
function Barres({ ratio, couleur, n = 52 }: { ratio: number; couleur: string; n?: number }) {
  const pleines = Math.round(Math.max(0, Math.min(1, ratio)) * n);
  return (
    <div className="flex h-[30px] items-end justify-between gap-[2px] overflow-hidden">
      {Array.from({ length: n }, (_, i) => {
        const h = 62 + ((i * 37) % 38);
        // Les barres se remplissent l'une après l'autre quand la valeur change.
        return <span key={i} className="block w-[2px] flex-shrink-0 rounded-full"
          style={{ height: `${h}%`, background: i < pleines ? couleur : "#E4E0EA", transition: `background-color .35s ease ${i * 9}ms` }} />;
      })}
    </div>
  );
}

function Point({ couleur }: { couleur: string }) {
  return (
    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ background: `${couleur}33` }}>
      <span className="h-[10px] w-[10px] rounded-full" style={{ background: couleur }} />
    </span>
  );
}

function Carte({ icone: Icone, titre, sous, valeur, point, ratio, couleur, gauche, droite, href }: {
  icone: React.ElementType; titre: string; sous: string; valeur: number; point: string;
  ratio: number; couleur: string; gauche: [string, string]; droite: [string, string]; href: string;
}) {
  return (
    <div className="acc-carte flex w-[82%] flex-shrink-0 snap-start flex-col rounded-[26px] bg-white sm:w-auto">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>
            <Icone className="h-4 w-4" /> {titre}
          </p>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{sous}</p>
        </div>
        <Link href={href} aria-label={`Ouvrir ${titre}`} className="acc-rond flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="acc-valeur mt-auto flex items-center gap-2.5 font-light tracking-[-0.03em]" style={{ color: "var(--cl-ink)" }}>
        <Glisse valeur={valeur} format={pct} /> <Point couleur={point} />
      </p>
      <div className="mt-3 flex justify-between text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>
        <span>{gauche[0]}</span><span>{droite[0]}</span>
      </div>
      <Barres ratio={ratio} couleur={couleur} />
      <div className="mt-1 flex justify-between text-[10.5px]" style={{ color: "#B9B3C2" }}>
        <span>{gauche[1]}</span><span>{droite[1]}</span>
      </div>
    </div>
  );
}

// ── L'appel au WhatsApp officiel ────────────────────────────────────────────

function IconeWhatsapp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function AppelWhatsapp({ agent, meta }: { agent?: Agent; meta: EtatMeta | null }) {
  if (!agent) return null;
  const actif = agent.status === "active";
  const page = `/dashboard/${agent.id}/whatsapp`;
  return (
    <div className="flex flex-col items-start gap-2.5 lg:items-end">
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Link href={page} aria-label="WhatsApp officiel" className="acc-puce flex h-9 w-9 items-center sm:h-11 sm:w-11 justify-center rounded-full" style={{ color: "#1DAB55" }}>
          <IconeWhatsapp className="h-5 w-5" />
        </Link>
        <span className="acc-puce rounded-full px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-[14px]">
          <span style={{ color: "var(--cl-ink-faint)" }}>Agent : </span>
          <span style={{ color: "var(--cl-ink)" }}>{agent.identity.name}</span>
        </span>
        <span className="acc-puce rounded-full px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-[14px]">
          <span style={{ color: "var(--cl-ink-faint)" }}>Statut : </span>
          <span className="rounded-full px-2 py-0.5 text-[12px] sm:px-2.5 sm:text-[13px]"
            style={{ background: actif ? "#D9F5DF" : "#FDEFD3", color: actif ? "#1E7A3A" : "#9A6510" }}>
            {actif ? "En ligne" : agent.status === "paused" ? "En pause" : "Brouillon"}
          </span>
        </span>
      </div>

      {/* L'appel lui-même : rien de plus important pour un commerçant. */}
      {meta && !meta.connecte && <Doodle nom="selfie" className="acc-doodle-appel pointer-events-none hidden xl:block" />}
      {meta?.connecte ? (
        <Link href={page} className="acc-puce flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4 text-[14px]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "#25D366", color: "#fff" }}>
            <Check className="h-4 w-4" />
          </span>
          <span style={{ color: "var(--cl-ink)" }}>
            WhatsApp officiel · <strong className="font-semibold">{meta.nom_verifie || meta.numero}</strong>
          </span>
        </Link>
      ) : (
        <Link href={page} className="acc-appel group flex items-center gap-3 rounded-full py-2 pl-2 pr-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "#25D366", color: "#fff" }}>
            <IconeWhatsapp className="h-5 w-5" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Connectez votre WhatsApp officiel</span>
            <span className="hidden text-[12px] sm:block" style={{ color: "var(--cl-ink-faint)" }}>Votre numéro, votre nom vérifié, en 2 minutes</span>
          </span>
          <span className="ml-1 flex h-9 items-center rounded-full px-4 text-[13px] font-semibold text-white transition group-hover:brightness-110"
            style={{ background: "var(--cl-ink)" }}>
            Connecter
          </span>
        </Link>
      )}
    </div>
  );
}

// ── Le carrousel des agents ─────────────────────────────────────────────────

function Carrousel({ visibles, loading, agentId, onChoisir, onActualiser, onCreer, ca }: {
  visibles: Agent[]; loading: boolean; agentId?: string; ca: React.ReactNode;
  onChoisir: (id: string) => void; onActualiser: () => void; onCreer: () => void;
}) {
  const piste = useRef<HTMLDivElement>(null);

  // L'agent choisi vient se placer au début de la piste (glissement doux,
  // sans faire bouger la page de haut en bas).
  useEffect(() => {
    const el = piste.current;
    const carte = el?.querySelector<HTMLElement>(`[data-agent="${agentId}"]`);
    if (!el || !carte) return;
    const marge = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const cible = Math.max(0, carte.offsetLeft - marge);
    if (Math.abs(el.scrollLeft - cible) > 2) el.scrollTo({ left: cible, behavior: "smooth" });
  }, [agentId]);

  // Téléphone : le glissement est piloté ici, pas par le navigateur. La piste
  // suit le doigt ; au lâcher, dès 40 px dans un sens, on termine le geste à
  // la place de l'utilisateur jusqu'à l'agent suivant (ou précédent) et on le
  // sélectionne. Un geste trop court revient en place.
  const geste = useRef<{ x: number; y: number; depart: number; horizontal: boolean | null } | null>(null);
  const mobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  const aller = (id: string) => {
    const el = piste.current;
    const carte = el?.querySelector<HTMLElement>(`[data-agent="${id}"]`);
    if (!el || !carte) return;
    const marge = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({ left: Math.max(0, carte.offsetLeft - marge), behavior: "smooth" });
  };
  const toucher = {
    onTouchStart: (e: React.TouchEvent) => {
      if (!mobile() || !piste.current) return;
      const t = e.touches[0];
      geste.current = { x: t.clientX, y: t.clientY, depart: piste.current.scrollLeft, horizontal: null };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const g = geste.current, el = piste.current;
      if (!g || !el) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (g.horizontal === null && Math.abs(dx) + Math.abs(dy) > 6) g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (g.horizontal) el.scrollLeft = g.depart - dx;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const g = geste.current;
      geste.current = null;
      if (!g || !g.horizontal || !agentId) return;
      const dx = e.changedTouches[0].clientX - g.x;
      const i = visibles.findIndex((a) => a.id === agentId);
      const cible = Math.abs(dx) < 40 ? i : Math.max(0, Math.min(visibles.length - 1, i + (dx < 0 ? 1 : -1)));
      const id = visibles[cible]?.id;
      if (!id) return;
      if (id !== agentId) onChoisir(id);
      aller(id);
    },
  };

  if (loading && !visibles.length) {
    return <div className="acc-carrousel flex px-5 lg:px-10"><div className="acc-carte-agent animate-pulse"><span className="acc-verre" /></div></div>;
  }
  if (!visibles.length) {
    return (
      <div className="acc-carrousel flex px-5 lg:px-10">
        <button onClick={onCreer} className="acc-carte-agent text-left">
          <span className="acc-onglet" />
          <span className="relative flex items-center gap-3 px-6 pt-6 text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>
            <Plus className="h-5 w-5" /> Créer votre premier agent
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={piste} {...toucher} className="acc-carrousel flex items-end gap-3 overflow-x-auto px-5 lg:px-10">
      {visibles.map((a) => {
        const sel = a.id === agentId;
        return (
          <div key={a.id} data-agent={a.id} role="button" tabIndex={0} aria-pressed={sel}
            onClick={() => onChoisir(a.id)} onKeyDown={(e) => e.key === "Enter" && onChoisir(a.id)}
            className="acc-carte-agent cursor-pointer" data-sel={sel ? "1" : undefined}>
            <span className="acc-verre" />
            {sel && <motion.span layoutId="acc-onglet" transition={RESSORT} className="acc-onglet" />}
            <motion.div className="relative px-[22px] pt-5" initial={false} animate={{ y: sel ? 0 : 34 }} transition={RESSORT}>
              <div className="flex items-start gap-3">
                <span className="acc-avatar flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[16px]">
                  {a.identity.avatar_emoji || a.identity.name?.[0] || "A"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="acc-nom truncate text-[15px] font-medium">{a.identity.name}</p>
                  <p className="acc-secteur truncate text-[12px]">
                    {SECTEURS[a.business_context?.sector] || "Agent"} · {a.id.slice(0, 4).toUpperCase()}
                  </p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); if (sel) onActualiser(); else onChoisir(a.id); }}
                  aria-label="Actualiser" className="acc-actualiser flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <motion.p initial={false} animate={{ opacity: sel ? 1 : 0 }} transition={{ duration: 0.25, delay: sel ? 0.12 : 0 }}
                className="mt-3 flex items-center gap-2 whitespace-nowrap text-[14px]" style={{ color: "var(--cl-ink-faint)" }} aria-hidden={!sel}>
                CA (30 j) :
                <strong className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>{sel ? ca : "—"}</strong>
                <Point couleur="#1DAB55" />
              </motion.p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

// ── La page ─────────────────────────────────────────────────────────────────

export function Accueil() {
  const router = useRouter();
  const { visibles, agent, choisir: setChoisi, loading, remove, toggleStatus } = useAgentCourant();
  const feuille = useRef<HTMLDivElement>(null);
  useMontee(feuille);
  const [stats, setStats] = useState<Stats | null>(null);
  const [meta, setMeta] = useState<EtatMeta | null>(null);
  const [fil, setFil] = useState<Message[]>([]);
  const [tour, setTour] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [filDe, setFilDe] = useState<string | undefined>();
  const dernier = useRef<string | null>(null);

  // En changeant d'agent, les anciens chiffres restent affichés (adoucis)
  // jusqu'à l'arrivée des nouveaux, puis glissent vers eux : pas de saut à
  // zéro entre les deux. Une réponse arrivée trop tard est ignorée.
  const charger = useCallback(async (id: string) => {
    dernier.current = id;
    setChargement(true);
    const [s, m, f] = await Promise.all([
      lire<Stats>(`/api/stats?agentId=${id}&period=30d`),
      lire<EtatMeta>(`/api/agents/${id}/meta`),
      lire<{ messages: Message[] }>(`/api/agents/${id}/activite`),
    ]);
    if (dernier.current !== id) return;
    setStats(s); setMeta(m); setFil(f?.messages || []); setFilDe(id);
    setChargement(false);
  }, []);

  useEffect(() => { if (agent?.id) charger(agent.id); }, [agent?.id, charger, tour]);

  const r = stats?.revenue;
  const o = stats?.overview;
  const cur = r?.currency || "XAF";
  const livrees = r?.orders_count ? r.delivered_count / r.orders_count : 0;
  const repondus = o?.messages_from_user ? Math.min(1, o.messages_sent / o.messages_from_user) : 0;
  // Part des clients passés à un humain : plus parlant qu'une part des messages.
  const escalade = o?.unique_contacts ? Math.min(1, o.total_escalations / o.unique_contacts) : 0;
  const usage = stats?.usage;
  const tauxUsage = usage && !usage.unlimited && usage.tokens_limit > 0 ? usage.tokens_used / usage.tokens_limit : 0;
  const serie = (stats?.daily_series || []).slice(-30).map((d) => d.messages);
  const maxSerie = Math.max(1, ...serie);

  return (
    <div className="acc">
      {/* ═══ Le haut : tout tient dans l'écran ═════════════════════════════ */}
      <section className="acc-haut flex flex-col">
        {/* Titre, éventail, et l'appel WhatsApp */}
        <div className="acc-tete relative grid items-start gap-4 px-5 lg:grid-cols-[1fr_auto_1fr] lg:px-10">
          <div>
            <p className="text-[14px] text-white/70">Vue d&apos;ensemble de vos agents</p>
            <h1 className="acc-titre font-medium tracking-[-0.035em] text-white">Tous vos agents</h1>
          </div>
          <Eventail className="acc-eventail pointer-events-none hidden lg:block" />
          <div className="lg:pt-6"><AppelWhatsapp agent={agent} meta={meta} /></div>
        </div>

        {/* Le carrousel des agents. Toutes les cartes ont la même taille : en
            changeant d'agent, l'onglet blanc GLISSE d'une carte à l'autre, rien
            ne change de forme. Sur téléphone, un glissement de côté s'aimante
            à la carte suivante et la sélectionne — on n'a pas à finir le geste. */}
        <Carrousel visibles={visibles} loading={loading} agentId={agent?.id} onChoisir={setChoisi}
          onActualiser={() => setTour((t) => t + 1)} onCreer={() => router.push("/configure")}
          ca={r ? <Glisse valeur={r.total} format={(n) => montant(n, cur)} /> : "—"} />

        {/* La feuille blanche : premiers indicateurs et conversations */}
        {!loading && visibles.length === 0 ? (
          <div ref={feuille} className="acc-feuille flex flex-1 flex-col items-center justify-center gap-4 rounded-t-[36px] bg-white p-8 text-center">
            <Doodle nom="sitting-reading" className="acc-doodle-vide min-h-0 w-auto" />
            <p className="text-[22px] font-medium tracking-[-0.02em]">Votre premier agent vous attend</p>
            <p className="max-w-md text-[14px]" style={{ color: "var(--cl-ink-faint)" }}>
              Décrivez votre activité, ajoutez votre catalogue, puis connectez votre WhatsApp officiel : Camille répond à vos clients jour et nuit.
            </p>
            <button onClick={() => router.push("/configure")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: "var(--cl-ink)" }}>
              <Plus className="h-4 w-4" /> Créer mon agent
            </button>
          </div>
        ) : (
        <div ref={feuille} data-chargement={chargement ? "1" : undefined} className="acc-feuille grid flex-1 content-start gap-4 rounded-t-[36px] bg-white p-4 lg:grid-cols-[2fr_1fr] lg:p-6">
          <div className="acc-indicateurs -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
            <Carte icone={ShoppingBag} titre="Commandes" sous={r ? `${r.orders_count} sur 30 jours` : "30 derniers jours"}
              valeur={livrees * 100} point="#1DAB55" ratio={livrees} couleur="#1DAB55"
              gauche={["Livrées", String(r?.delivered_count ?? 0)]} droite={["En cours", String(r?.pending_count ?? 0)]}
              href="/dashboard/orders" />
            <Carte icone={MessagesSquare} titre="Réponses de l'agent" sous={o ? `${o.unique_contacts} clients sur 30 jours` : "30 derniers jours"}
              valeur={repondus * 100} point="#7C5AF8" ratio={repondus} couleur="#7C5AF8"
              gauche={["Envoyés", court(o?.messages_sent ?? 0)]} droite={["Reçus", court(o?.messages_from_user ?? 0)]}
              href="/dashboard/stats" />
            <Carte icone={LifeBuoy} titre="Passages à l'humain" sous={o ? `${o.total_escalations} sur 30 jours` : "30 derniers jours"}
              valeur={escalade * 100} point="#E5484D" ratio={escalade} couleur="#E5484D"
              gauche={["Escaladés", String(o?.total_escalations ?? 0)]} droite={["Contacts", String(o?.unique_contacts ?? 0)]}
              href="/dashboard/complaints" />
          </div>

          {/* Conversations du moment */}
          <div className="acc-fil flex flex-col rounded-[26px] border p-5" style={{ borderColor: "var(--cl-line-soft)" }}>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>
                <MessageCircle className="h-4 w-4" /> Conversations en direct
              </p>
              <Link href={agent ? `/dashboard/${agent.id}/clientele` : "/dashboard"} aria-label="Toutes les conversations" className="acc-rond flex h-9 w-9 items-center justify-center rounded-full">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <AnimatePresence mode="wait" initial={false}>
            <motion.div key={filDe || "vide"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="acc-fil-messages mt-3 flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden">
              {fil.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                  <Doodle nom="laying" className="acc-doodle-fil min-h-0 w-auto" />
                  <p className="mt-2 max-w-[260px] text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>
                    Aucun message récent. Les échanges de vos clients avec l&apos;agent apparaîtront ici.
                  </p>
                </div>
              ) : (
                fil.slice(-4).map((m, i) => m.role === "agent" ? (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                      <Activity className="h-3.5 w-3.5" />
                    </span>
                    <p className="line-clamp-2 flex-1 text-[13.5px]" style={{ color: "var(--cl-ink)" }}>{m.texte}</p>
                    <span className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>{heure(m.le)}</span>
                  </div>
                ) : (
                  <div key={i} className="flex items-end justify-end gap-2">
                    <span className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>{heure(m.le)}</span>
                    <p className="line-clamp-2 max-w-[78%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px]" style={{ background: "#F3F0FA", color: "var(--cl-ink)" }}>{m.texte}</p>
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: "#E9E1FF", color: "var(--cl-accent-deep)" }}>
                      {m.contact.slice(-2) || "C"}
                    </span>
                  </div>
                ))
              )}
            </motion.div>
            </AnimatePresence>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { href: "/dashboard/orders", label: "Commandes" },
                { href: agent ? `/dashboard/${agent.id}/clientele` : "/dashboard", label: "Clientèle" },
                { href: "/dashboard/complaints", label: "Réclamations" },
              ].map((c, i) => (
                <Link key={c.label} href={c.href} className="rounded-full px-3.5 py-1.5 text-[12.5px]"
                  style={i === 0 ? { background: "var(--cl-ink)", color: "#fff" } : { background: "#F4F2F7", color: "var(--cl-ink)" }}>
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        )}
      </section>

      {/* ═══ Plus bas : chiffre d'affaires, activité, gestion des agents ═══ */}
      <section className="bg-white px-4 pb-12 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="acc-bloc rounded-[26px] p-6">
            <div className="flex items-start justify-between">
              <p className="flex items-center gap-2 text-[15px] font-medium"><Wallet className="h-4 w-4" /> Chiffre d&apos;affaires</p>
              <Link href="/dashboard/stats" aria-label="Statistiques" className="acc-rond flex h-9 w-9 items-center justify-center rounded-full"><ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>30 derniers jours</p>
            {r && r.orders_count === 0 ? (
              <div className="mt-2 flex items-center gap-4">
                <Doodle nom="unboxing" className="h-[92px] w-auto" />
                <p className="text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>Pas encore de commande ce mois-ci. La première arrive par WhatsApp.</p>
              </div>
            ) : (
            <div className="mt-4 flex items-start justify-between gap-4">
              <p className="text-[34px] font-light tracking-[-0.03em]">{r ? court(r.delivered) : "—"}<span className="ml-1 text-[14px]" style={{ color: "var(--cl-ink-faint)" }}>{cur === "XAF" ? "FCFA livrés" : cur}</span></p>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-right text-[16px]">
                <div><dt className="font-medium">{r?.delivered_count ?? 0}</dt><dd className="text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>Livrées</dd></div>
                <div><dt className="font-medium">{r?.pending_count ?? 0}</dt><dd className="text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>En cours</dd></div>
                <div><dt className="font-medium">{r ? court(r.avg_basket) : "—"}</dt><dd className="text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>Panier moyen</dd></div>
                <div><dt className="font-medium">{r ? court(r.pending) : "—"}</dt><dd className="text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>À encaisser</dd></div>
              </dl>
            </div>
            )}
          </div>

          <div className="acc-bloc rounded-[26px] p-6">
            <div className="flex items-start justify-between">
              <p className="flex items-center gap-2 text-[15px] font-medium"><Activity className="h-4 w-4" /> Activité des 30 jours</p>
              <Link href="/dashboard/stats" aria-label="Statistiques" className="acc-rond flex h-9 w-9 items-center justify-center rounded-full"><ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Messages par jour</p>
            <div className="mt-5 flex h-[86px] items-end gap-[5px]">
              {(serie.length ? serie : Array(30).fill(0)).map((v, i) => (
                <span key={i} className="block w-[3px] rounded-full" style={{ height: `${Math.max(6, (v / maxSerie) * 100)}%`, background: v === maxSerie && v > 0 ? "#7C5AF8" : "#D9D2EE" }} />
              ))}
            </div>
          </div>

          <div className="acc-bloc rounded-[26px] p-6">
            <div className="flex items-start justify-between">
              <p className="flex items-center gap-2 text-[15px] font-medium"><BarChart3 className="h-4 w-4" /> Utilisation de l&apos;IA</p>
              <Link href="/dashboard/billing" aria-label="Abonnement" className="acc-rond flex h-9 w-9 items-center justify-center rounded-full"><ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Ce mois-ci</p>
            <p className="mt-4 text-[34px] font-light tracking-[-0.03em]">{usage?.unlimited ? "Illimité" : pct(tauxUsage * 100)}</p>
            <div className="mt-3"><Barres ratio={tauxUsage} couleur={tauxUsage > 0.85 ? "#E5484D" : "#7C5AF8"} n={60} /></div>
          </div>
        </div>

        {/* La gestion des agents */}
        <div className="mt-6 rounded-[26px] border p-2" style={{ borderColor: "var(--cl-line-soft)" }}>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[16px] font-medium">Gérer vos agents <span className="text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>· {visibles.length}</span></p>
            <button onClick={() => router.push("/configure")} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white" style={{ background: "var(--cl-ink)" }}>
              <Plus className="h-4 w-4" /> Nouvel agent
            </button>
          </div>
          {visibles.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 hover:bg-[#FAF8FE]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[15px]" style={{ background: "var(--cl-accent-soft)" }}>
                {a.identity.avatar_emoji || a.identity.name?.[0] || "A"}
              </span>
              <Link href={`/dashboard/${a.id}`} className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium">{a.identity.name}</p>
                <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                  {SECTEURS[a.business_context?.sector] || "Agent"}
                  {a.plan_expired ? " · abonnement terminé" : ""}
                </p>
              </Link>
              <span className="hidden rounded-full px-2.5 py-1 text-[12px] sm:inline"
                style={{ background: a.status === "active" ? "#D9F5DF" : "#F4F2F7", color: a.status === "active" ? "#1E7A3A" : "var(--cl-ink-soft)" }}>
                {a.status === "active" ? "En ligne" : a.status === "paused" ? "En pause" : "Brouillon"}
              </span>
              <button aria-label={a.status === "active" ? "Mettre en pause" : "Activer"} className="acc-rond flex h-9 w-9 items-center justify-center rounded-full"
                onClick={async () => { await toggleStatus(a.id, a.status); toast.success(a.status === "active" ? "Agent mis en pause" : "Agent activé"); }}>
                {a.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button aria-label="Supprimer" className="acc-rond flex h-9 w-9 items-center justify-center rounded-full" style={{ color: "#C2504B" }}
                onClick={async () => {
                  if (!confirm(`Supprimer « ${a.identity.name} » ?`)) return;
                  try { await remove(a.id); toast.success("Agent supprimé"); } catch { toast.error("Suppression impossible"); }
                }}>
                <Trash2 className="h-4 w-4" />
              </button>
              <Link href={`/dashboard/${a.id}`} aria-label="Ouvrir" className="acc-rond flex h-9 w-9 items-center justify-center rounded-full">
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .acc { color: var(--cl-ink); font-family: "Inter Variable", "Inter", system-ui, sans-serif; }
        /* Sur ordinateur, tout le haut tient dans l'écran (sous l'en-tête de la
           coquille). Sur un écran bas, il grandit plutôt que de tasser les
           cartes : mieux vaut défiler un peu que lire des chiffres qui débordent. */
        @media (min-width: 1024px) { .acc-haut { min-height: calc(100dvh - var(--coq-entete)); } }
        .acc-tete { animation: acc-apparait .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes acc-apparait { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .acc-tete { animation: none; } }
        .acc-titre { font-size: clamp(30px, min(6.4vh, 10vw), 64px); line-height: 1.02; margin-top: 6px; }
        .acc-tete { margin-top: clamp(6px, 2.4vh, 32px); }
        :global(.acc-eventail) { width: clamp(240px, 30vh, 330px); margin-top: -6px; margin-bottom: clamp(-60px, -6vh, -20px); }
        :global(.acc-carrousel) { margin-top: clamp(10px, 2vh, 24px); scrollbar-width: none; scroll-padding-inline: 20px; }
        @media (min-width: 1024px) { :global(.acc-carrousel) { scroll-padding-inline: 40px; } }
        :global(.acc-carrousel::-webkit-scrollbar), .acc-indicateurs::-webkit-scrollbar { display: none; }
        .acc-indicateurs { scrollbar-width: none; scroll-padding-left: 16px; }
        /* Téléphone : cartes d'agent plus étroites, indicateurs moins hauts. */
        @media (max-width: 639px) {
          :global(.acc-carte-agent) { width: calc(100vw - 72px); max-width: 300px; }
          /* Le glissement de côté est piloté par la page ; le défilement
             vertical reste au navigateur. */
          :global(.acc-carrousel) { overflow-x: hidden; touch-action: pan-y; }
          :global(.acc-carte) { min-height: 186px !important; }
          .acc-fil { min-height: 230px; }
        }
        /* Les cartes d'agent : même taille pour toutes. Le verre est le fond d'une
           carte au repos ; l'onglet blanc, celui de la carte choisie, glisse de
           l'une à l'autre et rejoint la feuille. */
        :global(.acc-carte-agent) { position: relative; flex-shrink: 0; width: 300px; height: 126px; margin-bottom: -1px; z-index: 2; }
        :global(.acc-verre) { position: absolute; left: 0; right: 0; top: 34px; bottom: 11px; border-radius: 24px;
          background: rgba(255,255,255,0.28); border: 1px solid rgba(255,255,255,0.45); backdrop-filter: blur(10px); transition: opacity .3s ease; }
        :global(.acc-carte-agent[data-sel] .acc-verre) { opacity: 0; }
        :global(.acc-onglet) { position: absolute; inset: 0; border-radius: 30px 30px 0 0; background: #fff; box-shadow: 0 -10px 30px rgba(70,40,190,0.10); }
        :global(.acc-avatar) { background: rgba(255,255,255,0.35); transition: background-color .3s ease; }
        :global(.acc-carte-agent[data-sel] .acc-avatar) { background: var(--cl-accent-soft); }
        :global(.acc-nom) { color: #fff; transition: color .3s ease; }
        :global(.acc-secteur) { color: rgba(255,255,255,0.7); transition: color .3s ease; }
        :global(.acc-carte-agent[data-sel] .acc-nom) { color: var(--cl-ink); }
        :global(.acc-carte-agent[data-sel] .acc-secteur) { color: var(--cl-ink-faint); }
        :global(.acc-actualiser) { border: 1px solid rgba(255,255,255,0.45); color: #fff; transition: color .3s ease, border-color .3s ease; }
        :global(.acc-carte-agent[data-sel] .acc-actualiser) { border-color: var(--cl-line); color: var(--cl-ink); }
        
        .acc-feuille { position: relative; z-index: 1; }
        :global(.acc-carte) { padding: clamp(14px, 2.2vh, 22px); border: 1px solid var(--cl-line-soft); min-height: 212px; transition: opacity .3s ease; }
        .acc-fil { min-height: 260px; max-height: 340px; transition: opacity .3s ease; }
        /* Sur ordinateur, cartes et conversations ont la même hauteur fixe :
           de vraies conversations ne doivent plus étirer toute la rangée. */
        @media (min-width: 1024px) {
          :global(.acc-carte), .acc-fil { height: clamp(236px, 31vh, 300px); min-height: 0; max-height: none; }
        }
        .acc-feuille[data-chargement] :global(.acc-carte), .acc-feuille[data-chargement] .acc-fil { opacity: .55; }
        :global(.acc-valeur) { font-size: clamp(28px, min(4.6vh, 2.6vw), 42px); margin-top: clamp(8px, 2vh, 22px); white-space: nowrap; }
                :global(.acc-deroulant) { background: #fff; box-shadow: 0 18px 50px rgba(40,20,110,0.18); border: 1px solid var(--cl-line-soft); }
        :global(.acc-puce) { background: #fff; color: var(--cl-ink); box-shadow: 0 4px 18px rgba(70,40,190,0.10); }
        :global(.acc-appel) { background: rgba(255,255,255,0.92); box-shadow: 0 10px 30px rgba(70,40,190,0.18); border: 1px solid rgba(255,255,255,0.8); }
        :global(.acc-rond) { border: 1px solid var(--cl-line); color: var(--cl-ink); }
        :global(.acc-bloc) { border: 1px solid var(--cl-line-soft); }
        /* Le fil se lit par le bas : ce qui déborde en haut s'efface au lieu d'être coupé net. */
        :global(.acc-fil-messages) { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 28px); mask-image: linear-gradient(to bottom, transparent 0, #000 28px); padding-top: 12px; }
        :global(.acc-doodle-fil) { height: clamp(70px, 13vh, 150px); }
        :global(.acc-doodle-vide) { height: clamp(120px, 24vh, 260px); }
        :global(.acc-doodle-appel) { height: clamp(90px, 15vh, 160px); margin: -4px 26px -6px 0; }
        /* Écran bas : l'illustration cède sa place, l'éventail se fait petit. */
        @media (max-height: 820px) { :global(.acc-doodle-appel) { display: none !important; } }
        @media (max-height: 720px) { :global(.acc-eventail) { width: 220px !important; } }
      `}</style>
    </div>
  );
}
