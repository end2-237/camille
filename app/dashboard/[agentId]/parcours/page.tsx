"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Les parcours WhatsApp (forfait Entreprise) : l'accueil scripté, les médias,
// les boutons, le transfert à un humain, et l'IA seulement où on l'appelle.
//
// Deux façons d'écrire le même parcours : les blocs (pour le commerçant) et le
// JSON (pour l'équipe). On travaille sur un brouillon ; « Publier » fige une
// version, qu'on peut toujours remettre dans le brouillon.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, History, Plus, RotateCcw, Rocket, Save, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { Bandeau, Bouton, Filtres, Pastille, Squelettes, StylesUI } from "@/components/dashboard/ui";
import {
  MODELE_NOLIMIT, MODELE_VIDE, TYPES, blocVierge, nouvelId, valider,
  type Bloc, type Choix, type Declencheur, type Parcours, type Probleme, type TypeBloc,
} from "@/lib/parcours-regles";

type Donnees = {
  pret: boolean; entreprise: boolean; error?: string;
  brouillon: Parcours | null; publie: Parcours | null;
  version: number; actif: boolean; publie_at: string | null;
  versions: { version: number; publie_at: string }[];
};

type Onglet = "blocs" | "declencheurs" | "json" | "versions";

const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function ParcoursPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [d, setD] = useState<Donnees | null>(null);
  const [p, setP] = useState<Parcours | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("blocs");
  const [json, setJson] = useState("");
  const [jsonErreur, setJsonErreur] = useState("");
  const [modifie, setModifie] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [testeur, setTesteur] = useState("");

  const charger = useCallback(async () => {
    const r = await fetch(`/api/agents/${agentId}/parcours`, { headers: { ...authHeaders() } });
    const j = (await r.json().catch(() => null)) as Donnees | null;
    if (!j) return;
    setD(j);
    setP(j.brouillon ? copie(j.brouillon) : j.publie ? copie(j.publie) : null);
    setModifie(false);
  }, [agentId]);
  useEffect(() => { charger(); }, [charger]);

  const verdict = useMemo(() => (p ? valider(p) : null), [p]);
  const differentDuPublie = useMemo(() => Boolean(p && d?.publie && JSON.stringify(p) !== JSON.stringify(d.publie)), [p, d]);

  const changer = (f: (q: Parcours) => void) => {
    setP((ancien) => {
      if (!ancien) return ancien;
      const q = copie(ancien);
      f(q);
      return q;
    });
    setModifie(true);
  };

  async function enregistrer(silencieux = false): Promise<boolean> {
    if (!p) return false;
    setOccupe("enregistrer");
    try {
      const r = await fetch(`/api/agents/${agentId}/parcours`, {
        method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ brouillon: p }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Enregistrement refusé");
      setModifie(false);
      if (!silencieux) toast.success(j.erreurs?.length ? "Brouillon enregistré (avec des erreurs à corriger)" : "Brouillon enregistré");
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setOccupe(null);
    }
  }

  async function action(nom: string, corps: Record<string, unknown> = {}, succes?: string) {
    setOccupe(nom);
    try {
      const r = await fetch(`/api/agents/${agentId}/parcours`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ action: nom, ...corps }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Action refusée");
      if (succes) toast.success(succes);
      return j;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setOccupe(null);
    }
  }

  async function publier() {
    if (!verdict?.ok) { toast.error("Corrigez les erreurs avant de publier."); return; }
    if (!(await enregistrer(true))) return;
    const j = await action("publier");
    if (j) { toast.success(`Version ${j.version} publiée : les clients la reçoivent dès maintenant.`); charger(); }
  }

  function partirDe(modele: Parcours) {
    if (p && !confirm("Remplacer le brouillon actuel par ce modèle ?")) return;
    setP(copie(modele));
    setModifie(true);
    setOnglet("blocs");
  }

  function ouvrirJson() {
    setJson(p ? JSON.stringify(p, null, 2) : "");
    setJsonErreur("");
    setOnglet("json");
  }

  function appliquerJson() {
    try {
      const v = JSON.parse(json);
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Le parcours doit être un objet JSON.");
      setP(v);
      setModifie(true);
      setJsonErreur("");
      toast.success("JSON appliqué au brouillon (pensez à enregistrer)");
    } catch (e) {
      setJsonErreur((e as Error).message);
    }
  }

  if (!d) return <div className="py-8"><StylesUI /><Squelettes n={3} hauteur={120} /></div>;

  const ids = p?.blocs.map((b) => b.id) || [];

  return (
    <div className="space-y-4 py-6 lg:py-8">
      <StylesUI />
      {!d.pret && <Bandeau ton="ambre" titre="Une étape avant d'utiliser les parcours">{d.error}</Bandeau>}
      {d.pret && !d.entreprise && (
        <Bandeau ton="violet" titre="Forfait Entreprise">
          Vous pouvez écrire et enregistrer un parcours ; sa publication est réservée au forfait Entreprise.
        </Bandeau>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>
          <Workflow className="h-5 w-5" /> Parcours WhatsApp
          {d.version > 0 && <Pastille ton={d.actif ? "vert" : "gris"} point>{d.actif ? `En service · version ${d.version}` : `Désactivé · version ${d.version}`}</Pastille>}
          {(modifie || differentDuPublie) && <Pastille ton="ambre">Brouillon non publié</Pastille>}
        </p>
        <div className="flex flex-wrap gap-2">
          {p && <Bouton icone={Save} occupe={occupe === "enregistrer"} disabled={!!occupe} onClick={() => enregistrer()}>Enregistrer</Bouton>}
          {p && <Bouton variante="encre" icone={Rocket} occupe={occupe === "publier"} disabled={!!occupe || !d.entreprise || !verdict?.ok} onClick={publier}>Publier</Bouton>}
          {d.version > 0 && (
            <Bouton variante={d.actif ? "danger" : "vert"} disabled={!!occupe}
              onClick={async () => { if (await action(d.actif ? "desactiver" : "activer", {}, d.actif ? "Parcours désactivé : le flux simple reprend." : "Parcours réactivé.")) charger(); }}>
              {d.actif ? "Désactiver" : "Réactiver"}
            </Bouton>
          )}
        </div>
      </div>

      {!p ? (
        <div className="ui-carte rounded-[28px] p-6">
          <p className="text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>Aucun parcours pour cet agent</p>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>
            Sans parcours, l'agent répond avec le flux simple. Avec un parcours publié, chaque message passe d'abord par lui.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Bouton variante="encre" onClick={() => partirDe(MODELE_NOLIMIT)}>Partir du modèle « Accueil santé (No Limit) »</Bouton>
            <Bouton onClick={() => partirDe(MODELE_VIDE)}>Partir d'un parcours vide</Bouton>
          </div>
        </div>
      ) : (
        <>
          {verdict && verdict.erreurs.length > 0 && (
            <Bandeau ton="rouge" titre={`${verdict.erreurs.length} erreur(s) : publication impossible`}>
              <ul className="mt-1 list-disc pl-5">{verdict.erreurs.slice(0, 8).map((e) => <li key={e.chemin + e.message}><code>{e.chemin}</code> — {e.message}</li>)}</ul>
            </Bandeau>
          )}
          {verdict && verdict.avertissements.length > 0 && (
            <Bandeau ton="ambre" titre="À vérifier">
              <ul className="mt-1 list-disc pl-5">{verdict.avertissements.map((e) => <li key={e.chemin + e.message}>{e.message}</li>)}</ul>
            </Bandeau>
          )}

          <Filtres<Onglet> id="onglet-parcours" label="Vue" valeur={onglet}
            onChange={(o) => (o === "json" ? ouvrirJson() : setOnglet(o))}
            options={[
              { cle: "blocs", libelle: "Blocs", compte: p.blocs.length },
              { cle: "declencheurs", libelle: "Déclencheurs" },
              { cle: "json", libelle: "JSON" },
              { cle: "versions", libelle: "Versions" },
            ]} />

          {onglet === "blocs" && <EditeurBlocs p={p} ids={ids} erreurs={verdict?.erreurs || []} changer={changer} />}
          {onglet === "declencheurs" && <EditeurDeclencheurs p={p} ids={ids} changer={changer} />}
          {onglet === "json" && (
            <div className="ui-carte space-y-3 rounded-[24px] p-5">
              <textarea className="ui-champ min-h-[460px] w-full font-mono text-[12.5px]" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
              {jsonErreur && <p className="text-[13px]" style={{ color: "#A63D28" }}>JSON invalide : {jsonErreur}</p>}
              <div className="flex flex-wrap gap-2">
                <Bouton variante="encre" onClick={appliquerJson}>Appliquer au brouillon</Bouton>
                <Bouton onClick={() => { navigator.clipboard?.writeText(json); toast.success("Copié"); }} icone={Copy}>Copier</Bouton>
              </div>
            </div>
          )}
          {onglet === "versions" && (
            <div className="ui-carte rounded-[24px] p-5">
              {d.versions.length === 0 ? (
                <p className="text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>Aucune version publiée pour l'instant.</p>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--cl-line-soft)" }}>
                  {d.versions.map((v) => (
                    <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13.5px]">
                      <span><strong>Version {v.version}</strong> · publiée le {date(v.publie_at)} {v.version === d.version && <Pastille ton="vert">en ligne</Pastille>}</span>
                      <Bouton icone={History} disabled={!!occupe} onClick={async () => {
                        const j = await action("restaurer", { version: v.version }, `Version ${v.version} remise dans le brouillon : publiez-la pour revenir en arrière.`);
                        if (j?.brouillon) { setP(j.brouillon); setModifie(false); setOnglet("blocs"); }
                      }}>Remettre dans le brouillon</Bouton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="ui-carte rounded-[24px] p-5">
            <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Tester sur votre téléphone</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>
              Votre numéro redevient un « nouveau contact ». Écrivez ensuite au numéro WhatsApp de l'agent : le parcours publié démarre depuis l'accueil.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input className="ui-champ w-[220px]" inputMode="tel" placeholder="6XXXXXXXX" value={testeur} onChange={(e) => setTesteur(e.target.value)} />
              <Bouton icone={RotateCcw} disabled={!!occupe || !testeur.trim()}
                onClick={async () => { const j = await action("reinitialiser", { phone: testeur }); if (j) toast.success(`+${j.phone} repart de l'accueil`); }}>
                Réinitialiser ce numéro
              </Bouton>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
            Modèles :
            <button className="underline" onClick={() => partirDe(MODELE_NOLIMIT)}>Accueil santé (No Limit)</button>·
            <button className="underline" onClick={() => partirDe(MODELE_VIDE)}>Parcours vide</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Les blocs ───────────────────────────────────────────────────────────────

function EditeurBlocs({ p, ids, erreurs, changer }: {
  p: Parcours; ids: string[]; erreurs: Probleme[]; changer: (f: (q: Parcours) => void) => void;
}) {
  const [ajout, setAjout] = useState<TypeBloc>("texte");
  const inserer = (apres: number, type: TypeBloc) =>
    changer((q) => { q.blocs.splice(apres + 1, 0, blocVierge(type, nouvelId(q, type))); });

  return (
    <div className="space-y-3">
      {p.blocs.map((b, i) => (
        <CarteBloc key={`${i}-${b.id}`} b={b} i={i} n={p.blocs.length} ids={ids}
          erreurs={erreurs.filter((e) => e.chemin === `blocs[${i}]` || e.chemin.startsWith(`blocs[${i}].`))}
          changer={changer} inserer={(t) => inserer(i, t)} />
      ))}
      <div className="ui-carte flex flex-wrap items-center gap-2 rounded-[24px] p-4">
        <select className="ui-champ" value={ajout} onChange={(e) => setAjout(e.target.value as TypeBloc)}>
          {TYPES.map((t) => <option key={t.type} value={t.type}>{t.libelle}</option>)}
        </select>
        <Bouton variante="encre" icone={Plus} onClick={() => inserer(p.blocs.length - 1, ajout)}>Ajouter à la fin</Bouton>
      </div>
    </div>
  );
}

function CarteBloc({ b, i, n, ids, erreurs, changer, inserer }: {
  b: Bloc; i: number; n: number; ids: string[]; erreurs: Probleme[];
  changer: (f: (q: Parcours) => void) => void; inserer: (t: TypeBloc) => void;
}) {
  const maj = (f: (x: Bloc & Record<string, unknown>) => void) => changer((q) => f(q.blocs[i] as Bloc & Record<string, unknown>));
  const champ = (cle: string, libelle: string, opts: { long?: boolean; type?: string; placeholder?: string } = {}) => {
    const v = (b as unknown as Record<string, unknown>)[cle];
    const valeur = v === undefined || v === null ? "" : String(v);
    const onChange = (val: string) => maj((x) => { x[cle] = opts.type === "number" ? Number(val) : val; });
    return (
      <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
        {libelle}
        {opts.long
          ? <textarea className="ui-champ min-h-[90px]" value={valeur} placeholder={opts.placeholder} onChange={(e) => onChange(e.target.value)} />
          : <input className="ui-champ" type={opts.type || "text"} value={valeur} placeholder={opts.placeholder} onChange={(e) => onChange(e.target.value)} />}
      </label>
    );
  };
  const cibles = (valeur: string | undefined, onChange: (v: string | undefined) => void, vide = "Bloc suivant") => (
    <select className="ui-champ" value={valeur || ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{vide}</option>
      {ids.filter((x) => x !== b.id).map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
  );
  const aide = TYPES.find((t) => t.type === b.type)?.aide;

  return (
    <div className="ui-carte rounded-[24px] p-4" style={erreurs.length ? { boxShadow: "inset 0 0 0 1.5px #F0D2CB" } : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold text-white" style={{ background: "var(--cl-ink)" }}>{i + 1}</span>
        <select className="ui-champ" value={b.type}
          onChange={(e) => changer((q) => { q.blocs[i] = { ...blocVierge(e.target.value as TypeBloc, b.id), ...(b.suite ? { suite: b.suite } : {}) }; })}>
          {TYPES.map((t) => <option key={t.type} value={t.type}>{t.libelle}</option>)}
        </select>
        <input className="ui-champ w-[170px] font-mono text-[12.5px]" value={b.id} title="Identifiant du bloc"
          onChange={(e) => maj((x) => { x.id = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); })} />
        <div className="ml-auto flex gap-1">
          <IconeBtn titre="Monter" disabled={i === 0} onClick={() => changer((q) => { [q.blocs[i - 1], q.blocs[i]] = [q.blocs[i], q.blocs[i - 1]]; })}><ArrowUp className="h-4 w-4" /></IconeBtn>
          <IconeBtn titre="Descendre" disabled={i === n - 1} onClick={() => changer((q) => { [q.blocs[i + 1], q.blocs[i]] = [q.blocs[i], q.blocs[i + 1]]; })}><ArrowDown className="h-4 w-4" /></IconeBtn>
          <IconeBtn titre="Dupliquer" onClick={() => changer((q) => { const c = copie(q.blocs[i]); c.id = nouvelId(q, c.type); q.blocs.splice(i + 1, 0, c); })}><Copy className="h-4 w-4" /></IconeBtn>
          <IconeBtn titre="Supprimer" onClick={() => changer((q) => { q.blocs.splice(i, 1); })}><Trash2 className="h-4 w-4" /></IconeBtn>
        </div>
      </div>
      {aide && <p className="mt-2 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{aide}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {b.type === "texte" && <div className="sm:col-span-2">{champ("texte", "Message", { long: true, placeholder: "Bonjour {prenom} 👋" })}</div>}
        {(b.type === "image" || b.type === "video") && <>{champ("url", "Adresse (https://…)")}{champ("legende", "Légende")}</>}
        {b.type === "vocal" && <div className="sm:col-span-2">{champ("url", "Adresse du vocal (https://… ou {audio_accueil})")}</div>}
        {b.type === "document" && <>{champ("url", "Adresse (https://…)")}{champ("nom", "Nom du fichier")}{champ("legende", "Légende")}</>}
        {b.type === "lien" && <>{champ("url", "Adresse (https://…)")}{champ("texte", "Texte avant le lien")}</>}
        {b.type === "bouton_lien" && <>{champ("texte", "Message", { long: true })}{champ("libelle", "Texte du bouton (20 max)")}{champ("url", "Adresse (https://…)")}</>}
        {b.type === "pause" && champ("secondes", "Secondes (1 à 15)", { type: "number" })}
        {b.type === "aller" && (
          <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Aller au bloc
            {cibles(b.vers, (v) => maj((x) => { x.vers = v || ""; }), "Choisir…")}
          </label>
        )}
        {b.type === "humain" && <>
          {champ("message", "Message au client au moment du transfert", { long: true })}
          {champ("attente", "Si le client réécrit pendant l'attente (envoyé une fois)", { long: true })}
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cl-ink)" }}>
            <input type="checkbox" checked={b.alerte !== false} onChange={(e) => maj((x) => { x.alerte = e.target.checked; })} />
            Prévenir le commerçant (notification + WhatsApp du responsable)
          </label>
        </>}
        {(b.type === "boutons" || b.type === "liste") && <>
          <div className="sm:col-span-2">{champ("texte", "Message", { long: true })}</div>
          {b.type === "liste" && champ("bouton", "Texte du bouton qui ouvre la liste (20 max)")}
          {champ("pied", "Petit texte en bas (facultatif)")}
          <div className="grid gap-2 sm:col-span-2">
            {(b.type === "boutons" ? b.boutons : b.lignes).map((c: Choix, j: number) => (
              <div key={j} className="flex flex-wrap items-center gap-2">
                <input className="ui-champ w-[130px] font-mono text-[12px]" value={c.id} title="Identifiant"
                  onChange={(e) => maj((x) => { ((x.boutons || x.lignes) as Choix[])[j].id = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); })} />
                <input className="ui-champ min-w-[160px] flex-1" placeholder="Titre" value={c.titre}
                  onChange={(e) => maj((x) => { ((x.boutons || x.lignes) as Choix[])[j].titre = e.target.value; })} />
                {b.type === "liste" && <input className="ui-champ min-w-[160px] flex-1" placeholder="Description" value={c.description || ""}
                  onChange={(e) => maj((x) => { ((x.lignes) as Choix[])[j].description = e.target.value; })} />}
                {cibles(c.vers, (v) => maj((x) => { ((x.boutons || x.lignes) as Choix[])[j].vers = v; }), "→ bloc suivant")}
                <IconeBtn titre="Retirer" onClick={() => maj((x) => { ((x.boutons || x.lignes) as Choix[]).splice(j, 1); })}><Trash2 className="h-4 w-4" /></IconeBtn>
              </div>
            ))}
            {(b.type === "boutons" ? b.boutons.length < 3 : b.lignes.length < 10) && (
              <button className="w-fit text-[13px] underline" style={{ color: "var(--cl-accent-deep)" }}
                onClick={() => maj((x) => { const l = (x.boutons || x.lignes) as Choix[]; l.push({ id: `${x.id}_${l.length + 1}`, titre: "" }); })}>
                + Ajouter un choix
              </button>
            )}
          </div>
          <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Si le client répond autre chose
            {cibles(b.sinon, (v) => maj((x) => { x.sinon = v; }), "Comportement par défaut")}
          </label>
        </>}
        {!["boutons", "liste", "agent", "humain", "silence", "fin", "aller"].includes(b.type) && (
          <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Ensuite
            {cibles(b.suite, (v) => maj((x) => { if (v) x.suite = v; else delete x.suite; }))}
          </label>
        )}
      </div>

      {erreurs.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[12.5px]" style={{ color: "#A63D28" }}>
          {erreurs.map((e) => <li key={e.chemin + e.message}>• {e.message}</li>)}
        </ul>
      )}
      <div className="mt-3 flex justify-end">
        <select className="ui-champ text-[12.5px]" value="" onChange={(e) => { if (e.target.value) inserer(e.target.value as TypeBloc); }}>
          <option value="">+ Insérer un bloc après</option>
          {TYPES.map((t) => <option key={t.type} value={t.type}>{t.libelle}</option>)}
        </select>
      </div>
    </div>
  );
}

function IconeBtn({ titre, children, ...reste }: { titre: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button title={titre} aria-label={titre} className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
      style={{ background: "#F4F2F7", color: "var(--cl-ink)" }} {...reste}>
      {children}
    </button>
  );
}

// ── Les déclencheurs ────────────────────────────────────────────────────────

function EditeurDeclencheurs({ p, ids, changer }: { p: Parcours; ids: string[]; changer: (f: (q: Parcours) => void) => void }) {
  const vers = (valeur: string, onChange: (v: string) => void) => (
    <select className="ui-champ" value={valeur} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choisir un bloc…</option>
      {ids.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
  );
  return (
    <div className="space-y-3">
      <div className="ui-carte grid gap-3 rounded-[24px] p-5 sm:grid-cols-2">
        <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Nom du parcours
          <input className="ui-champ" value={p.nom || ""} onChange={(e) => changer((q) => { q.nom = e.target.value; })} />
        </label>
        <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Un message qui ne correspond à rien
          <select className="ui-champ" value={p.par_defaut || "silence"} onChange={(e) => changer((q) => { q.par_defaut = e.target.value; })}>
            <option value="silence">Camille se tait (l'équipe répond)</option>
            <option value="agent">L'IA de l'agent répond</option>
            {ids.map((x) => <option key={x} value={x}>Aller au bloc « {x} »</option>)}
          </select>
        </label>
      </div>

      {p.declencheurs.map((d: Declencheur, i) => (
        <div key={i} className="ui-carte flex flex-wrap items-end gap-3 rounded-[24px] p-4">
          <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Quand
            <select className="ui-champ" value={d.type} onChange={(e) => changer((q) => {
              const t = e.target.value as Declencheur["type"];
              q.declencheurs[i] = t === "mot_cle" ? { type: t, mots: [], mode: "commence", vers: d.vers }
                : t === "bouton" ? { type: t, id: "", vers: d.vers } : { type: t, vers: d.vers };
            })}>
              <option value="nouveau_contact">Un nouveau contact écrit</option>
              <option value="mot_cle">Le message contient un mot-clé</option>
              <option value="bouton">Le client appuie sur un bouton</option>
            </select>
          </label>
          {d.type === "mot_cle" && <>
            <label className="grid min-w-[180px] flex-1 gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Mots-clés (séparés par des virgules)
              <input className="ui-champ" value={d.mots.join(", ")}
                onChange={(e) => changer((q) => { (q.declencheurs[i] as Extract<Declencheur, { type: "mot_cle" }>).mots = e.target.value.split(",").map((m) => m.trim()); })} />
            </label>
            <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Le message
              <select className="ui-champ" value={d.mode || "commence"}
                onChange={(e) => changer((q) => { (q.declencheurs[i] as Extract<Declencheur, { type: "mot_cle" }>).mode = e.target.value as "commence"; })}>
                <option value="commence">commence par</option>
                <option value="contient">contient</option>
                <option value="exact">est exactement</option>
              </select>
            </label>
          </>}
          {d.type === "bouton" && (
            <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Identifiant du bouton
              <input className="ui-champ font-mono" value={d.id}
                onChange={(e) => changer((q) => { (q.declencheurs[i] as Extract<Declencheur, { type: "bouton" }>).id = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); })} />
            </label>
          )}
          <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Aller au bloc
            {vers(d.vers, (v) => changer((q) => { q.declencheurs[i].vers = v; }))}
          </label>
          <IconeBtn titre="Retirer" onClick={() => changer((q) => { q.declencheurs.splice(i, 1); })}><Trash2 className="h-4 w-4" /></IconeBtn>
        </div>
      ))}
      <Bouton icone={Plus} onClick={() => changer((q) => { q.declencheurs.push({ type: "mot_cle", mots: [], mode: "commence", vers: "" }); })}>
        Ajouter un déclencheur
      </Bouton>
    </div>
  );
}
