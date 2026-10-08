"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Les pièces communes des pages du tableau de bord, dans l'identité de
// l'accueil : formes rondes, encre presque noire, lavande, petites animations
// à ressort. Une page s'écrit avec elles plutôt qu'avec des styles en ligne :
// quand l'identité bouge, elle bouge partout.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Doodle, type NomDoodle } from "./Doodle";
import { RESSORT } from "./coquille/Entete";

/** L'apparition échelonnée des blocs d'une page. */
export const apparait = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { ...RESSORT, delay: Math.min(i, 10) * 0.045 },
});

// ── Les filtres : des boutons radio arrondis, la pastille noire glisse ──────

export function Filtres<T extends string>({ valeur, onChange, options, id, label }: {
  valeur: T; onChange: (v: T) => void; id: string; label: string;
  options: { cle: T; libelle: string; compte?: number; alerte?: boolean }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="ui-filtres flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
      {options.map(({ cle, libelle, compte, alerte }) => {
        const actif = valeur === cle;
        return (
          <button key={cle} role="radio" aria-checked={actif} onClick={() => onChange(cle)}
            className="relative flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13.5px] transition-colors"
            style={{ color: actif ? "#fff" : "var(--cl-ink-soft)" }}>
            {actif && <motion.span layoutId={`ui-filtre-${id}`} transition={RESSORT} className="absolute inset-0 rounded-full" style={{ background: "var(--cl-ink)" }} />}
            <span className="relative">{libelle}</span>
            {compte !== undefined && (
              <span className="relative rounded-full px-1.5 text-[11.5px] tabular-nums"
                style={{
                  background: actif ? "rgba(255,255,255,0.18)" : alerte && compte > 0 ? "#FDE7C7" : "#EAE6F1",
                  color: actif ? "#fff" : alerte && compte > 0 ? "#8A5A00" : "var(--cl-ink-faint)",
                }}>
                {compte}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Les boutons ─────────────────────────────────────────────────────────────

type Variante = "encre" | "clair" | "doux" | "danger" | "vert";
const VARIANTES: Record<Variante, React.CSSProperties> = {
  encre:  { background: "var(--cl-ink)", color: "#fff" },
  clair:  { background: "#fff", color: "var(--cl-ink)", boxShadow: "inset 0 0 0 1px var(--cl-line)" },
  doux:   { background: "#F4F2F7", color: "var(--cl-ink)" },
  danger: { background: "#fff", color: "#A63D28", boxShadow: "inset 0 0 0 1px #F0D2CB" },
  vert:   { background: "#E4F6EA", color: "#1E6A37" },
};

export function Bouton({ variante = "clair", icone: Icone, occupe, children, className = "", ...reste }: {
  variante?: Variante; icone?: React.ElementType; occupe?: boolean; children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof motion.button>, "children">) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} transition={RESSORT}
      className={`ui-bouton inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={VARIANTES[variante]} {...reste}>
      {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : Icone ? <Icone className="h-4 w-4" /> : null}
      {children}
    </motion.button>
  );
}

export function LienBouton({ variante = "clair", icone: Icone, children, className = "", ...reste }: {
  variante?: Variante; icone?: React.ElementType; children?: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`ui-bouton inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium ${className}`}
      style={VARIANTES[variante]} {...reste}>
      {Icone ? <Icone className="h-4 w-4" /> : null}
      {children}
    </a>
  );
}

export function BoutonRond({ icone: Icone, label, tourne, className = "", ...reste }: {
  icone: React.ElementType; label: string; tourne?: boolean;
} & Omit<React.ComponentProps<typeof motion.button>, "children">) {
  return (
    <motion.button whileTap={{ scale: 0.92 }} transition={RESSORT} aria-label={label} title={label}
      className={`ui-rond flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${className}`} {...reste}>
      <Icone className={"h-4 w-4 " + (tourne ? "animate-spin" : "")} />
    </motion.button>
  );
}

// ── Les pastilles d'état ────────────────────────────────────────────────────

export type Ton = "vert" | "ambre" | "violet" | "rouge" | "gris" | "bleu";
export const TONS: Record<Ton, { fond: string; encre: string }> = {
  vert:   { fond: "#E4F6EA", encre: "#1E7A3A" },
  ambre:  { fond: "#FDF1DC", encre: "#9A6510" },
  violet: { fond: "#F0EBFF", encre: "#6442E8" },
  rouge:  { fond: "#FBEAE6", encre: "#A63D28" },
  gris:   { fond: "#F1EFF4", encre: "#6B6773" },
  bleu:   { fond: "#E6EEFD", encre: "#1D4ED8" },
};

export function Pastille({ ton = "gris", point, children, className = "" }: {
  ton?: Ton; point?: boolean; children: React.ReactNode; className?: string;
}) {
  const t = TONS[ton];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium ${className}`}
      style={{ background: t.fond, color: t.encre }}>
      {point && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.encre }} />}
      {children}
    </span>
  );
}

// ── Les bandeaux ────────────────────────────────────────────────────────────

export function Bandeau({ ton = "ambre", titre, children, action }: {
  ton?: "ambre" | "rouge" | "vert" | "violet"; titre?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode;
}) {
  const t = TONS[ton];
  const Icone = ton === "vert" ? CheckCircle2 : ton === "violet" ? Info : AlertTriangle;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={RESSORT}
      className="flex flex-wrap items-start gap-3 rounded-[22px] px-5 py-4 text-[13.5px] leading-relaxed" style={{ background: t.fond, color: t.encre }}>
      <Icone className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        {titre && <p className="font-semibold">{titre}</p>}
        {children}
      </div>
      {action}
    </motion.div>
  );
}

// ── Le vide, illustré ───────────────────────────────────────────────────────

export function Vide({ doodle, titre, texte, action }: {
  doodle: NomDoodle; titre: string; texte?: string; action?: React.ReactNode;
}) {
  return (
    <motion.div {...apparait(0)} className="flex flex-col items-center rounded-[28px] px-6 py-10 text-center" style={{ background: "#FAF9FC" }}>
      <Doodle nom={doodle} className="ui-flotte h-[150px] w-auto" />
      <p className="mt-5 text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>{titre}</p>
      {texte && <p className="mt-1 max-w-md text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{texte}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

// ── Les tuiles de chiffres ──────────────────────────────────────────────────

export function Tuile({ icone: Icone, titre, valeur, sous, fort, rang = 0, onClick, actif }: {
  icone: React.ElementType; titre: string; valeur: React.ReactNode; sous?: React.ReactNode;
  fort?: boolean; rang?: number; onClick?: () => void; actif?: boolean;
}) {
  const Balise = onClick ? motion.button : motion.div;
  return (
    <Balise {...apparait(rang)} onClick={onClick}
      className={"ui-tuile relative flex flex-col overflow-hidden rounded-[26px] p-5 text-left " + (onClick ? "cursor-pointer" : "")}
      data-fort={fort ? "1" : undefined} data-actif={actif ? "1" : undefined}>
      <div className="flex items-center justify-between">
        <span className="text-[13px]" style={{ color: fort ? "rgba(255,255,255,0.75)" : "var(--cl-ink-faint)" }}>{titre}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: fort ? "rgba(255,255,255,0.16)" : "var(--cl-accent-soft)", color: fort ? "#fff" : "var(--cl-accent-deep)" }}>
          <Icone className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-[32px] font-light leading-none tracking-[-0.03em] tabular-nums" style={{ color: fort ? "#fff" : "var(--cl-ink)" }}>{valeur}</p>
      {sous && <p className="mt-1.5 text-[12.5px]" style={{ color: fort ? "rgba(255,255,255,0.7)" : "var(--cl-ink-faint)" }}>{sous}</p>}
    </Balise>
  );
}

/** Le squelette d'une liste qui charge. */
export function Squelettes({ n = 3, hauteur = 110 }: { n?: number; hauteur?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="ui-squelette rounded-[26px]" style={{ height: hauteur, animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

/** Les styles des pièces, posés une fois par page. */
export function StylesUI() {
  return (
    <style jsx global>{`
      .ui-filtres { background: #F4F2F7; scrollbar-width: none; }
      .ui-filtres::-webkit-scrollbar { display: none; }
      .ui-bouton { transition: filter .2s ease, transform .2s cubic-bezier(.34,1.56,.64,1); }
      .ui-bouton:hover:not(:disabled) { filter: brightness(0.97); }
      .ui-rond { background: #fff; color: var(--cl-ink); box-shadow: inset 0 0 0 1px var(--cl-line); transition: transform .2s cubic-bezier(.34,1.56,.64,1); }
      .ui-rond:hover:not(:disabled) { transform: scale(1.06); }
      .ui-carte { border: 1px solid var(--cl-line-soft); background: #fff; transition: box-shadow .25s ease, border-color .25s ease, transform .25s cubic-bezier(.34,1.56,.64,1); }
      .ui-carte:hover { box-shadow: 0 14px 32px rgba(70,40,190,0.08); border-color: var(--cl-lavender); }
      .ui-tuile { border: 1px solid var(--cl-line-soft); background: #fff; transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease; }
      .ui-tuile[data-fort] { border-color: transparent; background: linear-gradient(150deg, #8F75F6 0%, #B6A4FA 100%); }
      .ui-tuile[data-actif] { box-shadow: 0 0 0 2px var(--cl-accent); }
      button.ui-tuile:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(70,40,190,0.10); }
      .ui-champ { height: 44px; width: 100%; border-radius: 999px; padding: 0 18px; font-size: 14px; background: #F7F6FA; color: var(--cl-ink);
        border: 1px solid transparent; outline: none; transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease; }
      textarea.ui-champ { height: auto; border-radius: 22px; padding: 14px 18px; line-height: 1.5; resize: vertical; }
      .ui-champ:focus { background: #fff; border-color: var(--cl-accent); box-shadow: 0 0 0 4px rgba(124,90,248,0.12); }
      .ui-squelette { background: linear-gradient(90deg, #F4F2F7 0%, #FBFAFD 50%, #F4F2F7 100%); background-size: 200% 100%; animation: ui-reflet 1.4s ease-in-out infinite; }
      @keyframes ui-reflet { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      .ui-flotte { animation: ui-flotte 5s ease-in-out infinite; }
      @keyframes ui-flotte { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @media (prefers-reduced-motion: reduce) { .ui-flotte, .ui-squelette { animation: none; } }
    `}</style>
  );
}
