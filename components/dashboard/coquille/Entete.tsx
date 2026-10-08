"use client";

// ─────────────────────────────────────────────────────────────────────────────
// L'en-tête du tableau de bord, le même sur toutes les pages : le logo blanc,
// le menu à pastilles (chaque famille se déroule) et le compte.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Receipt, BarChart3, Users, Package, Settings, Bell, Plus, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useAgentCourant } from "./AgentCourant";
import { LogoBlanc } from "./LogoBlanc";
import { FAMILLES, PAGES, hrefDe, pageDe, type Famille } from "./pages";

const ICONES: Record<Famille, React.ElementType> = {
  accueil: LayoutGrid, ventes: Receipt, chiffres: BarChart3, clients: Users, catalogue: Package, reglages: Settings,
};

/** Les ouvertures et fermetures : courtes, avec un léger rebond, comme nos formes. */
export const RESSORT = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 } as const;

function MenuHaut() {
  const chemin = usePathname();
  const { user } = useAuth();
  const { agent } = useAgentCourant();
  const [ouvert, setOuvert] = useState<Famille | null>(null);
  const [monte, setMonte] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMonte(true), []);
  useEffect(() => setOuvert(null), [chemin]);
  useEffect(() => {
    const fermer = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(null); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(null); };
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("mousedown", fermer); document.removeEventListener("keydown", echap); };
  }, []);

  const ici = chemin === "/dashboard" ? "accueil" : pageDe(chemin)?.famille;
  const admin = monte && Boolean(user?.is_admin);
  const liens = (f: Famille) => [
    ...PAGES.filter((p) => p.famille === f && (admin || !["/dashboard/admin", "/dashboard/insights"].includes(p.chemin || "")))
      .map((p) => ({ href: hrefDe(p, agent?.id), label: p.titre }))
      .filter((l): l is { href: string; label: string } => Boolean(l.href)),
    ...(f === "clients" ? [{ href: "/livraison", label: "Espace livreur" }] : []),
  ];

  return (
    <div ref={ref} className="coq-menu flex items-center gap-1 rounded-full p-1.5 sm:gap-1.5">
      {(Object.keys(FAMILLES) as Famille[]).map((f) => {
        const Icone = ICONES[f];
        const actif = ici === f;
        const style = {
          background: actif ? "#fff" : ouvert === f ? "rgba(255,255,255,0.5)" : "transparent",
          color: actif ? "var(--cl-ink)" : "#fff",
          boxShadow: actif ? "0 4px 14px rgba(70,40,190,0.18)" : "none",
        };
        const classe = "coq-pastille flex h-10 w-10 items-center justify-center rounded-full";
        if (f === "accueil") {
          return (
            <Link key={f} href="/dashboard" title="Accueil" aria-label="Accueil" className={classe} style={style}>
              <Icone className="h-[18px] w-[18px]" strokeWidth={2} />
            </Link>
          );
        }
        const l = liens(f);
        return (
          <div key={f} className="relative">
            <button onClick={() => setOuvert(ouvert === f ? null : f)} title={FAMILLES[f]} aria-label={FAMILLES[f]}
              aria-expanded={ouvert === f} className={classe} style={style}>
              <Icone className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <AnimatePresence>
              {ouvert === f && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={RESSORT}
                  style={{ transformOrigin: "top center" }}
                  className="coq-deroulant absolute left-1/2 top-[52px] z-50 w-60 -translate-x-1/2 rounded-[22px] p-1.5">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--cl-ink-faint)" }}>{FAMILLES[f]}</p>
                  {l.length === 0 && (
                    <p className="px-3 py-2 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>Créez d&apos;abord un agent.</p>
                  )}
                  {l.map((x, i) => {
                    const courant = chemin === x.href;
                    return (
                      <motion.div key={x.href} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i, duration: 0.18 }}>
                        <Link href={x.href}
                          className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-[14px] transition-colors hover:bg-[var(--cl-accent-soft)]"
                          style={{ color: "var(--cl-ink)", background: courant ? "var(--cl-accent-soft)" : undefined, fontWeight: courant ? 600 : 400 }}>
                          {x.label}
                          {courant && <span className="h-2 w-2 rounded-full" style={{ background: "var(--cl-accent)" }} />}
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function Compte() {
  const { user, logout } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [monte, setMonte] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setMonte(true), []);
  useEffect(() => {
    const fermer = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);
  const initiale = monte ? (user?.full_name || user?.email || "?").trim()[0]?.toUpperCase() : "";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOuvert((v) => !v)} aria-label="Mon compte"
        className="coq-pastille flex h-11 w-11 items-center justify-center rounded-full text-[16px] font-semibold"
        style={{ background: "#fff", color: "var(--cl-accent-deep)", border: "3px solid rgba(255,255,255,0.6)" }}>
        {initiale}
      </button>
      <AnimatePresence>
        {ouvert && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={RESSORT} style={{ transformOrigin: "top right" }}
            className="coq-deroulant absolute right-0 top-[54px] z-50 w-64 rounded-[22px] p-1.5">
            <p className="truncate px-3 py-2 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>{monte ? user?.email : ""}</p>
            <Link href="/dashboard/billing" className="block rounded-2xl px-3 py-2.5 text-[14px] hover:bg-[var(--cl-accent-soft)]" style={{ color: "var(--cl-ink)" }}>Abonnement</Link>
            <Link href="/" className="block rounded-2xl px-3 py-2.5 text-[14px] hover:bg-[var(--cl-accent-soft)]" style={{ color: "var(--cl-ink)" }}>Retour au site</Link>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-[14px] hover:bg-[var(--cl-accent-soft)]" style={{ color: "#A63D28" }}>
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Entete() {
  const router = useRouter();
  const { agent } = useAgentCourant();
  const { unread } = useNotifications(20);
  return (
    <header className="coq-entete relative z-40">
      <div className="flex h-[76px] items-center justify-between gap-3 px-5 lg:px-10">
        <Link href="/dashboard" aria-label="Accueil du tableau de bord"><LogoBlanc /></Link>
        <div className="hidden md:block"><MenuHaut /></div>
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/notifications" aria-label="Notifications" className="coq-contour coq-pastille relative hidden h-11 w-11 items-center justify-center rounded-full sm:flex">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{ background: "#fff", color: "var(--cl-accent-deep)" }}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <Link href={agent ? `/dashboard/${agent.id}/settings` : "/dashboard"} aria-label="Réglages" className="coq-contour coq-pastille hidden h-11 w-11 items-center justify-center rounded-full sm:flex">
            <Settings className="h-[18px] w-[18px]" />
          </Link>
          <button onClick={() => router.push("/configure")} className="coq-puce coq-pastille hidden items-center gap-2 rounded-full py-2 pl-2.5 pr-4 text-[14px] lg:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
              <Plus className="h-4 w-4" />
            </span>
            Nouvel agent
          </button>
          <Compte />
        </div>
      </div>
      <div className="flex justify-center px-5 pb-2 md:hidden"><MenuHaut /></div>
    </header>
  );
}
