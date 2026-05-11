// ─────────────────────────────────────────────────────────────────────────────
// components/layout/Navbar.tsx — Camille by Buyticle
// Nav avec icônes pro · À propos · Politiques · Contact
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Menu, X,
  LayoutGrid, Route, CreditCard, LayoutDashboard,
  LogIn, Bot, Building2, Shield, MessageSquare,
} from "lucide-react";
import { GoldButton } from "@/components/ui/GoldButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const NAV_MAIN: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Fonctionnalités",   href: "/#features", icon: LayoutGrid       },
  { label: "Comment ça marche", href: "/#how",      icon: Route             },
  { label: "Tarifs",            href: "/pricing",   icon: CreditCard        },
  { label: "Dashboard",         href: "/dashboard", icon: LayoutDashboard   },
];

const NAV_SECONDARY: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "À propos",    href: "/company",  icon: Building2      },
  { label: "Politiques",  href: "/policies", icon: Shield         },
  { label: "Contact",     href: "/contact",  icon: MessageSquare  },
];

export function Navbar() {
  const [scrolled, setScrolled]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [moreOpen, setMoreOpen]       = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => { setMobileOpen(false); setMoreOpen(false); }, [pathname]);

  if (pathname.startsWith("/dashboard")) return null;

  return (
    <>
      <header
        style={{
          background: scrolled ? "var(--surface-glass)" : "transparent",
          borderBottom: scrolled ? "0.5px solid var(--border-subtle)" : "none",
          backdropFilter: scrolled ? "blur(20px) saturate(1.5)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.5)" : "none",
        }}
        className={cn(
          "fixed inset-x-0 top-0 z-[var(--z-overlay)] transition-all duration-300",
          scrolled ? "py-3" : "py-5"
        )}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0" aria-label="Camille — Accueil">
            <div className="w-8 h-8 rounded-xl glass-gold flex items-center justify-center transition-shadow duration-200 group-hover:shadow-[var(--shadow-gold)]">
              <Sparkles className="w-4 h-4 text-[var(--color-gold)]" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              <span className="font-good-timing text-gold-gradient">Camille</span>
              <span className="text-[var(--text-tertiary)] ml-1 font-sans font-normal text-xs">by Buyticle</span>
            </span>
          </Link>

          {/* Desktop — main links */}
          <ul className="hidden lg:flex items-center gap-0.5 flex-1" role="list">
            {NAV_MAIN.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass)]"
                    style={{ color: isActive ? "var(--color-gold)" : "var(--text-tertiary)", background: isActive ? "var(--surface-gold)" : "transparent" }}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActive ? "var(--color-gold)" : "var(--text-disabled)" }} />
                    {link.label}
                  </Link>
                </li>
              );
            })}

            {/* "Plus" dropdown — À propos, Politiques, Contact */}
            <li className="relative">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMoreOpen(false), 160)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass)]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Plus
                <motion.svg
                  animate={{ rotate: moreOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  width="10" height="10" viewBox="0 0 10 6" fill="none"
                >
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </motion.svg>
              </button>

              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 top-full mt-2 w-44 rounded-xl overflow-hidden"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "0 16px 40px rgba(0,0,0,0.4)" }}
                  >
                    {NAV_SECONDARY.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors duration-150 hover:bg-[var(--surface-glass)]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
                          {link.label}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          </ul>

          {/* Desktop — actions */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-[var(--surface-glass)]"
              style={{ color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
            >
              <LogIn className="w-3.5 h-3.5" />
              Connexion
            </button>
            <Link
              href="/contact"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Contact
            </Link>
            <GoldButton
              size="sm"
              icon={<Bot className="w-3.5 h-3.5" />}
              onClick={() => router.push("/configure")}
            >
              Créer un agent
            </GoldButton>
          </div>

          {/* Mobile burger */}
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              style={{ color: "var(--text-secondary)", borderColor: "var(--border-default)" }}
              className="p-2 rounded-xl glass border transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "var(--surface-glass)",
              backdropFilter: "blur(20px) saturate(1.5)",
              WebkitBackdropFilter: "blur(20px) saturate(1.5)",
              borderBottom: "0.5px solid var(--border-subtle)",
            }}
            className="fixed inset-x-0 top-[60px] z-[var(--z-overlay)] px-4 py-4 lg:hidden"
          >
            <div className="space-y-0.5">
              {[...NAV_MAIN, ...NAV_SECONDARY].map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm hover:bg-[var(--surface-glass)] transition-all duration-200"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: "0.5px solid var(--border-subtle)" }}>
              <button
                onClick={() => router.push("/login")}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
              >
                <LogIn className="w-4 h-4" />
                Connexion
              </button>
              <GoldButton icon={<Bot className="w-3.5 h-3.5" />} className="w-full justify-center" onClick={() => router.push("/configure")}>
                Créer un agent
              </GoldButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
