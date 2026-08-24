// ─────────────────────────────────────────────────────────────────────────────
// components/layout/Navbar.tsx — Camille by Buyticle
// Header unique du site = exactement la nav de l'accueil (thème Render),
// complété par l'essentiel (lien Contact). Utilisé sur TOUTES les pages
// (sauf le dashboard, qui a sa propre barre).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { label: "Fonctionnalités",   href: "/#features" },
  { label: "Comment ça marche", href: "/#how" },
  { label: "Sécurité",          href: "/#security" },
  { label: "Tarifs",            href: "/pricing" },
  { label: "Entreprise",        href: "/company" },
  { label: "Contact",           href: "/contact" },
];

/** Marque — « C » violet + Camille (repris à l'identique de l'accueil) */
function Wordmark() {
  return (
    <Link href="/" className="flex flex-shrink-0 items-center gap-2.5" aria-label="Camille — accueil">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[7px]"
        style={{ background: "#16141A", border: "1px solid rgba(124,90,248,0.55)" }}
      >
        <span style={{ fontFamily: "Blackout", fontSize: 17, color: "#8E6BFA", lineHeight: 1 }}>C</span>
      </span>
      <span style={{ fontFamily: "var(--font-good-timing)", fontSize: 16.5, letterSpacing: "0.03em", color: "var(--cl-ink)" }}>
        Camille
      </span>
    </Link>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  // Le dashboard a sa propre barre ; ailleurs (accueil inclus) → nav du site.
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/livraison")) return null;

  return (
    <>
      {/* Bandeau d'annonce — barre noire pleine largeur (comme l'accueil) */}
      <Link
        href="/company"
        className="group relative z-40 flex items-center justify-center gap-2.5 px-4 py-2.5 text-center"
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

      {/* Nav sticky */}
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
            className="flex h-10 w-10 items-center justify-center rounded-lg lg:hidden"
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
            style={{ background: "rgba(255,255,255,0.97)", borderBottom: "1px solid var(--cl-line-soft)" }}
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
    </>
  );
}
