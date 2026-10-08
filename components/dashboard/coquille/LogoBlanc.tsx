// ─────────────────────────────────────────────────────────────────────────────
// Le logo de Camille en blanc, pour les fonds violets du tableau de bord.
// Le même signe que l'icône de l'application (la barre fendue de la police
// Blackout), redessiné en SVG : contour de tuile blanc, signe blanc, les
// fentes laissent voir le fond.
// ─────────────────────────────────────────────────────────────────────────────

export function SigneCamille({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <mask id="signe-camille-fentes">
          <rect width="512" height="512" fill="#fff" />
          {/* la fente verticale et son retour, puis la coupe du bas */}
          <rect x="250" y="160" width="14" height="130" fill="#000" />
          <rect x="250" y="219" width="70" height="13" fill="#000" />
          <rect x="190" y="336" width="140" height="13" fill="#000" />
        </mask>
      </defs>
      <rect x="14" y="14" width="484" height="484" rx="104" fill="none" stroke="#fff" strokeWidth="22" />
      <rect x="199" y="108" width="114" height="294" fill="#fff" mask="url(#signe-camille-fentes)" />
    </svg>
  );
}

export function LogoBlanc({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-white">
      <SigneCamille className="coq-logo-signe flex-shrink-0" />
      {!compact && (
        <span className="coq-logo-texte leading-none">
          <span className="block text-[19px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-good-timing)" }}>Camille</span>
          <span className="coq-logo-sous mt-1 block text-[9.5px] font-medium tracking-[0.2em] text-white/70">BY BUYTICLE</span>
        </span>
      )}
    </span>
  );
}
