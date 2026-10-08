"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La coquille du tableau de bord : le fond violet, l'en-tête, et pour chaque
// page autre que l'accueil la feuille blanche remontée sous le menu, avec le
// titre de la page en noir et l'agent concerné. Un bouton flottant permet de
// passer, à tout moment, à la même page pour un autre agent.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Check, X } from "lucide-react";
import type { Agent } from "@/types/agent";
import { FournisseurAgent, useAgentCourant } from "./AgentCourant";
import { Entete, RESSORT } from "./Entete";
import { useMontee } from "./montee";
import { FAMILLES, pageDe } from "./pages";

function IconeWhatsapp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

export const libelleStatut = (s?: string) => (s === "active" ? "En ligne" : s === "paused" ? "En pause" : "Brouillon");

function PuceStatut({ statut }: { statut?: string }) {
  const actif = statut === "active";
  return (
    <span className="rounded-full px-2 py-0.5 text-[12px] sm:px-2.5 sm:text-[13px]"
      style={{ background: actif ? "#D9F5DF" : "#FDEFD3", color: actif ? "#1E7A3A" : "#9A6510" }}>
      {libelleStatut(statut)}
    </span>
  );
}

const Avatar = ({ a, taille = 36 }: { a: Agent; taille?: number }) => (
  <span className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold"
    style={{ width: taille, height: taille, fontSize: taille * 0.42, background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
    {a.identity.avatar_emoji || a.identity.name?.[0]?.toUpperCase() || "A"}
  </span>
);

// ── La feuille d'une page ───────────────────────────────────────────────────

function Feuille({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  const page = pageDe(chemin);
  const { agent } = useAgentCourant();
  const ref = useRef<HTMLElement>(null);
  useMontee(ref);

  const titre = page?.titre === "Votre agent" && agent ? agent.identity.name : page?.titre || "Tableau de bord";
  const famille = page ? FAMILLES[page.famille] : "Camille";

  return (
    <main ref={ref} className="coq-feuille relative z-10 rounded-t-[36px]">
      <motion.div key={chemin} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="coq-titre flex flex-col gap-4 pt-6 lg:flex-row lg:items-end lg:justify-between lg:pt-8" style={{ paddingLeft: "var(--coq-marge)", paddingRight: "var(--coq-marge)" }}>
        <div className="min-w-0">
          <p className="text-[14px]" style={{ color: "var(--cl-ink-faint)" }}>{famille}</p>
          <h2 className="coq-h1 truncate font-medium tracking-[-0.035em]" style={{ color: "var(--cl-ink)" }}>{titre}</h2>
        </div>
        {page?.parAgent && agent && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/${agent.id}/whatsapp`} aria-label="WhatsApp officiel"
              className="coq-puce-claire flex h-9 w-9 items-center sm:h-11 sm:w-11 justify-center rounded-full" style={{ color: "#1DAB55" }}>
              <IconeWhatsapp className="h-5 w-5" />
            </Link>
            <span className="coq-puce-claire rounded-full px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-[14px]">
              <span style={{ color: "var(--cl-ink-faint)" }}>Agent : </span>
              <span style={{ color: "var(--cl-ink)" }}>{agent.identity.name}</span>
            </span>
            <span className="coq-puce-claire rounded-full px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-[14px]">
              <span style={{ color: "var(--cl-ink-faint)" }}>Statut : </span>
              <PuceStatut statut={agent.status} />
            </span>
          </div>
        )}
      </motion.div>
      <motion.div key={`c-${chemin}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="coq-contenu">
        {children}
      </motion.div>
    </main>
  );
}

// ── Le bouton flottant : la même page, pour un autre agent ──────────────────

function BasculeAgent() {
  const chemin = usePathname();
  const router = useRouter();
  const page = pageDe(chemin);
  const { visibles, agent, agentUrl, basculer } = useAgentCourant();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOuvert(false), [chemin]);
  useEffect(() => {
    const fermer = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);

  if (!page?.parAgent || visibles.length < 2 || !agent) return null;

  const aller = (id: string) => {
    setOuvert(false);
    if (id === agent.id) return;
    basculer(id);
    if (agentUrl) router.push(chemin.replace(agentUrl, id));
  };

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      <AnimatePresence>
        {ouvert && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }} transition={RESSORT} style={{ transformOrigin: "bottom right" }}
            className="coq-deroulant w-[min(300px,calc(100vw-40px))] rounded-[26px] p-2">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--cl-ink-faint)" }}>
              {page.titre} pour…
            </p>
            <div className="max-h-[50vh] overflow-y-auto">
              {visibles.map((a, i) => {
                const courant = a.id === agent.id;
                return (
                  <motion.button key={a.id} onClick={() => aller(a.id)}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.035 * i, ...RESSORT }}
                    className="flex w-full items-center gap-3 rounded-[18px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--cl-accent-soft)]"
                    style={{ background: courant ? "var(--cl-accent-soft)" : undefined }}>
                    <Avatar a={a} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{a.identity.name}</span>
                      <span className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{libelleStatut(a.status)}</span>
                    </span>
                    {courant && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: "var(--cl-accent)" }}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button onClick={() => setOuvert((v) => !v)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }} transition={RESSORT}
        aria-label="Passer à un autre agent" aria-expanded={ouvert}
        className="coq-fab flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4">
        <Avatar a={agent} taille={40} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>Agent</span>
          <span className="block max-w-[140px] truncate text-[14px] font-semibold text-white">{agent.identity.name}</span>
        </span>
        <motion.span animate={{ rotate: ouvert ? 90 : 0 }} transition={RESSORT}
          className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>
          {ouvert ? <X className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />}
        </motion.span>
      </motion.button>
    </div>
  );
}

// ── L'ensemble ──────────────────────────────────────────────────────────────

export function Coquille({ children }: { children: React.ReactNode }) {
  const accueil = usePathname() === "/dashboard";
  return (
    <FournisseurAgent>
      <div className="coq">
        <Entete />
        {accueil ? children : <Feuille>{children}</Feuille>}
        {!accueil && <BasculeAgent />}
      </div>
      <style jsx global>{`
        .coq {
          --coq-entete: 128px;
          --coq-marge: 20px;
          min-height: 100dvh; color: var(--cl-ink);
          background:
            radial-gradient(70% 55% at 50% 22%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 60%),
            linear-gradient(180deg, #A792F4 0%, #BFAFF8 40vh, #D6CCFB 100vh) fixed;
          background-color: #D6CCFB;
        }
        @media (min-width: 640px) { .coq { --coq-marge: 32px; } }
        @media (min-width: 768px) { .coq { --coq-entete: 76px; } }
        @media (min-width: 1024px) { .coq { --coq-marge: 40px; } }
        .coq-menu { background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.4); backdrop-filter: blur(10px); transition: padding .45s cubic-bezier(.22,1,.36,1); }

        /* ── L'en-tête : fixe en haut, se replie en barre flottante au défilement ── */
        .coq-entete { height: var(--coq-entete); pointer-events: none; }
        /* Repliée, la barre flotte : un voile de la couleur de la page passe
           sous elle, pour que le contenu s'efface avant de la toucher au lieu
           d'avoir l'air collé dessous. */
        .coq-entete::before {
          content: ""; position: absolute; left: 0; right: 0; top: 0; bottom: -28px; z-index: -1; pointer-events: none;
          background: linear-gradient(to bottom, #fff 0%, #fff 62%, rgba(255,255,255,0) 100%);
          opacity: 0; transition: opacity .35s ease;
        }
        .coq-entete[data-accueil]::before { background: linear-gradient(to bottom, #A792F4 0%, rgba(167,146,244,0.92) 62%, rgba(167,146,244,0) 100%); }
        .coq-entete[data-compacte]::before { opacity: 1; }
        .coq-barre {
          pointer-events: auto; padding: 0 20px; border-radius: 0; background: transparent;
          transition: margin .45s cubic-bezier(.22,1,.36,1), padding .45s cubic-bezier(.22,1,.36,1),
                      border-radius .45s cubic-bezier(.22,1,.36,1), background-color .35s ease, box-shadow .35s ease;
        }
        @media (min-width: 1024px) { .coq-barre { padding: 0 40px; } }
        .coq-rang { height: 76px; transition: height .45s cubic-bezier(.22,1,.36,1); }
        .coq-rang-mobile { padding-bottom: 8px; transition: padding .45s cubic-bezier(.22,1,.36,1); }
        .coq-p-menu, .coq-p-rond, .coq-logo-signe, .coq-nouvel, .coq-nouvel-plus {
          transition: width .45s cubic-bezier(.22,1,.36,1), height .45s cubic-bezier(.22,1,.36,1), padding .45s cubic-bezier(.22,1,.36,1),
                      font-size .45s cubic-bezier(.22,1,.36,1), background-color .25s ease, color .25s ease, box-shadow .25s ease, transform .2s cubic-bezier(.34,1.56,.64,1);
        }
        .coq-p-menu { width: 40px; height: 40px; }
        .coq-p-rond { width: 44px; height: 44px; }
        .coq-logo-signe { width: 36px; height: 36px; }
        .coq-logo-sous { max-height: 14px; overflow: hidden; transition: max-height .4s ease, opacity .3s ease, margin .4s ease; }
        .coq-nouvel { padding: 8px 16px 8px 10px; font-size: 14px; }
        .coq-nouvel-plus { width: 28px; height: 28px; }

        .coq-entete[data-compacte] .coq-barre {
          margin: 8px 12px 0; padding: 0 10px 0 16px; border-radius: 28px;
          background: rgba(146,120,240,0.80); backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3);
          box-shadow: 0 14px 34px rgba(60,30,170,0.24), inset 0 0 0 1px rgba(255,255,255,0.28);
        }
        @media (min-width: 768px) { .coq-entete[data-compacte] .coq-barre { border-radius: 999px; margin: 10px 24px 0; } }
        .coq-entete[data-compacte] .coq-rang { height: 54px; }
        .coq-entete[data-compacte] .coq-rang-mobile { padding-bottom: 8px; }
        .coq-entete[data-compacte] .coq-menu { padding: 3px; }
        .coq-entete[data-compacte] .coq-p-menu { width: 32px; height: 32px; }
        .coq-entete[data-compacte] .coq-p-rond { width: 36px; height: 36px; }
        .coq-entete[data-compacte] .coq-logo-signe { width: 28px; height: 28px; }
        .coq-entete[data-compacte] .coq-logo-sous { max-height: 0; opacity: 0; margin-top: 0; }
        .coq-entete[data-compacte] .coq-nouvel { padding: 4px 12px 4px 5px; font-size: 13px; }
        .coq-entete[data-compacte] .coq-nouvel-plus { width: 24px; height: 24px; }
        @media (prefers-reduced-motion: reduce) { .coq-barre, .coq-rang, .coq-p-menu, .coq-p-rond, .coq-logo-signe { transition: none !important; } }
        .coq-pastille { transition: background-color .25s ease, color .25s ease, box-shadow .25s ease, transform .2s cubic-bezier(.34,1.56,.64,1); }
        .coq-pastille:hover { transform: scale(1.06); }
        .coq-pastille:active { transform: scale(0.95); }
        .coq-deroulant { background: #fff; box-shadow: 0 18px 50px rgba(40,20,110,0.18); border: 1px solid var(--cl-line-soft); }
        .coq-puce { background: #fff; color: var(--cl-ink); box-shadow: 0 4px 18px rgba(70,40,190,0.10); }
        .coq-contour { border: 1px solid rgba(255,255,255,0.6); color: #fff; }
        .coq-feuille {
          margin-top: clamp(8px, 1.4vh, 16px);
          min-height: calc(100dvh - var(--coq-entete) - clamp(8px, 1.4vh, 16px));
          background: var(--bg-base, #fff);
          box-shadow: 0 -12px 40px rgba(70,40,190,0.10);
          padding-bottom: 96px;
          /* Une page trop large ne fait jamais défiler l'écran de côté
             (« clip » garde le collant des titres, contrairement à hidden). */
          overflow-x: clip;
        }
        .coq-h1 { font-size: clamp(30px, 4.6vh, 46px); line-height: 1.08; margin-top: 2px; }
        .coq-puce-claire { background: #F4F2F7; color: var(--cl-ink); transition: transform .2s cubic-bezier(.34,1.56,.64,1); }
        a.coq-puce-claire:hover { transform: scale(1.06); }
        /* Le titre de la page est dans la feuille : celui des pages fait doublon. */
        .coq-contenu h1 { display: none; }
        /* Les pages prennent toute la largeur de la feuille et s'alignent sur
           le titre : une seule marge pour toute la feuille. */
        .coq-contenu > * { margin-left: 0 !important; max-width: none !important; padding-left: var(--coq-marge) !important; padding-right: var(--coq-marge) !important; }
        .coq-fab { background: var(--cl-ink); box-shadow: 0 14px 34px rgba(25,23,27,0.28), 0 0 0 4px rgba(255,255,255,0.5); }
      `}</style>
    </FournisseurAgent>
  );
}
