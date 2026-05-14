// ─────────────────────────────────────────────────────────────────────────────
// components/layout/Footer.tsx — Camille by Buyticle
// Footer marketing — masqué sur /dashboard.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CamilleIcon } from "@/components/ui/CamilleIcon";
import { COMPANY, copyright } from "@/lib/company";

const LINKS = {
  Produit: [
    { label: "Fonctionnalités", href: "/#features" },
    { label: "Comment ça marche", href: "/#how" },
    { label: "Tarifs", href: "/pricing" },
    { label: "Dashboard", href: "/dashboard" },
  ],
  Ressources: [
    { label: "À propos", href: "/company" },
    { label: "Documentation", href: "#" },
    { label: "Changelog", href: "#" },
    { label: "Status", href: "#" },
  ],
  Légal: [
    { label: "Politiques & Conditions", href: "/policies" },
    { label: "Confidentialité", href: "/policies#privacy" },
    { label: "RGPD", href: "/policies#rgpd" },
    { label: "Cookies", href: "/policies" },
  ],
};

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) return null;

  return (
    <footer
      className="relative border-t"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
    >
      {/* Top rule — hairline gold */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--color-gold), transparent)" }}
      />

      <div className="max-w-6xl mx-auto px-6 pt-14 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <CamilleIcon size="sm" />
              <span className="font-good-timing text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Camille
              </span>
            </Link>
            <p className="text-xs leading-relaxed max-w-[200px]" style={{ color: "var(--text-disabled)" }}>
              {COMPANY.tagline}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
              Par{" "}
              <a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="transition-colors hover:text-[var(--color-gold)]"
                style={{ color: "var(--text-tertiary)" }}>
                {COMPANY.name}
              </a>
              {" "}· {COMPANY.city}, {COMPANY.country}
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category} className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-disabled)" }}>
                {category}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs transition-colors duration-150"
                      style={{ color: "var(--text-tertiary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-12 pt-6"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
            {copyright()}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
            Fait avec soin à {COMPANY.madeIn}
          </p>
        </div>
      </div>
    </footer>
  );
}
