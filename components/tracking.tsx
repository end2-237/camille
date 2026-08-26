"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le suivi de livraison — les pièces communes aux deux écrans.
//
// Le vendeur et le livreur regardent la même chose : une pile d'expéditions à
// gauche, une carte à droite. Seul le bas de la carte dépliée change — le
// vendeur y voit son livreur, le livreur y trouve ses boutons.
//
// D'où ce fichier : le dessin vit à un seul endroit. Deux copies auraient
// divergé au premier ajustement.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { ArrowUp, Check, ChevronDown, ChevronUp, Copy, Package, Search, Truck } from "lucide-react";

export const VIOLET = "#7C5AF8";
export const LIGNE = "#EDEDF2";
export const GRIS = "#8A8790";
export const GRIS_PALE = "#9A97A0";

export type Etape = { at: string; label: string; kind: string };

export const heure = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
export const jour = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "—";

/** L'état de l'expédition, dit en deux mots et coloré comme tel. */
const ETAT: Record<string, { texte: string; fond: string; encre: string }> = {
  nouvelle:      { texte: "À TRAITER",  fond: "#F3F7E4", encre: "#4A6B00" },
  en_traitement: { texte: "EN CUISINE", fond: "#FDF1DC", encre: "#8A5A00" },
  traitee:       { texte: "EN CUISINE", fond: "#FDF1DC", encre: "#8A5A00" },
  en_livraison:  { texte: "EN COURS",   fond: "rgba(124,90,248,.12)", encre: VIOLET },
  livree:        { texte: "LIVRÉE",     fond: "#E4F8EC", encre: "#0e6b45" },
};
export const etat = (s: string) => ETAT[s] ?? ETAT.nouvelle;

/** Les deux colonnes. Sur téléphone elles s'empilent, carte en tête. */
export function Ecran({ aside, carte }: { aside: React.ReactNode; carte: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse lg:flex-row" style={{ height: "calc(100vh - 52px)", background: "#fff" }}>
      <aside
        className="flex w-full flex-1 flex-col overflow-y-auto lg:w-[320px] lg:flex-none"
        style={{ borderRight: `1px solid ${LIGNE}` }}
      >
        {aside}
      </aside>
      {/* « lg:h-auto » laissait la cellule sans hauteur définie : la carte, qui
          se mesure en pourcentage de son parent, se retrouvait haute de zéro —
          d'où le rectangle blanc avec ses seuls boutons de zoom. */}
      <div className="h-[38vh] w-full shrink-0 lg:h-full lg:flex-1">{carte}</div>
    </div>
  );
}

/** La barre de recherche et le compteur, en haut de la colonne. */
export function EnTete({
  valeur, onChange, onSubmit, placeholder, bouton, compteur, valeurCompteur,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  bouton: string;
  compteur: string;
  valeurCompteur: string | number;
}) {
  return (
    <div className="px-4 pb-3 pt-4">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex items-center gap-2">
        <input
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-[38px] min-w-0 flex-1 rounded-[9px] px-3 text-[13px] outline-none"
          style={{ border: "1px solid #E6E6EC", color: "#101012" }}
        />
        <button
          type="submit"
          className="flex h-[38px] items-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-semibold text-white"
          style={{ background: VIOLET }}
        >
          {bouton} <Search className="h-[15px] w-[15px]" />
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[13px]" style={{ color: GRIS }}>{compteur}</span>
        <strong className="text-[13px]" style={{ color: "#101012" }}>{valeurCompteur}</strong>
      </div>
    </div>
  );
}

/** Une expédition : l'en-tête cliquable, et ce qu'on y range dessous. */
export function Carte({
  reference, deplie, onToggle, children,
}: {
  reference: string; deplie: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  const [copie, setCopie] = useState(false);

  return (
    <article
      className="rounded-[10px] bg-white"
      style={{
        border: `1px solid ${deplie ? "rgba(124,90,248,.55)" : LIGNE}`,
        boxShadow: deplie ? "0 8px 24px rgba(124,90,248,.14)" : "none",
      }}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px]" style={{ background: "#F4F4F6" }}>
          <Package className="h-[17px] w-[17px]" style={{ color: "#5B5766" }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px]" style={{ color: GRIS_PALE }}>Numéro de commande</span>
          <span className="block truncate text-[13px] font-bold" style={{ color: "#101012" }}>{reference}</span>
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard?.writeText(reference);
            setCopie(true);
            setTimeout(() => setCopie(false), 1600);
          }}
          className="shrink-0 p-1"
          style={{ color: GRIS_PALE }}
          aria-label="Copier le numéro"
        >
          {copie ? <Check className="h-[15px] w-[15px]" /> : <Copy className="h-[15px] w-[15px]" />}
        </span>
        {deplie
          ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: GRIS_PALE }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: GRIS_PALE }} />}
      </button>

      {deplie && <div className="px-3 pb-3">{children}</div>}
    </article>
  );
}

export function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between py-[3.5px]">
      <span className="text-[12.5px]" style={{ color: GRIS }}>{label}</span>
      <strong className="text-[12.5px]" style={{ color: "#101012" }}>{valeur}</strong>
    </div>
  );
}

export function Adresse({ label, valeur }: { label: string; valeur: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px]" style={{ color: GRIS_PALE }}>{label}</div>
      <div className="truncate text-[12px]" style={{ color: "#101012" }} title={valeur ?? ""}>{valeur || "—"}</div>
    </div>
  );
}

/**
 * Le bloc encadré de la livraison : état, adresses, fil des étapes, puis ce que
 * l'écran veut mettre en bas — le livreur pour le vendeur, les boutons pour le
 * livreur.
 */
export function BlocLivraison({
  status, vers, depuis, etapes, pied,
}: {
  status: string; vers: string | null; depuis: string | null; etapes: Etape[]; pied?: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-[10px]" style={{ border: `1px solid ${LIGNE}` }}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Truck className="h-[17px] w-[17px]" style={{ color: "#101012" }} />
        <strong className="flex-1 text-[13px]" style={{ color: "#101012" }}>Informations de livraison</strong>
        <span
          className="rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-[.4px]"
          style={{ background: etat(status).fond, color: etat(status).encre }}
        >
          {etat(status).texte}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 px-3 pb-3">
        <Adresse label="Vers" valeur={vers} />
        <Adresse label="Depuis" valeur={depuis} />
      </div>

      {etapes.length > 0 && (
        <div className="px-3 pb-1">
          {etapes.map((e, i) => {
            const dernier = i === etapes.length - 1;
            return (
              <div key={`${e.kind}-${i}`} className="flex gap-3">
                <span className="w-[34px] shrink-0 pt-[3px] text-right text-[10.5px]" style={{ color: GRIS_PALE }}>
                  {heure(e.at)}
                </span>
                <span className="flex flex-col items-center">
                  <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white" style={{ border: `2px solid ${VIOLET}` }}>
                    {dernier
                      ? <Package className="h-[10px] w-[10px]" style={{ color: VIOLET }} />
                      : <ArrowUp className="h-[11px] w-[11px]" style={{ color: VIOLET }} />}
                  </span>
                  {!dernier && <span className="w-[2px] flex-1" style={{ background: "#E4DCFD" }} />}
                </span>
                <span className="flex-1 pb-3.5 text-[12px] leading-[1.35]" style={{ color: "#3B3946" }}>
                  {e.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {pied && <div style={{ borderTop: `1px solid ${LIGNE}` }}>{pied}</div>}
    </div>
  );
}

/** Le vide, dit proprement. */
export function Rien({ texte }: { texte: string }) {
  return (
    <p className="rounded-[10px] p-6 text-center text-[13px]" style={{ border: "1px dashed #E6E6EC", color: GRIS }}>
      {texte}
    </p>
  );
}
