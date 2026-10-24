"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Les parcours WhatsApp (forfait Entreprise) : un mini n8n dans Camille.
//
// Au centre, le canevas : les blocs, reliés par des flèches. À droite, le
// téléphone d'aperçu (on y joue le client, avec les vrais composants
// WhatsApp) et les réglages du bloc sélectionné. Le JSON reste à portée pour
// l'équipe. On travaille sur un brouillon ; « Publier » fige une version.
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Copy, History, Rocket, RotateCcw, Save, SlidersHorizontal, Smartphone, Workflow } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { Bandeau, Bouton, Filtres, Pastille, Squelettes, StylesUI } from "@/components/dashboard/ui";
import { MODELE_NOLIMIT, MODELE_VIDE, rendreExplicite, valider, type Parcours } from "@/lib/parcours-regles";
import Proprietes from "@/components/parcours/Proprietes";
import Telephone from "@/components/parcours/Telephone";
import { disposer } from "@/components/parcours/graphe";
import type { MediasAccueil } from "@/components/parcours/ChampMedia";

// Le canevas dépend du navigateur (mesures, glisser) : pas de rendu serveur.
const Canevas = dynamic(() => import("@/components/parcours/Canevas"), { ssr: false, loading: () => <Squelettes n={1} hauteur={600} /> });

type Donnees = {
  pret: boolean; entreprise: boolean; error?: string;
  brouillon: Parcours | null; publie: Parcours | null;
  version: number; actif: boolean; publie_at: string | null;
  versions: { version: number; publie_at: string }[];
};

type Vue = "editeur" | "json" | "versions";
type Panneau = "apercu" | "reglages";

const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Le parcours prêt pour le canevas : liens explicites, une place pour chaque nœud. */
function pourCanevas(p: Parcours): Parcours {
  const q = rendreExplicite(copie(p));
  q.ui = { ...(q.ui || {}), positions: disposer(q) };
  return q;
}

export default function ParcoursPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [d, setD] = useState<Donnees | null>(null);
  const [p, setP] = useState<Parcours | null>(null);
  const [vue, setVue] = useState<Vue>("editeur");
  const [panneau, setPanneau] = useState<Panneau>("apercu");
  const [selection, setSelection] = useState<string | null>(null);
  const [actifs, setActifs] = useState<Set<string>>(new Set());
  const [json, setJson] = useState("");
  const [jsonErreur, setJsonErreur] = useState("");
  const [modifie, setModifie] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [testeur, setTesteur] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [accueil, setAccueil] = useState<MediasAccueil>({});

  const charger = useCallback(async () => {
    const r = await fetch(`/api/agents/${agentId}/parcours`, { headers: { ...authHeaders() } });
    const j = (await r.json().catch(() => null)) as Donnees | null;
    if (!j) return;
    setD(j);
    const base = j.brouillon || j.publie;
    setP(base ? pourCanevas(base) : null);
    setModifie(false);
  }, [agentId]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    fetch(`/api/agents/${agentId}`, { headers: { ...authHeaders() } })
      .then((r) => r.json()).then((j) => {
        setEntreprise(j?.agent?.business_name || j?.business_name || j?.agent?.name || "");
        const caps = j?.agent?.capabilities || {};
        setAccueil({ audio_accueil: caps.welcome_audio_url || "", video_accueil: caps.welcome_video_url || "" });
      })
      .catch(() => {});
  }, [agentId]);

  const verdict = useMemo(() => (p ? valider(p) : null), [p]);
  const blocsEnErreur = useMemo(() => {
    const s = new Set<string>();
    for (const e of verdict?.erreurs || []) {
      const m = e.chemin.match(/^blocs\[(\d+)\]/);
      if (m && p?.blocs[Number(m[1])]) s.add(p.blocs[Number(m[1])].id);
    }
    return s;
  }, [verdict, p]);

  const changer = useCallback((f: (q: Parcours) => void) => {
    setP((ancien) => {
      if (!ancien) return ancien;
      const q = copie(ancien);
      f(q);
      return q;
    });
    setModifie(true);
  }, []);

  const choisir = useCallback((id: string | null) => {
    setSelection(id);
    if (id) setPanneau("reglages");
  }, []);

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
    setP(pourCanevas(modele));
    setModifie(true);
    setSelection(null);
    setVue("editeur");
  }

  function appliquerJson() {
    try {
      const v = JSON.parse(json);
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Le parcours doit être un objet JSON.");
      setP(pourCanevas(v));
      setModifie(true);
      setJsonErreur("");
      setVue("editeur");
      toast.success("JSON appliqué au brouillon (pensez à enregistrer)");
    } catch (e) {
      setJsonErreur((e as Error).message);
    }
  }

  if (!d) return <div className="py-8"><StylesUI /><Squelettes n={3} hauteur={120} /></div>;
  const differentDuPublie = Boolean(p && d.publie && JSON.stringify(p) !== JSON.stringify(d.publie));

  return (
    <div className="space-y-4 py-6 lg:py-8">
      <StylesUI />
      {!d.pret && <Bandeau ton="ambre" titre="Une étape avant d'utiliser les parcours">{d.error}</Bandeau>}
      {d.pret && !d.entreprise && (
        <Bandeau ton="violet" titre="Forfait Entreprise">
          Vous pouvez dessiner et enregistrer un parcours ; sa publication est réservée au forfait Entreprise.
        </Bandeau>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>
          <Workflow className="h-5 w-5" /> {p?.nom || "Parcours WhatsApp"}
          {d.version > 0 && <Pastille ton={d.actif ? "vert" : "gris"} point>{d.actif ? `En service · v${d.version}` : `Désactivé · v${d.version}`}</Pastille>}
          {(modifie || differentDuPublie) && <Pastille ton="ambre">Brouillon non publié</Pastille>}
          {verdict && verdict.erreurs.length > 0 && <Pastille ton="rouge">{verdict.erreurs.length} erreur(s)</Pastille>}
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
            Sans parcours, l&apos;agent répond avec le flux simple. Avec un parcours publié, chaque message passe d&apos;abord par lui.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Bouton variante="encre" onClick={() => partirDe(MODELE_NOLIMIT)}>Partir du modèle « Accueil santé (No Limit) »</Bouton>
            <Bouton onClick={() => partirDe(MODELE_VIDE)}>Partir d&apos;un parcours vide</Bouton>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Filtres<Vue> id="vue-parcours" label="Vue" valeur={vue}
              onChange={(v) => { if (v === "json") { setJson(JSON.stringify(p, null, 2)); setJsonErreur(""); } setVue(v); }}
              options={[{ cle: "editeur", libelle: "Éditeur" }, { cle: "json", libelle: "JSON" }, { cle: "versions", libelle: "Versions", compte: d.versions.length }]} />
            <span className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
              Modèles : <button className="underline" onClick={() => partirDe(MODELE_NOLIMIT)}>Accueil santé</button> · <button className="underline" onClick={() => partirDe(MODELE_VIDE)}>Vide</button>
            </span>
          </div>

          {vue === "editeur" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="pc-cadre h-[78vh] min-h-[560px] overflow-hidden rounded-[28px]">
                <Canevas p={p} erreurs={blocsEnErreur} selection={selection} actifs={actifs} onSelection={choisir} changer={changer} />
              </div>
              <aside className="ui-carte flex h-[78vh] min-h-[560px] flex-col rounded-[28px] p-4">
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "#F4F2F7" }}>
                  {([["apercu", "Aperçu", Smartphone], ["reglages", "Réglages", SlidersHorizontal]] as const).map(([cle, lib, I]) => (
                    <button key={cle} onClick={() => setPanneau(cle)} className="flex items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium"
                      style={panneau === cle ? { background: "#19171B", color: "#fff" } : { color: "var(--cl-ink-soft)" }}>
                      <I className="h-4 w-4" /> {lib}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {panneau === "apercu"
                    ? <Telephone p={p} entreprise={entreprise} accueil={accueil} onActifs={setActifs} onBloc={(id) => setSelection(id)} />
                    : <Proprietes p={p} selection={selection} erreurs={verdict?.erreurs || []} changer={changer} onSelection={choisir} agentId={agentId} accueil={accueil} onAccueil={setAccueil} />}
                </div>
              </aside>
            </div>
          )}

          {vue === "json" && (
            <div className="ui-carte space-y-3 rounded-[24px] p-5">
              <textarea className="ui-champ min-h-[520px] w-full font-mono text-[12.5px]" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
              {jsonErreur && <p className="text-[13px]" style={{ color: "#A63D28" }}>JSON invalide : {jsonErreur}</p>}
              <div className="flex flex-wrap gap-2">
                <Bouton variante="encre" onClick={appliquerJson}>Appliquer au brouillon</Bouton>
                <Bouton onClick={() => { navigator.clipboard?.writeText(json); toast.success("Copié"); }} icone={Copy}>Copier</Bouton>
              </div>
            </div>
          )}

          {vue === "versions" && (
            <div className="ui-carte rounded-[24px] p-5">
              {d.versions.length === 0 ? (
                <p className="text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>Aucune version publiée pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--cl-line-soft)" }}>
                  {d.versions.map((v) => (
                    <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13.5px]">
                      <span><strong>Version {v.version}</strong> · publiée le {date(v.publie_at)} {v.version === d.version && <Pastille ton="vert">en ligne</Pastille>}</span>
                      <Bouton icone={History} disabled={!!occupe} onClick={async () => {
                        const j = await action("restaurer", { version: v.version }, `Version ${v.version} remise dans le brouillon : publiez-la pour revenir en arrière.`);
                        if (j?.brouillon) { setP(pourCanevas(j.brouillon)); setModifie(false); setVue("editeur"); }
                      }}>Remettre dans le brouillon</Bouton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="ui-carte rounded-[24px] p-5">
            <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Tester sur votre vrai téléphone</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>
              Votre numéro redevient un « nouveau contact ». Écrivez ensuite au numéro WhatsApp de l&apos;agent : le parcours <strong>publié</strong> démarre depuis l&apos;accueil.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input className="ui-champ w-[220px]" inputMode="tel" placeholder="6XXXXXXXX" value={testeur} onChange={(e) => setTesteur(e.target.value)} />
              <Bouton icone={RotateCcw} disabled={!!occupe || !testeur.trim()}
                onClick={async () => { const j = await action("reinitialiser", { phone: testeur }); if (j) toast.success(`+${j.phone} repart de l'accueil`); }}>
                Réinitialiser ce numéro
              </Bouton>
            </div>
          </div>
        </>
      )}
      <style jsx global>{`
        .pc-cadre { background: #FAF9FC; box-shadow: inset 0 0 0 1px var(--cl-line-soft, #ECE8F1); }
        .pc-btn-rond { display: inline-flex; flex-shrink: 0; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 999px; background: #F4F2F7; color: var(--cl-ink); }
        .pc-btn-rond:hover { background: #19171B; color: #fff; }
      `}</style>
    </div>
  );
}
