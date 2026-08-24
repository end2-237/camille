"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, ShieldCheck, BarChart2 } from "lucide-react";

type Consent = { necessary: true; analytics: boolean };

const STORAGE_KEY = "camille_cookie_consent";

export function CookieBanner() {
  const pathname = usePathname();
  const [visible, setVisible]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    // L'écran du livreur se pilote par le bas — démarrer la course, marquer la
    // livraison. Un bandeau posé dessus, au feu rouge, empêche le seul geste
    // qui compte. La demande de consentement l'attend sur une autre page.
    if (pathname.startsWith("/livraison")) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setTimeout(() => setVisible(true), 1200);
    } catch {
      setVisible(true);
    }
  }, [pathname]);

  function save(consent: Consent) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch {}
    setVisible(false);
  }

  function acceptAll()  { save({ necessary: true, analytics: true  }); }
  function acceptMin()  { save({ necessary: true, analytics: false }); }
  function saveCustom() { save({ necessary: true, analytics        }); }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed bottom-4 left-4 right-4 z-[9999] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-xl sm:bottom-5"
          role="dialog"
          aria-label="Gestion des cookies"
        >
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,90,248,0.08)",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Gold hairline top */}
            <div className="h-px w-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(124,90,248,0.55), transparent)" }} />

            <div className="px-5 py-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(124,90,248,0.1)", border: "1px solid rgba(124,90,248,0.2)" }}>
                    <Cookie className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Vos préférences cookies
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
                      Conformité RGPD · Buyticle SAS
                    </p>
                  </div>
                </div>
                <button onClick={acceptMin} aria-label="Fermer"
                  className="p-1 rounded-lg transition-colors hover:bg-[var(--bg-muted)]">
                  <X className="w-4 h-4" style={{ color: "var(--text-disabled)" }} />
                </button>
              </div>

              {/* Body */}
              <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--text-tertiary)" }}>
                Nous utilisons des cookies strictement nécessaires au fonctionnement du service.
                Avec votre accord, nous activons également des cookies analytiques anonymes pour améliorer Camille.{" "}
                <Link href="/policies#cookies" className="underline underline-offset-2 transition-colors"
                  style={{ color: "var(--color-gold)" }}
                  onClick={() => setVisible(false)}>
                  En savoir plus
                </Link>
              </p>

              {/* Expanded preferences */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4 rounded-xl overflow-hidden"
                      style={{ border: "1px solid var(--border-subtle)" }}>
                      {/* Necessary — always on */}
                      <div className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-muted)" }}>
                        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Nécessaires</p>
                          <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
                            Authentification, session, sécurité — toujours actifs
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "rgba(124,90,248,0.1)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.2)" }}>
                          Toujours actif
                        </span>
                      </div>

                      {/* Analytics — toggle */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <BarChart2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Analytiques</p>
                          <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
                            Pages vues, parcours anonymisés — aucune donnée personnelle
                          </p>
                        </div>
                        {/* Toggle switch */}
                        <button
                          role="switch"
                          aria-checked={analytics}
                          onClick={() => setAnalytics((v) => !v)}
                          className="relative flex-shrink-0 w-9 h-5 rounded-full transition-all duration-250"
                          style={{
                            background: analytics ? "var(--color-gold)" : "var(--border-default)",
                          }}
                        >
                          <motion.span
                            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow"
                            animate={{ x: analytics ? 16 : 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={acceptAll}
                  className="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg,#7C5AF8,#A78BFA 50%,#6442E8)",
                    color: "#000",
                    boxShadow: "0 2px 16px rgba(124,90,248,0.2)",
                  }}
                >
                  Tout accepter
                </button>

                {expanded ? (
                  <button
                    onClick={saveCustom}
                    className="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
                    style={{
                      background: "var(--bg-muted)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    Enregistrer
                  </button>
                ) : (
                  <button
                    onClick={acceptMin}
                    className="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
                    style={{
                      background: "var(--bg-muted)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    Refuser
                  </button>
                )}

                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs transition-colors hover:opacity-80 px-1"
                  style={{ color: "var(--text-disabled)" }}
                >
                  {expanded ? "Masquer" : "Personnaliser"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
