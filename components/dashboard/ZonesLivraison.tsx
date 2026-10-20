"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { QUARTIERS, VILLES, appliquerTarif, ecrireBareme, lireBareme, type Zone } from "@/lib/quartiers";

const sans = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Le barème de livraison, sans rien taper : choisir la ville, cocher les
 * quartiers dans la liste, donner le tarif, ajouter. Le barème reste stocké
 * en texte (« Akwa = 500 » par ligne) : c'est ce que la page enregistre déjà.
 */
export function ZonesLivraison({ texte, onChange }: { texte: string; onChange: (texte: string) => void }) {
  const zones = useMemo(() => lireBareme(texte), [texte]);
  const [ville, setVille] = useState(VILLES[0]);
  const [cherche, setCherche] = useState("");
  const [coches, setCoches] = useState<string[]>([]);
  const [tarif, setTarif] = useState(1000);
  const [libre, setLibre] = useState("");

  const dejaLa = new Set(zones.map((z) => sans(z.zone)));
  const liste = QUARTIERS[ville].filter((q) => sans(q).includes(sans(cherche.trim())));
  const ecrire = (z: Zone[]) => onChange(ecrireBareme(z));
  const basculer = (q: string) => setCoches((c) => (c.includes(q) ? c.filter((x) => x !== q) : [...c, q]));
  const ajouter = () => {
    const noms = [...coches, ...(libre.trim() ? [libre.trim().slice(0, 40)] : [])];
    if (!noms.length) return;
    ecrire(appliquerTarif(zones, noms, Math.max(0, Math.round(tarif))));
    setCoches([]);
    setLibre("");
  };

  const ligne = { borderColor: "var(--cl-line, #E7E3EE)" };
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
        <select className="ui-champ" value={ville} onChange={(e) => { setVille(e.target.value); setCoches([]); }}>
          {VILLES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <input className="ui-champ" placeholder={`Chercher un quartier de ${ville}…`} value={cherche} onChange={(e) => setCherche(e.target.value)} />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-xl border p-2" style={ligne}>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {liste.map((q) => {
            const pris = dejaLa.has(sans(q));
            return (
              <label key={q} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-black/[.03]">
                <input type="checkbox" checked={coches.includes(q)} onChange={() => basculer(q)} />
                <span className="truncate" style={{ color: pris ? "var(--cl-ink-faint, #9A94A6)" : "var(--cl-ink, #19171B)" }}>
                  {q}{pris ? " ✓" : ""}
                </span>
              </label>
            );
          })}
          {!liste.length ? <span className="col-span-full px-2 py-1.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Aucun quartier ne correspond : ajoutez-le à la main ci-dessous.</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="ui-champ min-w-[150px] flex-1" placeholder="Autre quartier (facultatif)" value={libre} onChange={(e) => setLibre(e.target.value)} />
        <input className="ui-champ w-[120px]" type="number" min="0" step="100" value={tarif} onChange={(e) => setTarif(Number(e.target.value) || 0)} aria-label="Tarif en XAF" />
        <button
          type="button"
          onClick={ajouter}
          disabled={!coches.length && !libre.trim()}
          className="rounded-full px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: "var(--cl-ink, #19171B)" }}
        >
          Ajouter {coches.length + (libre.trim() ? 1 : 0) || ""} à {tarif.toLocaleString("fr-FR")} XAF
        </button>
      </div>

      {zones.length ? (
        <div className="overflow-hidden rounded-xl border" style={ligne}>
          {zones.map((z) => (
            <div key={z.zone} className="flex items-center gap-2 border-b px-3 py-1.5 text-[13px] last:border-b-0" style={ligne}>
              <span className="min-w-0 flex-1 truncate">{z.zone}</span>
              <input
                className="w-[96px] rounded-md border px-2 py-1 text-right text-[13px]"
                style={ligne}
                type="number" min="0" step="100" value={z.fee}
                onChange={(e) => ecrire(zones.map((x) => (x.zone === z.zone ? { ...x, fee: Number(e.target.value) || 0 } : x)))}
                aria-label={`Tarif ${z.zone}`}
              />
              <span className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>XAF</span>
              <button type="button" onClick={() => ecrire(zones.filter((x) => x.zone !== z.zone))} aria-label={`Retirer ${z.zone}`} className="p-1 opacity-60 hover:opacity-100">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
