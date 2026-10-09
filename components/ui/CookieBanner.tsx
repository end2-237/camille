"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le mot sur le stockage local — une information, pas une demande de
// consentement.
//
// Camille ne dépose aucun cookie publicitaire et ne charge aucun traceur
// (ni Google Analytics, ni pixel, ni outil de mesure tiers). Ce qu'elle garde
// sur l'appareil est strictement nécessaire : la session de connexion, le
// thème, l'agent choisi, la préférence de notifications. Ce stockage-là est
// exempté de consentement (RGPD / directive ePrivacy) : demander « Tout
// accepter / Refuser » pour des cookies analytiques qui n'existent pas
// laissait croire le contraire.
//
// On l'annonce donc une fois, simplement. Si un outil de mesure arrive un
// jour, c'est ici que reviendra un vrai choix.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";

const CLE = "camille_info_stockage";
/** L'ancien bandeau : qui a déjà répondu n'a pas besoin de relire l'information. */
const ANCIENNE_CLE = "camille_cookie_consent";

export function CookieBanner() {
  const chemin = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Le tableau de bord et l'écran du livreur : on y arrive connecté, donc
    // après être passé par une page publique où l'information a été donnée.
    // Et sur l'écran du livreur, rien ne doit couvrir les boutons du bas.
    if (chemin.startsWith("/dashboard") || chemin.startsWith("/livraison")) { setVisible(false); return; }
    try {
      if (localStorage.getItem(CLE) || localStorage.getItem(ANCIENNE_CLE)) return;
    } catch {
      return; // sans stockage, rien n'est gardé : rien à annoncer
    }
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, [chemin]);

  function fermer() {
    try { localStorage.setItem(CLE, "1"); } catch { /* sans conséquence */ }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          role="note"
          aria-label="Stockage sur votre appareil"
          className="fixed bottom-4 left-4 right-4 z-[90] sm:left-6 sm:right-auto sm:bottom-6 sm:w-[400px]"
        >
          <div
            className="flex items-start gap-3 rounded-[24px] bg-white p-4 pr-3"
            style={{
              boxShadow: "0 18px 50px rgba(25,23,27,0.14), 0 0 0 1px rgba(25,23,27,0.05)",
              fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif',
            }}
          >
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--cl-accent-soft, #F1ECFF)", color: "var(--cl-accent-deep, #6442E8)" }}
            >
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium" style={{ color: "var(--cl-ink, #19171B)" }}>
                Aucun traceur ici
              </p>
              <p className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: "var(--cl-ink-soft, #5F5A6B)" }}>
                Pas de cookie publicitaire ni d&apos;outil de mesure. Votre appareil garde seulement ce qu&apos;il
                faut pour vous garder connecté et retenir vos préférences.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={fermer}
                  className="h-9 rounded-full px-4 text-[13px] font-medium text-white transition active:scale-[0.97]"
                  style={{ background: "var(--cl-ink, #19171B)" }}
                >
                  Compris
                </button>
                <Link
                  href="/privacy#cookies"
                  onClick={fermer}
                  className="h-9 rounded-full px-3 text-[13px] font-medium leading-9 transition hover:underline"
                  style={{ color: "var(--cl-accent-deep, #6442E8)" }}
                >
                  En savoir plus
                </Link>
              </div>
            </div>

            <button
              type="button"
              onClick={fermer}
              aria-label="Fermer"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition hover:bg-black/5"
              style={{ color: "var(--cl-ink-faint, #8E88A0)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
