// ─────────────────────────────────────────────────────────────────────────────
// L'illustration de la page de connexion : une conversation WhatsApp posée
// sur un socle, une loupe, et autour les quatre choses que Camille relie —
// la discussion, le catalogue, le bon de commande, les ventes.
//
// Dessinée ici, en SVG, aux couleurs de Camille : pas d'image tierce à
// licencier, nette à toutes les tailles, et quelques kilo-octets.
// ─────────────────────────────────────────────────────────────────────────────

const V = "#7C5AF8";      // accent
const VD = "#6442E8";     // accent profond
const VS = "#F0EBFF";     // accent doux
const VL = "#E9E1FF";     // lavande
const WA = "#25D366";     // WhatsApp

function Tuile({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="88" height="88" rx="18" fill="#fff" stroke={VL} filter="url(#ombre)" />
      {children}
    </g>
  );
}

export function IllustrationConnexion({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 630 410" className={className} role="img" aria-label="Camille relie WhatsApp, le catalogue, les commandes et les ventes">
      <defs>
        <filter id="ombre" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor={VD} floodOpacity="0.12" />
        </filter>
        <linearGradient id="socle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor={VL} />
        </linearGradient>
        <linearGradient id="loupe" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={V} />
          <stop offset="1" stopColor={VD} />
        </linearGradient>
        <pattern id="points" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill={VL} />
        </pattern>
      </defs>

      <rect width="630" height="410" fill="url(#points)" opacity="0.8" />

      {/* Liaisons en pointillés */}
      <g fill="none" stroke={V} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="5 6">
        <path d="M126 116 V150 H210 V190" />
        <path d="M504 116 V150 H420 V190" />
        <path d="M150 270 H215" />
        <path d="M480 270 H415" />
        <path d="M210 60 H420" />
      </g>
      <g fill={V}>
        <circle cx="210" cy="190" r="3.5" />
        <circle cx="420" cy="190" r="3.5" />
        <circle cx="215" cy="270" r="3.5" />
        <circle cx="415" cy="270" r="3.5" />
      </g>
      <circle cx="158" cy="30" r="3" fill={V} />
      <circle cx="478" cy="26" r="3" fill={WA} />
      <circle cx="596" cy="140" r="2.5" fill={V} opacity="0.6" />
      <circle cx="40" cy="190" r="2.5" fill={V} opacity="0.6" />

      {/* Socle en couches */}
      <g>
        <path d="M315 395 L520 300 L315 214 L110 300 Z" fill={VS} opacity="0.7" />
        <path d="M315 378 L500 293 L315 215 L130 293 Z" fill="url(#socle)" stroke={VL} />
        <path d="M315 360 L470 290 L315 225 L160 290 Z" fill="#fff" stroke={VL} />
        <path d="M315 342 L440 288 L315 236 L190 288 Z" fill="none" stroke={V} strokeWidth="2.5" strokeOpacity="0.55" />
      </g>

      {/* Téléphone : la conversation */}
      <g filter="url(#ombre)">
        <rect x="245" y="62" width="140" height="232" rx="20" fill="#fff" stroke={VL} />
        <rect x="245" y="62" width="140" height="38" rx="20" fill={VS} />
        <rect x="245" y="82" width="140" height="18" fill={VS} />
        <circle cx="267" cy="81" r="9" fill={WA} />
        <path d="M262 81.5 l3.5 3.5 l6 -7" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="282" y="76" width="54" height="6" rx="3" fill={V} opacity="0.55" />
        <rect x="282" y="86" width="34" height="4" rx="2" fill={V} opacity="0.25" />
        {/* bulles */}
        <rect x="258" y="112" width="86" height="22" rx="8" fill="#F4F2F7" />
        <rect x="266" y="120" width="60" height="5" rx="2.5" fill="#C9C3D1" />
        <rect x="292" y="142" width="80" height="22" rx="8" fill={VS} />
        <rect x="300" y="150" width="56" height="5" rx="2.5" fill={V} opacity="0.5" />
        {/* fiche produit */}
        <rect x="258" y="174" width="114" height="62" rx="10" fill="#fff" stroke={VL} />
        <rect x="266" y="182" width="36" height="36" rx="7" fill={VL} />
        <path d="M270 212 l9 -11 l7 8 l5 -5 l7 8 Z" fill={V} opacity="0.55" />
        <circle cx="292" cy="190" r="3" fill="#fff" />
        <rect x="310" y="186" width="52" height="5" rx="2.5" fill="#C9C3D1" />
        <rect x="310" y="196" width="34" height="5" rx="2.5" fill={V} opacity="0.6" />
        <rect x="310" y="208" width="52" height="16" rx="8" fill={V} />
        <rect x="320" y="214" width="32" height="4" rx="2" fill="#fff" />
        <rect x="258" y="246" width="70" height="20" rx="8" fill="#F4F2F7" />
        <rect x="266" y="253" width="48" height="5" rx="2.5" fill="#C9C3D1" />
      </g>

      {/* Loupe */}
      <g transform="rotate(-8 400 140)">
        <circle cx="392" cy="132" r="40" fill="#fff" fillOpacity="0.35" stroke="url(#loupe)" strokeWidth="10" />
        <circle cx="392" cy="132" r="40" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
        <path d="M421 162 L452 196" stroke="url(#loupe)" strokeWidth="16" strokeLinecap="round" />
      </g>

      {/* Les tuiles : discussion, ventes, catalogue, bon de commande */}
      <Tuile x={82} y={28}>
        <path d="M44 22 c-13 0 -23 9 -23 21 c0 4 1 8 4 11 l-3 11 l12 -4 c3 2 6 3 10 3 c13 0 23 -9 23 -21 s-10 -21 -23 -21 Z"
          fill="none" stroke={WA} strokeWidth="4.5" strokeLinejoin="round" />
        <path d="M36 38 c1 6 7 12 13 13 l4 -4 l5 3 c-1 4 -4 6 -8 5 c-8 -2 -15 -9 -17 -17 c-1 -4 1 -7 5 -8 l3 5 Z" fill={WA} />
      </Tuile>
      <Tuile x={460} y={28}>
        <rect x="22" y="48" width="11" height="18" rx="3" fill={V} />
        <rect x="38" y="36" width="11" height="30" rx="3" fill={V} />
        <rect x="54" y="22" width="11" height="44" rx="3" fill={VD} />
      </Tuile>
      <Tuile x={62} y={226}>
        <path d="M24 32 h40 l-4 34 h-32 Z" fill="none" stroke={V} strokeWidth="4.5" strokeLinejoin="round" />
        <path d="M34 32 v-5 a10 10 0 0 1 20 0 v5" fill="none" stroke={V} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="38" cy="45" r="2.8" fill={V} />
        <circle cx="50" cy="45" r="2.8" fill={V} />
      </Tuile>
      <Tuile x={480} y={226}>
        <rect x="24" y="18" width="40" height="52" rx="6" fill={V} />
        <rect x="31" y="28" width="26" height="5" rx="2.5" fill="#fff" />
        <rect x="31" y="38" width="20" height="4" rx="2" fill="#fff" opacity="0.75" />
        <rect x="31" y="46" width="24" height="4" rx="2" fill="#fff" opacity="0.75" />
        <path d="M33 58 l5 5 l10 -11" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Tuile>
    </svg>
  );
}
