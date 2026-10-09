// ─────────────────────────────────────────────────────────────────────────────
// Le logo de Camille pour les fonds clairs : la tuile en dégradé violet de
// l'icône de l'application (#A792F4 → #6442E8) et son signe blanc — la barre
// fendue de la police Blackout. Même dessin que LogoBlanc (tableau de bord),
// mais plein, pour qu'il se lise sur du blanc.
// ─────────────────────────────────────────────────────────────────────────────

import { useId } from "react";
import Link from "next/link";

export function TuileCamille({ taille = 32, className }: { taille?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 512 512" width={taille} height={taille} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`tc-g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A792F4" />
          <stop offset="100%" stopColor="#6442E8" />
        </linearGradient>
        <mask id={`tc-m-${id}`}>
          <rect width="512" height="512" fill="#fff" />
          <rect x="250" y="160" width="14" height="130" fill="#000" />
          <rect x="250" y="219" width="70" height="13" fill="#000" />
          <rect x="190" y="336" width="140" height="13" fill="#000" />
        </mask>
      </defs>
      <rect width="512" height="512" rx="118" fill={`url(#tc-g-${id})`} />
      <rect x="199" y="108" width="114" height="294" fill="#fff" mask={`url(#tc-m-${id})`} />
    </svg>
  );
}

/** Tuile + « Camille », cliquable vers l'accueil. */
export function MarqueCamille({ sombre = false, sous = false }: { sombre?: boolean; sous?: boolean }) {
  return (
    <Link href="/" className="flex flex-shrink-0 items-center gap-2.5" aria-label="Camille — accueil">
      <TuileCamille taille={34} className="flex-shrink-0" />
      <span className="leading-none">
        <span className="block text-[18px] font-bold tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-good-timing)", color: sombre ? "#FBF7F0" : "var(--cl-ink)" }}>
          Camille
        </span>
        {sous && (
          <span className="mt-1 block text-[9px] font-medium tracking-[0.2em]"
            style={{ color: sombre ? "rgba(251,247,240,0.5)" : "var(--cl-ink-faint)" }}>
            BY BUYTICLE
          </span>
        )}
      </span>
    </Link>
  );
}
