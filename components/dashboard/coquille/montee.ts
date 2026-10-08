"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La feuille blanche qui monte ou descend d'une page à l'autre.
//
// L'accueil et les autres pages ont chacune leur feuille, à des hauteurs
// différentes. En partant, une feuille note où se trouvait son bord haut ; la
// suivante, en arrivant, part de là et glisse jusqu'à sa place. Vers une page,
// elle remonte sous le menu ; vers l'accueil, elle redescend sous le carrousel.
// ─────────────────────────────────────────────────────────────────────────────

import { useLayoutEffect, type RefObject } from "react";

let dernierBord: number | null = null;

const bordDe = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

export function useMontee(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const depart = dernierBord;
    dernierBord = null;
    const calme = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (depart != null && !calme) {
      const limite = window.innerHeight * 0.8;
      const d = Math.max(-limite, Math.min(limite, depart - bordDe(el)));
      if (Math.abs(d) > 4) {
        el.animate(
          [{ transform: `translateY(${d}px)` }, { transform: "translateY(0)" }],
          { duration: 640, easing: "cubic-bezier(0.22, 1.12, 0.36, 1)" }
        );
      }
    }
    // Au départ, l'élément est encore dans la page : on note son bord.
    return () => { dernierBord = bordDe(el); };
  }, [ref]);
}
