"use client";

import { HORAIRES_RAPIDES, lireSemaine, resumeSemaine } from "@/lib/horaires";

/**
 * Sous le champ « Horaires » : des horaires courants en un clic, et ce que
 * Camille a compris du texte. Le commerçant voit tout de suite si « fermé le
 * dimanche » est bien passé — ou si son format ne se lit pas, auquel cas
 * Camille ne dira jamais aux clients qu'on est ouvert ou fermé.
 */
export function HorairesRapides({ valeur, onChoisir }: { valeur: string; onChoisir: (texte: string) => void }) {
  const semaine = lireSemaine(valeur);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {HORAIRES_RAPIDES.map((h) => (
          <button
            key={h.nom}
            type="button"
            onClick={() => onChoisir(h.texte)}
            title={h.texte}
            className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition hover:opacity-80"
            style={
              valeur.trim() === h.texte
                ? { background: "var(--cl-ink, #19171B)", color: "#fff", borderColor: "var(--cl-ink, #19171B)" }
                : { borderColor: "var(--cl-line, #E7E3EE)", color: "var(--cl-ink-soft, #5F5A6B)" }
            }
          >
            {h.nom}
          </button>
        ))}
      </div>
      {valeur.trim() ? (
        <p className="text-[11.5px] leading-[1.45]" style={{ color: semaine ? "var(--cl-ink-soft, #5F5A6B)" : "#B4561F" }}>
          {semaine
            ? `Camille a compris : ${resumeSemaine(semaine)}`
            : "Camille ne comprend pas ce format : elle ne pourra pas dire aux clients si vous êtes ouvert. Écrivez par ex. « Lun-Sam 8h-19h, Dim fermé »."}
        </p>
      ) : null}
    </div>
  );
}
