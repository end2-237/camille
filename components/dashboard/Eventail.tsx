// ─────────────────────────────────────────────────────────────────────────────
// L'éventail de capsules de verre de l'accueil — décoratif, dessiné en SVG aux
// couleurs de Camille : du lavande presque blanc à gauche au violet franc à
// droite, comme une jauge qui monte.
// ─────────────────────────────────────────────────────────────────────────────

const CAPSULES = [
  { angle: -78, teinte: "#F4F1FF", bord: "#FFFFFF", opacite: 0.75 },
  { angle: -52, teinte: "#E9E3FF", bord: "#FFFFFF", opacite: 0.8 },
  { angle: -26, teinte: "#D9CEFF", bord: "#F6F2FF", opacite: 0.85 },
  { angle: 0,   teinte: "#BBA8FF", bord: "#E6DEFF", opacite: 0.9 },
  { angle: 26,  teinte: "#9479FB", bord: "#C9BBFF", opacite: 0.95 },
  { angle: 52,  teinte: "#7C5AF8", bord: "#B3A0FF", opacite: 1 },
];

export function Eventail({ className }: { className?: string }) {
  // Pivot en bas au centre ; chaque capsule est un cylindre vu de biais.
  const cx = 200, cy = 250;
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden="true">
      <defs>
        {CAPSULES.map((c, i) => (
          <linearGradient key={i} id={`cap-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.35" stopColor={c.teinte} stopOpacity="0.9" />
            <stop offset="0.75" stopColor={c.teinte} stopOpacity="0.75" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.6" />
          </linearGradient>
        ))}
        <filter id="cap-ombre" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#4B2FD0" floodOpacity="0.18" />
        </filter>
      </defs>
      {CAPSULES.map((c, i) => (
        <g key={i} transform={`rotate(${c.angle} ${cx} ${cy})`} opacity={c.opacite} filter="url(#cap-ombre)">
          {/* corps */}
          <rect x={cx - 27} y={cy - 210} width="54" height="128" rx="27" fill={`url(#cap-${i})`} stroke={c.bord} strokeWidth="1.5" />
          {/* ouverture du cylindre */}
          <ellipse cx={cx} cy={cy - 196} rx="25" ry="11" fill={c.bord} opacity="0.9" />
          <ellipse cx={cx} cy={cy - 196} rx="18" ry="7" fill={c.teinte} opacity="0.7" />
          {/* reflet */}
          <rect x={cx - 17} y={cy - 182} width="6" height="88" rx="3" fill="#FFFFFF" opacity="0.65" />
        </g>
      ))}
    </svg>
  );
}
