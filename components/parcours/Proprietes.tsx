"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Les réglages du nœud sélectionné sur le canevas : le contenu d'un bloc, ses
// interactions (boutons de réponse), sa suite ; ou un déclencheur ; ou, sans
// sélection, les réglages du parcours entier.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2, Zap } from "lucide-react";
import {
  attend, choixDe, nouvelId, TERMINAUX, TYPES,
  type Bloc, type Choix, type Declencheur, type Parcours, type Probleme,
} from "@/lib/parcours-regles";
import { estDeclencheur, indexDecl, renommer, supprimerBloc, supprimerDeclencheur } from "./graphe";
import { COULEURS, ICONES } from "./Canevas";
import ChampMedia, { type MediasAccueil } from "./ChampMedia";

type Props = {
  p: Parcours;
  selection: string | null;
  erreurs: Probleme[];
  changer: (f: (q: Parcours) => void) => void;
  onSelection: (id: string | null) => void;
  agentId: string;
  accueil: MediasAccueil;
};

const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const nettoyer = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "");

export default function Proprietes({ p, selection, erreurs, changer, onSelection, agentId, accueil }: Props) {
  if (selection && estDeclencheur(selection)) {
    const i = indexDecl(selection);
    const d = p.declencheurs[i];
    if (!d) return null;
    return <ReglagesDeclencheur p={p} i={i} d={d} changer={changer} onSelection={onSelection} />;
  }
  const i = selection ? p.blocs.findIndex((b) => b.id === selection) : -1;
  if (i < 0) return <ReglagesParcours p={p} changer={changer} />;
  return (
    <ReglagesBloc key={p.blocs[i].id} p={p} i={i} changer={changer} onSelection={onSelection} agentId={agentId} accueil={accueil}
      erreurs={erreurs.filter((e) => e.chemin === `blocs[${i}]` || e.chemin.startsWith(`blocs[${i}].`))} />
  );
}

// ── Petits éléments ─────────────────────────────────────────────────────────

function Champ({ libelle, children, aide }: { libelle: string; children: React.ReactNode; aide?: string }) {
  return (
    <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
      {libelle}
      {children}
      {aide && <span className="text-[11.5px]" style={{ color: "#A39DAD" }}>{aide}</span>}
    </label>
  );
}

function Cibles({ p, exclure, valeur, onChange, vide }: { p: Parcours; exclure?: string; valeur?: string; onChange: (v: string | undefined) => void; vide: string }) {
  return (
    <select className="ui-champ" value={valeur || ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{vide}</option>
      {p.blocs.filter((b) => b.id !== exclure).map((b) => <option key={b.id} value={b.id}>{b.id}</option>)}
    </select>
  );
}

// ── Le parcours entier ──────────────────────────────────────────────────────

function ReglagesParcours({ p, changer }: { p: Parcours; changer: Props["changer"] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Réglages du parcours</p>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
          Cliquez un bloc sur le canevas pour le régler. Le bouton <strong>+</strong> en haut à gauche ajoute un bloc ;
          tirez une flèche d&apos;une sortie (point à droite) vers un bloc pour les relier ; <kbd>Suppr</kbd> enlève ce qui est sélectionné.
        </p>
      </div>
      <Champ libelle="Nom du parcours">
        <input className="ui-champ" value={p.nom || ""} onChange={(e) => changer((q) => { q.nom = e.target.value; })} />
      </Champ>
      <Champ libelle="Un message qui ne correspond à rien" aide="Quand le client écrit hors des boutons, mots-clés et accueil.">
        <select className="ui-champ" value={p.par_defaut || "silence"} onChange={(e) => changer((q) => { q.par_defaut = e.target.value; })}>
          <option value="silence">Camille se tait (l&apos;équipe répond)</option>
          <option value="agent">L&apos;IA de l&apos;agent répond</option>
          {p.blocs.map((b) => <option key={b.id} value={b.id}>Aller au bloc « {b.id} »</option>)}
        </select>
      </Champ>
    </div>
  );
}

// ── Un déclencheur ──────────────────────────────────────────────────────────

function ReglagesDeclencheur({ p, i, d, changer, onSelection }: {
  p: Parcours; i: number; d: Declencheur; changer: Props["changer"]; onSelection: Props["onSelection"];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px] text-white" style={{ background: COULEURS.declencheur }}><Zap className="h-4 w-4" /></span>
        <p className="flex-1 text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Déclencheur</p>
        <button className="pc-btn-rond" title="Supprimer" onClick={() => { changer((q) => supprimerDeclencheur(q, i)); onSelection(null); }}><Trash2 className="h-4 w-4" /></button>
      </div>
      <Champ libelle="Quand">
        <select className="ui-champ" value={d.type} onChange={(e) => changer((q) => {
          const t = e.target.value as Declencheur["type"];
          q.declencheurs[i] = t === "mot_cle" ? { type: t, mots: [], mode: "commence", vers: d.vers }
            : t === "bouton" ? { type: t, id: "", vers: d.vers } : { type: t, vers: d.vers };
        })}>
          <option value="nouveau_contact">Un nouveau contact écrit</option>
          <option value="mot_cle">Le message contient un mot-clé</option>
          <option value="bouton">Le client appuie sur un bouton</option>
        </select>
      </Champ>
      {d.type === "mot_cle" && <>
        <Champ libelle="Mots-clés (séparés par des virgules)">
          <input className="ui-champ" value={d.mots.join(", ")}
            onChange={(e) => changer((q) => { (q.declencheurs[i] as Extract<Declencheur, { type: "mot_cle" }>).mots = e.target.value.split(",").map((m) => m.trim()); })} />
        </Champ>
        <Champ libelle="Le message">
          <select className="ui-champ" value={d.mode || "commence"}
            onChange={(e) => changer((q) => { (q.declencheurs[i] as Extract<Declencheur, { type: "mot_cle" }>).mode = e.target.value as "commence"; })}>
            <option value="commence">commence par</option>
            <option value="contient">contient</option>
            <option value="exact">est exactement</option>
          </select>
        </Champ>
      </>}
      {d.type === "bouton" && (
        <Champ libelle="Identifiant du bouton" aide="Le même que celui d'un bouton de réponse : où qu'il soit appuyé, il mène ici.">
          <input className="ui-champ font-mono" value={d.id}
            onChange={(e) => changer((q) => { (q.declencheurs[i] as Extract<Declencheur, { type: "bouton" }>).id = nettoyer(e.target.value); })} />
        </Champ>
      )}
      <Champ libelle="Aller au bloc">
        <Cibles p={p} valeur={d.vers} vide="Choisir…" onChange={(v) => changer((q) => { q.declencheurs[i].vers = v || ""; })} />
      </Champ>
    </div>
  );
}

// ── Un bloc ─────────────────────────────────────────────────────────────────

function ReglagesBloc({ p, i, erreurs, changer, onSelection, agentId, accueil }: {
  p: Parcours; i: number; erreurs: Probleme[]; changer: Props["changer"]; onSelection: Props["onSelection"];
  agentId: string; accueil: MediasAccueil;
}) {
  const b = p.blocs[i];
  const [id, setId] = useState(b.id);
  useEffect(() => setId(b.id), [b.id]);
  const maj = (f: (x: Bloc & Record<string, unknown>) => void) => changer((q) => f(q.blocs[i] as Bloc & Record<string, unknown>));
  const val = (cle: string) => {
    const v = (b as unknown as Record<string, unknown>)[cle];
    return v === undefined || v === null ? "" : String(v);
  };
  const texte = (cle: string, libelle: string, opts: { long?: boolean; type?: string; placeholder?: string; aide?: string } = {}) => (
    <Champ libelle={libelle} aide={opts.aide}>
      {opts.long
        ? <textarea className="ui-champ min-h-[96px]" value={val(cle)} placeholder={opts.placeholder} onChange={(e) => maj((x) => { x[cle] = e.target.value; })} />
        : <input className="ui-champ" type={opts.type || "text"} value={val(cle)} placeholder={opts.placeholder}
            onChange={(e) => maj((x) => { x[cle] = opts.type === "number" ? Number(e.target.value) : e.target.value; })} />}
    </Champ>
  );
  const type = TYPES.find((t) => t.type === b.type)!;
  const Icone = ICONES[b.type];
  const peutInteragir = b.type === "texte" || b.type === "image" || b.type === "video";
  const choix = choixDe(b);
  const maxChoix = b.type === "liste" ? 10 : 3;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px] text-white" style={{ background: COULEURS[type.famille] }}><Icone className="h-4 w-4" /></span>
        <p className="flex-1 text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>{type.libelle}</p>
        <button className="pc-btn-rond" title="Dupliquer" onClick={() => {
          let nouveau = "";
          changer((q) => {
            const c = copie(q.blocs[i]); nouveau = c.id = nouvelId(q, c.type); delete c.suite;
            q.blocs.splice(i + 1, 0, c);
            const pos = q.ui?.positions?.[b.id];
            if (pos) q.ui!.positions![nouveau] = { x: pos.x + 40, y: pos.y + 160 };
          });
          setTimeout(() => onSelection(nouveau), 0);
        }}><Copy className="h-4 w-4" /></button>
        <button className="pc-btn-rond" title="Supprimer" onClick={() => { changer((q) => supprimerBloc(q, b.id)); onSelection(null); }}><Trash2 className="h-4 w-4" /></button>
      </div>
      <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{type.aide}</p>

      <Champ libelle="Identifiant" aide="Minuscules, chiffres, - ou _. Renommer met à jour toutes les flèches.">
        <input className="ui-champ font-mono text-[12.5px]" value={id} onChange={(e) => setId(nettoyer(e.target.value))}
          onBlur={() => { if (id !== b.id) { let ok = false; changer((q) => { ok = renommer(q, b.id, id); }); if (ok) onSelection(id); else setId(b.id); } }} />
      </Champ>

      {b.type === "texte" && texte("texte", "Message", { long: true, placeholder: "Bonjour {prenom} 👋" })}
      {(b.type === "image" || b.type === "video" || b.type === "vocal" || b.type === "document") && (
        <ChampMedia type={b.type} url={b.url} agentId={agentId} accueil={accueil} onChange={(u) => maj((x) => { x.url = u; })} />
      )}
      {(b.type === "image" || b.type === "video") && <>{texte("legende", choix.length ? "Texte du message (obligatoire avec des boutons)" : "Légende", { long: true })}</>}
      {b.type === "document" && <>{texte("nom", "Nom du fichier")}{texte("legende", "Légende")}</>}
      {b.type === "lien" && <>{texte("url", "Adresse (https://…)")}{texte("texte", "Texte avant le lien", { long: true })}</>}
      {b.type === "bouton_lien" && <>{texte("texte", "Message", { long: true })}{texte("libelle", "Texte du bouton (20 max)")}{texte("url", "Adresse (https://…)")}</>}
      {(b.type === "boutons" || b.type === "liste") && <>
        {texte("texte", "Message", { long: true })}
        {b.type === "liste" && texte("bouton", "Bouton qui ouvre la liste (20 max)")}
        {texte("pied", "Petit texte en bas (facultatif)")}
      </>}
      {b.type === "position" && texte("texte", "Message", { long: true })}
      {b.type === "reaction" && (
        <Champ libelle="Emoji">
          <div className="flex flex-wrap gap-1.5">
            {["👍", "❤️", "🙏", "😊", "🔥", "✅", "🎉", "👀"].map((e) => (
              <button key={e} className="h-10 w-10 rounded-[12px] text-[20px]" style={{ background: b.emoji === e ? "#19171B" : "#F4F2F7" }}
                onClick={() => maj((x) => { x.emoji = e; })}>{e}</button>
            ))}
            <input className="ui-champ w-[70px] text-center" value={b.emoji} onChange={(e) => maj((x) => { x.emoji = e.target.value; })} />
          </div>
        </Champ>
      )}
      {b.type === "pause" && texte("secondes", "Secondes (1 à 15)", { type: "number" })}
      {b.type === "aller" && (
        <Champ libelle="Aller au bloc"><Cibles p={p} exclure={b.id} valeur={b.vers} vide="Choisir…" onChange={(v) => maj((x) => { x.vers = v || ""; })} /></Champ>
      )}
      {b.type === "humain" && <>
        {texte("message", "Message au client au moment du transfert", { long: true })}
        {texte("attente", "Si le client réécrit pendant l'attente (envoyé une fois)", { long: true })}
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cl-ink)" }}>
          <input type="checkbox" checked={b.alerte !== false} onChange={(e) => maj((x) => { x.alerte = e.target.checked; })} />
          Prévenir le commerçant
        </label>
      </>}

      {(peutInteragir || b.type === "boutons" || b.type === "liste") && (
        <div className="space-y-2 rounded-[18px] p-3" style={{ background: "#F7F5FA" }}>
          <p className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>
            {b.type === "liste" ? "Choix de la liste" : peutInteragir ? "Interactions : boutons de réponse" : "Boutons"}
          </p>
          {peutInteragir && !choix.length && (
            <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Ajoutez jusqu&apos;à 3 boutons sous ce message : chacun mène à sa propre suite.</p>
          )}
          {choix.map((c: Choix, j: number) => (
            <div key={j} className="grid gap-1.5 rounded-[14px] bg-white p-2">
              <div className="flex gap-1.5">
                <input className="ui-champ min-w-0 flex-1" placeholder="Titre (20 max)" value={c.titre}
                  onChange={(e) => maj((x) => { choixDe(x as Bloc)[j].titre = e.target.value; })} />
                <button className="pc-btn-rond" title="Retirer" onClick={() => maj((x) => {
                  const l = choixDe(x as Bloc); l.splice(j, 1);
                  if (!l.length && peutInteragir) { delete x.boutons; delete x.sinon; }
                })}><Trash2 className="h-4 w-4" /></button>
              </div>
              {b.type === "liste" && <input className="ui-champ" placeholder="Description (facultatif)" value={c.description || ""}
                onChange={(e) => maj((x) => { choixDe(x as Bloc)[j].description = e.target.value; })} />}
              <div className="grid gap-1.5">
                <input className="ui-champ font-mono text-[11.5px]" title="Identifiant" value={c.id}
                  onChange={(e) => maj((x) => { choixDe(x as Bloc)[j].id = nettoyer(e.target.value); })} />
                <Cibles p={p} exclure={b.id} valeur={c.vers} vide="→ (tirer une flèche)" onChange={(v) => maj((x) => { choixDe(x as Bloc)[j].vers = v; })} />
              </div>
            </div>
          ))}
          {choix.length < maxChoix && (
            <button className="flex items-center gap-1 text-[13px] font-medium" style={{ color: "var(--cl-accent-deep)" }}
              onClick={() => maj((x) => {
                const cle = x.type === "liste" ? "lignes" : "boutons";
                const l = (x[cle] as Choix[] | undefined) || [];
                let k = l.length + 1;
                while (l.some((c) => c.id === `${x.id}_${k}`)) k++;
                x[cle] = [...l, { id: `${x.id}_${k}`.slice(0, 40), titre: "" }];
              })}>
              <Plus className="h-4 w-4" /> {b.type === "liste" ? "Ajouter un choix" : "Ajouter un bouton"}
            </button>
          )}
        </div>
      )}

      {(attend(b) || b.type === "position") && (
        <Champ libelle="Si le client répond autre chose">
          <Cibles p={p} exclure={b.id} valeur={(b as { sinon?: string }).sinon} vide="Comportement par défaut" onChange={(v) => maj((x) => { if (v) x.sinon = v; else delete x.sinon; })} />
        </Champ>
      )}
      {!TERMINAUX.includes(b.type) && b.type !== "aller" && (!attend(b) || b.type === "position") && (
        <Champ libelle={b.type === "position" ? "Quand la position est reçue" : "Ensuite"}>
          <Cibles p={p} exclure={b.id} valeur={b.suite} vide="(s'arrête ici)" onChange={(v) => maj((x) => { if (v) x.suite = v; else delete x.suite; })} />
        </Champ>
      )}

      {erreurs.length > 0 && (
        <ul className="space-y-0.5 rounded-[14px] p-3 text-[12.5px]" style={{ background: "#FBEAE6", color: "#A63D28" }}>
          {erreurs.map((e) => <li key={e.chemin + e.message}>• {e.message}</li>)}
        </ul>
      )}
      <style jsx global>{`
        .pc-btn-rond { display: inline-flex; flex-shrink: 0; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 999px; background: #F4F2F7; color: var(--cl-ink); }
        .pc-btn-rond:hover { background: #19171B; color: #fff; }
      `}</style>
    </div>
  );
}
