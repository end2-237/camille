"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Console d'exploitation.
//
// Une ligne par agent, cinq colonnes qui disent en un regard qui va bien et qui
// est en train de partir. C'est la vue qui manquait le jour où trois workflows
// n8n sont restés inactifs pendant qu'un client demandait deux fois la carte :
// l'information existait, elle n'était visible nulle part.
//
// Deux actions, celles qu'on faisait à la main dans Postgres : changer un plan,
// relancer une session.
//
// Sur grand écran les lignes s'alignent en colonnes ; sur téléphone chaque
// agent devient une carte, sans défilement de côté.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, ShieldAlert, RotateCw, Check, X, Radio, TrendingUp, Bot, Siren, Eye, HeartPulse, ChevronDown, CalendarPlus } from "lucide-react";
import { TOKENS_PAR_CONVERSATION, enConversations, libelleConversations } from "@/lib/plans";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { Bandeau, Bouton, Pastille, Squelettes, StylesUI, TONS, Tuile, Vide, apparait, type Ton } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

interface Ligne {
  id: string;
  name: string;
  business_name: string | null;
  level: number;
  owner: { id: string; email: string; name: string | null };
  plan: string;
  plan_expires_at: string | null;
  plan_expired: boolean;
  session: { name: string; status: string; updated_at: string } | null;
  tokens: { used: number; limit: number | null; percent: number };
  messages_7j: number;
  dernier_jour_actif: string | null;
  commandes_7j: number;
  derniere_commande: string | null;
}

const PLANS = ["free", "starter", "pro", "enterprise"];

/** État de la plateforme WhatsApp, tel que le tient camille-core. */
interface Plateforme {
  injoignable?: boolean;
  niveau: "ok" | "attention" | "critique";
  diagnostic: string;
  prevision: string;
  bibliotheque?: { installee: string; derniere: string | null; en_retard: boolean };
  whatsapp?: { annoncee: string; embarquee: string | null; master: string | null; decalage: boolean };
  sessions?: { total: number; en_ligne: number };
  incident?: {
    en_cours: boolean;
    fenetre_min: number;
    sessions_touchees: string[];
    chutes: { session: string; code: number; at: number }[];
  };
  veille?: { dernier_releve: number | null; erreur: string | null };
}

/** Combien de jours depuis cette date ? `null` quand elle manque. */
function joursDepuis(iso: string | null): number | null {
  if (!iso) return null;
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(j) ? j : null;
}

/**
 * Le diagnostic d'une ligne, en une phrase.
 *
 * L'ordre compte : on nomme le problème le plus grave, pas tous. Une console
 * qui affiche quatre avertissements par ligne ne se lit plus.
 */
function diagnostic(l: Ligne): { texte: string; ton: "ko" | "attention" | "ok" } {
  if (l.session && l.session.status !== "WORKING" && l.session.status !== "CONNECTED") {
    return { texte: `WhatsApp ${l.session.status.toLowerCase()}`, ton: "ko" };
  }
  if (!l.session) return { texte: "aucune session WhatsApp", ton: "ko" };
  if (l.plan_expired) return { texte: "abonnement expiré", ton: "ko" };

  const inactif = joursDepuis(l.dernier_jour_actif);
  if (inactif === null) return { texte: "jamais activé", ton: "attention" };
  if (inactif >= 3) return { texte: `silencieux depuis ${inactif} j`, ton: "ko" };

  if (l.tokens.limit != null && l.tokens.percent >= 90) {
    return { texte: `quota à ${l.tokens.percent} %`, ton: "ko" };
  }
  if (l.tokens.limit != null && l.tokens.percent >= 70) {
    return { texte: `quota à ${l.tokens.percent} %`, ton: "attention" };
  }
  if (inactif >= 1) return { texte: `rien depuis ${inactif} j`, ton: "attention" };
  return { texte: "actif", ton: "ok" };
}

/** Le ton du kit pour chaque gravité. */
const TON: Record<"ko" | "attention" | "ok", Ton> = { ko: "rouge", attention: "ambre", ok: "vert" };

/**
 * L'état de la plateforme WhatsApp, en haut de la console.
 *
 * Trois lignes suffisent : ce qui se passe, ce qui va arriver, et les deux
 * numéros de version qui expliquent presque toujours pourquoi. Le reste
 * (la liste des sessions tombées) ne s'affiche que pendant un incident —
 * une console qu'on lit tous les jours ne doit pas montrer en permanence des
 * données qui ne servent qu'une fois par trimestre.
 */
function CartePlateforme({ etat }: { etat: Plateforme | null }) {
  if (!etat) return null;

  const ton = TON[etat.niveau === "critique" ? "ko" : etat.niveau === "attention" ? "attention" : "ok"];
  const t = TONS[ton];
  const bib = etat.bibliotheque;
  const wa = etat.whatsapp;

  return (
    <motion.section {...apparait(4)} className="ui-carte min-w-0 rounded-[28px] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: t.fond, color: t.encre }}>
          <Radio className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[17px] font-medium tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>
          Plateforme WhatsApp
        </span>
        <Pastille ton={ton} point>
          {etat.niveau === "critique" ? "incident" : etat.niveau === "attention" ? "à surveiller" : "stable"}
        </Pastille>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-6">
        <div className="min-w-0">
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--cl-ink)" }}>{etat.diagnostic}</p>

          {/* La prévision est le vrai produit de cette carte : elle transforme un
              constat en décision. On la marque comme telle. */}
          <div className="mt-3 flex items-start gap-2.5 rounded-[20px] p-4 text-[13px] leading-relaxed" style={{ background: "#F7F4FF", color: "var(--cl-ink-soft)" }}>
            <TrendingUp className="mt-[3px] h-4 w-4 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
            <span className="min-w-0">{etat.prevision}</span>
          </div>

          {etat.incident?.en_cours && etat.incident.sessions_touchees.length > 0 && (
            <div className="mt-3 rounded-[18px] px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: TONS.rouge.fond, color: TONS.rouge.encre, overflowWrap: "anywhere" }}>
              Tombées dans les {etat.incident.fenetre_min} dernières minutes :{" "}
              {etat.incident.sessions_touchees.join(" · ")}
            </div>
          )}
        </div>

        {(etat.sessions || bib || wa) && (
          <div className="min-w-0 space-y-3">
            {etat.sessions && (
              <div className="rounded-[20px] px-4 py-3" style={{ background: "#FAF9FC" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Sessions en ligne</span>
                  <span className="text-[15px] font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>
                    {etat.sessions.en_ligne}/{etat.sessions.total}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "#ECE9F1" }}>
                  <motion.div className="h-full rounded-full" style={{ background: "var(--cl-accent)" }}
                    initial={{ width: 0 }} animate={{ width: `${etat.sessions.total ? (etat.sessions.en_ligne / etat.sessions.total) * 100 : 0}%` }} transition={RESSORT} />
                </div>
              </div>
            )}

            {(bib || wa) && (
              <div className="space-y-1.5 rounded-[20px] px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: "#FAF9FC", color: "var(--cl-ink-faint)", overflowWrap: "anywhere" }}>
                {bib && (
                  <p>
                    Bibliothèque <b className="font-medium" style={{ color: "var(--cl-ink)" }}>{bib.installee}</b>
                    {bib.derniere && bib.derniere !== bib.installee && <> · dernière publiée {bib.derniere}</>}
                  </p>
                )}
                {wa && (
                  <p>
                    Protocole annoncé <b className="font-medium" style={{ color: wa.decalage ? TONS.rouge.encre : "var(--cl-ink)" }}>{wa.annoncee}</b>
                    {wa.embarquee && wa.embarquee !== wa.annoncee && <> · la bibliothèque parle {wa.embarquee}</>}
                    {wa.master && <> · master {wa.master}</>}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}

export default function AdminPage() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [degrade, setDegrade] = useState<string[]>([]);
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [plateforme, setPlateforme] = useState<Plateforme | null>(null);
  const [abonnement, setAbonnement] = useState<Ligne | null>(null);

  const load = useCallback(async () => {
    setCharge(true);
    // La veille plateforme est chargée en parallèle et sans await bloquant :
    // si le core met dix secondes à répondre, la liste des agents s'affiche
    // quand même.
    fetch("/api/admin/platform", { headers: { ...authHeaders() }, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPlateforme(d))
      .catch(() => setPlateforme(null));
    try {
      const r = await fetch("/api/admin/overview", { headers: { ...authHeaders() }, cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 403) { setErreur("Ce compte n'a pas accès à la console."); setLignes([]); return; }
      if (!r.ok) { setErreur(d.error ?? "Chargement impossible"); setLignes([]); return; }
      setErreur("");
      setDegrade(Array.isArray(d.degraded) ? d.degraded : []);
      setLignes(Array.isArray(d.agents) ? d.agents : []);
    } catch (e) {
      setErreur((e as Error).message);
      setLignes([]);
    } finally { setCharge(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function agir(id: string, corps: Record<string, unknown>, succes: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(corps),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Échec");
      toast.success(succes);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  }

  const items = lignes ?? [];
  // Les lignes en panne remontent : une console se lit de haut en bas, et ce
  // qui brûle doit être en haut.
  const rang = { ko: 0, attention: 1, ok: 2 } as const;
  const triees = [...items].sort((a, b) => rang[diagnostic(a).ton] - rang[diagnostic(b).ton]);
  const enPanne = items.filter((l) => diagnostic(l).ton === "ko").length;
  const aSurveiller = items.filter((l) => diagnostic(l).ton === "attention").length;
  const actifs = items.length - enPanne - aSurveiller;

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />

      {/* ── Le résumé et l'actualisation ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px]" style={{ color: "var(--cl-ink-soft)" }}>
          {items.length} agent{items.length > 1 ? "s" : ""}
          {enPanne > 0 ? ` · ${enPanne} à regarder tout de suite` : " · rien à signaler"}
        </p>
        <Bouton variante="clair" icone={RefreshCw} onClick={load} disabled={charge}
          className={charge ? "[&>svg]:animate-spin" : ""}>
          Actualiser
        </Bouton>
      </div>

      {erreur && (
        <div className="mt-4">
          <Bandeau ton="rouge" titre={<span className="inline-flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> Console indisponible</span>}>
            {erreur}
          </Bandeau>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Tuile rang={0} icone={Bot} titre="Agents" valeur={lignes === null ? "—" : items.length} sous="sur la plateforme" />
        <Tuile rang={1} icone={Siren} titre="À regarder" valeur={lignes === null ? "—" : enPanne} sous="tout de suite" fort={enPanne > 0} />
        <Tuile rang={2} icone={Eye} titre="À surveiller" valeur={lignes === null ? "—" : aSurveiller} sous="quota ou silence" />
        <Tuile rang={3} icone={HeartPulse} titre="Actifs" valeur={lignes === null ? "—" : actifs} sous="rien à signaler" />
      </div>

      {/* La plateforme d'abord : quand elle tombe, toutes les lignes tombent
          avec elle, et c'est elle qu'il faut lire en premier. */}
      {plateforme && <div className="mt-5"><CartePlateforme etat={plateforme} /></div>}

      {/* Les sites à fabriquer (option « Site ») */}
      <DemandesSite />
      <Forfaits />

      <div className="mt-6">
        {/* ── Les agents ────────────────────────────────────────────────────── */}
        <section className="min-w-0">
          {degrade.length > 0 && (
            <div className="mb-4">
              <Bandeau ton="ambre">
                Vue partielle — certaines données n&apos;ont pas pu être lues :{" "}
                {degrade.join(" · ")}
              </Bandeau>
            </div>
          )}

          {/* L'en-tête des colonnes, sur grand écran seulement. */}
          <div className="admin-grille hidden px-5 pb-2 text-[12px] xl:grid" style={{ color: "var(--cl-ink-faint)" }}>
            {["Agent", "État", "Plan", "Quota du mois", "7 derniers jours", "Actions"].map((h) => <span key={h}>{h}</span>)}
          </div>

          {lignes === null ? (
            <Squelettes n={5} hauteur={84} />
          ) : !items.length && !erreur ? (
            <Vide doodle="meditating" titre="Aucun agent." />
          ) : (
            <motion.div layout className="space-y-2.5">
              {triees.map((l, i) => {
                const d = diagnostic(l);
                const ton = TON[d.ton];
                const occupe = busy === l.id;
                return (
                  <motion.article key={l.id} layout {...apparait(i)}
                    className="ui-carte admin-grille grid items-center gap-x-4 gap-y-3 rounded-[24px] p-4 xl:px-5"
                    style={d.ton === "ko" ? { borderColor: "#F0D2CB" } : undefined}>
                    {/* Agent */}
                    <div className="admin-agent flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-semibold"
                        style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                        {(l.business_name || l.name || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-medium" style={{ color: "var(--cl-ink)" }}>
                          {l.business_name || l.name}
                        </p>
                        <p className="truncate text-[12px]" style={{ color: "var(--cl-ink-faint)" }} title={l.owner.email}>
                          {l.owner.email} · N{l.level}
                        </p>
                      </div>
                    </div>

                    {/* État */}
                    <div className="admin-etat min-w-0">
                      <Pastille ton={ton} point>{d.texte}</Pastille>
                    </div>

                    {/* Plan */}
                    <div className="admin-plan min-w-0">
                      <Champ libelle="Plan">
                        <div className="relative">
                          <select
                            className="ui-champ appearance-none"
                            style={{ height: 38, fontSize: 13.5, paddingRight: 36 }}
                            value={l.plan}
                            disabled={occupe}
                            onChange={(e) => agir(l.id, { plan: e.target.value }, `Plan passé en ${e.target.value}`)}
                          >
                            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
                        </div>
                        {l.plan_expires_at && (
                          <p className="mt-1 px-1 text-[11.5px]" style={{ color: l.plan_expired ? TONS.rouge.encre : "var(--cl-ink-faint)" }}>
                            {l.plan_expired ? "expiré le " : "jusqu'au "}
                            {new Date(l.plan_expires_at).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </Champ>
                    </div>

                    {/* Quota du mois */}
                    <div className="admin-quota min-w-0">
                      <Champ libelle="Quota du mois">
                        {l.tokens.limit == null ? (
                          <span className="text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>illimité</span>
                        ) : (
                          <>
                            <p className="truncate text-[12.5px] tabular-nums" style={{ color: "var(--cl-ink)" }}>
                              {l.tokens.used.toLocaleString("fr-FR")} / {l.tokens.limit.toLocaleString("fr-FR")}
                            </p>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "#ECE9F1" }}>
                              <motion.div className="h-full rounded-full"
                                initial={{ width: 0 }} animate={{ width: `${Math.min(100, l.tokens.percent)}%` }} transition={RESSORT}
                                style={{
                                  background: l.tokens.percent >= 90 ? TONS.rouge.encre
                                    : l.tokens.percent >= 70 ? "#E0A43A" : "var(--cl-accent)",
                                }} />
                            </div>
                          </>
                        )}
                      </Champ>
                    </div>

                    {/* 7 derniers jours */}
                    <div className="admin-semaine min-w-0">
                      <Champ libelle="7 derniers jours">
                        <p className="text-[13px] tabular-nums" style={{ color: "var(--cl-ink-soft)" }}>
                          {l.messages_7j.toLocaleString("fr-FR")} msg · {l.commandes_7j} cmd
                        </p>
                      </Champ>
                    </div>

                    {/* Actions */}
                    <div className="admin-actions flex min-w-0 flex-wrap gap-2 xl:justify-self-end">
                      <Bouton variante="encre" icone={CalendarPlus} disabled={occupe}
                        title="Relancer pour 1 mois ou plus, passer en enterprise, enregistrer un paiement en agence"
                        onClick={() => setAbonnement(l)}>
                        Abonnement
                      </Bouton>
                      <Bouton
                        variante="doux"
                        icone={RotateCw}
                        occupe={occupe}
                        disabled={occupe || !l.session}
                        title={l.session ? "Relancer la session WhatsApp" : "Aucune session"}
                        onClick={() => agir(l.id, { action: "restart_session" }, "Session relancée")}
                      >
                        Relancer
                      </Bouton>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          )}

          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" />
              Les changements de plan et les relances sont journalisés avec ton adresse.</span>
            <span className="inline-flex items-center gap-1.5"><X className="h-3.5 w-3.5" />
              Le quota se lit sur le mois en cours.</span>
          </p>
        </section>
      </div>

      <AnimatePresence>
        {abonnement && (
          <FenetreAbonnement ligne={abonnement} onFermer={() => setAbonnement(null)}
            onFait={async () => { setAbonnement(null); await load(); }} />
        )}
      </AnimatePresence>

      <style jsx global>{`
        /* Téléphone : l'agent en tête, puis l'état et l'action, puis les
           trois mesures côte à côte quand la place le permet. */
        .admin-grille { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "agent agent" "etat actions" "plan plan" "quota semaine"; }
        .admin-agent { grid-area: agent; } .admin-etat { grid-area: etat; } .admin-plan { grid-area: plan; }
        .admin-quota { grid-area: quota; } .admin-semaine { grid-area: semaine; } .admin-actions { grid-area: actions; }
        @media (min-width: 640px) {
          .admin-grille { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto; grid-template-areas: "agent agent etat actions" "plan quota semaine semaine"; }
        }
        @media (min-width: 1280px) {
          .admin-grille { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) 140px minmax(0, 150px) minmax(0, 130px) auto; grid-template-areas: "agent etat plan quota semaine actions"; }
          .admin-libelle { display: none; }
        }
      `}</style>
    </div>
  );
}

/** Une mesure d'une ligne : sur téléphone son libellé, sur grand écran la colonne suffit. */
function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="admin-libelle mb-1 px-1 text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>{libelle}</p>
      {children}
    </div>
  );
}

// ── La fenêtre « Abonnement » ───────────────────────────────────────────────
// Remettre un agent en service (1, 3, 6, 12 mois, ou enterprise sans
// échéance), et enregistrer un réabonnement payé en agence : le paiement entre
// dans l'historique du marchand, un reçu numéroté lui part par e-mail.

const DUREES = [1, 3, 6, 12];
const MODES_PAIEMENT = [
  { id: "especes", libelle: "Espèces" },
  { id: "momo", libelle: "Mobile Money" },
  { id: "virement", libelle: "Virement" },
  { id: "autre", libelle: "Autre" },
];

function FenetreAbonnement({ ligne, onFermer, onFait }: { ligne: Ligne; onFermer: () => void; onFait: () => void }) {
  const [plan, setPlan] = useState(ligne.plan === "free" ? "starter" : ligne.plan);
  const [mois, setMois] = useState(1);
  const [agence, setAgence] = useState(false);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("especes");
  const [reference, setReference] = useState("");
  const [occupe, setOccupe] = useState(false);

  const sansTerme = plan === "enterprise" || plan === "free";
  // Le prix du mois vient des forfaits tels que l'administration les a réglés.
  const [prix, setPrix] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch("/api/admin/plans", { headers: { ...authHeaders() }, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPrix(Object.fromEntries((d.plans ?? []).map((p: { id: string; price_xaf: number }) => [p.id, Number(p.price_xaf)]))))
      .catch(() => {});
  }, []);
  const prixMois = Math.max(0, prix[plan] ?? 0);
  useEffect(() => { setMontant(prixMois > 0 ? String(prixMois * mois) : ""); }, [plan, mois, prixMois]);

  // Nouvelle échéance : depuis la fin en cours si elle est encore devant.
  const base = ligne.plan_expires_at && new Date(ligne.plan_expires_at).getTime() > Date.now()
    ? new Date(ligne.plan_expires_at) : new Date();
  const fin = new Date(base); fin.setMonth(fin.getMonth() + mois);

  async function valider() {
    setOccupe(true);
    try {
      const corps = agence
        ? { action: "paiement_agence", plan, mois, montant: Number(montant), mode, reference }
        : { action: "prolonger", plan, mois };
      const r = await fetch(`/api/admin/agents/${ligne.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(corps),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Échec");
      toast.success(agence
        ? `Paiement enregistré${d.recu ? ` — reçu ${d.recu}` : ""} · ${ligne.business_name || ligne.name} relancé`
        : `${ligne.business_name || ligne.name} relancé${sansTerme ? ` en ${plan}` : ` pour ${mois} mois`}`);
      onFait();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setOccupe(false); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center"
      style={{ background: "rgba(25,23,27,0.38)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <motion.div initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, opacity: 0 }} transition={RESSORT}
        className="w-full max-w-[460px] rounded-[28px] bg-white p-5 sm:p-6" style={{ boxShadow: "0 30px 80px rgba(40,20,110,0.25)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>Abonnement</p>
            <p className="truncate text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>
              {ligne.business_name || ligne.name} · {ligne.plan}
              {ligne.plan_expires_at && ` · ${ligne.plan_expired ? "expiré le" : "jusqu'au"} ${new Date(ligne.plan_expires_at).toLocaleDateString("fr-FR")}`}
            </p>
          </div>
          <button onClick={onFermer} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-1.5 mt-5 px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Forfait</p>
        <div className="grid grid-cols-4 gap-1.5 rounded-full p-1" style={{ background: "#F4F2F7" }}>
          {PLANS.map((p) => (
            <button key={p} onClick={() => setPlan(p)} className="rounded-full py-2 text-[13px] capitalize transition"
              style={{ background: plan === p ? "#fff" : "transparent", color: "var(--cl-ink)", fontWeight: plan === p ? 600 : 400,
                boxShadow: plan === p ? "0 2px 8px rgba(25,23,27,0.08)" : "none" }}>
              {p}
            </button>
          ))}
        </div>

        {!sansTerme ? (
          <>
            <p className="mb-1.5 mt-4 px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Durée</p>
            <div className="grid grid-cols-4 gap-1.5">
              {DUREES.map((n) => (
                <button key={n} onClick={() => setMois(n)} className="rounded-[14px] py-2.5 text-[13.5px] transition"
                  style={{ background: mois === n ? "var(--cl-ink)" : "#F4F2F7", color: mois === n ? "#fff" : "var(--cl-ink)" }}>
                  {n} mois
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
              Actif jusqu&apos;au <b style={{ color: "var(--cl-ink)" }}>{fin.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</b>
            </p>
          </>
        ) : (
          <p className="mt-3 px-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
            {plan === "enterprise" ? "Sans échéance ni limite de tokens : l'agent ne sera jamais coupé automatiquement." : "Forfait gratuit, sans échéance."}
          </p>
        )}

        <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-[18px] px-4 py-3" style={{ background: "#F7F6FA" }}>
          <span>
            <span className="block text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>Paiement reçu en agence</span>
            <span className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Enregistré dans son historique, reçu envoyé par e-mail</span>
          </span>
          <input type="checkbox" checked={agence} onChange={(e) => setAgence(e.target.checked)} className="h-5 w-5" style={{ accentColor: "var(--cl-accent-deep)" }} />
        </label>

        <AnimatePresence initial={false}>
          {agence && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="grid grid-cols-2 gap-2 pt-3">
                <label className="col-span-2 sm:col-span-1">
                  <span className="mb-1 block px-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Montant reçu (FCFA)</span>
                  <input className="ui-champ" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="col-span-2 sm:col-span-1">
                  <span className="mb-1 block px-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Mode</span>
                  <select className="ui-champ" value={mode} onChange={(e) => setMode(e.target.value)}>
                    {MODES_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
                  </select>
                </label>
                <label className="col-span-2">
                  <span className="mb-1 block px-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Référence (optionnelle)</span>
                  <input className="ui-champ" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction, de bordereau…" />
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 flex justify-end gap-2">
          <Bouton onClick={onFermer}>Annuler</Bouton>
          <Bouton variante="encre" occupe={occupe} disabled={occupe || (agence && !(Number(montant) > 0))} onClick={valider}>
            {agence ? "Enregistrer et relancer" : "Relancer l'agent"}
          </Bouton>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ── Les demandes de site ──────────────────────────────────────────────────────

type DemandeSite = { id: string; statut: string; domaine: string | null; brief: string; url: string | null; business_name: string | null; created_at: string };

function DemandesSite() {
  const [liste, setListe] = useState<DemandeSite[]>([]);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const charger = useCallback(() => {
    fetch("/api/admin/sites", { headers: { ...authHeaders() }, cache: "no-store" })
      .then((r) => r.json()).then((d) => setListe(Array.isArray(d.demandes) ? d.demandes : [])).catch(() => {});
  }, []);
  useEffect(() => { charger(); }, [charger]);
  if (!liste.length) return null;

  async function maj(id: string, statut: string) {
    const url = statut === "en_ligne"
      ? prompt("Adresse d'un site sur mesure (https://…).\nLaisser vide pour ouvrir la vitrine Camille.") || undefined
      : undefined;
    const r = await fetch("/api/admin/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id, statut, url }),
    });
    if (!r.ok) toast.error("Mise à jour refusée"); else charger();
  }

  return (
    <section className="ui-carte mt-5 rounded-[24px] p-5">
      <p className="text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>Sites à fabriquer · {liste.length}</p>
      <ul className="mt-3 space-y-2">
        {liste.map((d) => (
          <li key={d.id} className="rounded-[16px] p-3" style={{ background: "#FAF9FC" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-[14px] font-medium">{d.business_name || "—"} {d.domaine ? `· ${d.domaine}` : ""}</span>
              <Pastille ton={d.statut === "en_ligne" ? "vert" : d.statut === "en_cours" ? "violet" : "ambre"}>{d.statut}</Pastille>
              <Bouton variante="clair" onClick={() => setOuvert(ouvert === d.id ? null : d.id)}>Brief</Bouton>
              <Bouton variante="clair" onClick={() => { navigator.clipboard.writeText(d.brief); toast.success("Brief copié pour /dip-create"); }}>Copier</Bouton>
              {d.statut === "demande" && <Bouton variante="clair" onClick={() => maj(d.id, "en_cours")}>En fabrication</Bouton>}
              {d.statut !== "en_ligne" && <Bouton variante="encre" onClick={() => maj(d.id, "en_ligne")}>En ligne</Bouton>}
            </div>
            {ouvert === d.id && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-[12px]">{d.brief}</pre>}
          </li>
        ))}
      </ul>
    </section>
  );
}


// ── Les forfaits ─────────────────────────────────────────────────────────────

type ForfaitAdmin = {
  id: string; label: string; price_xaf: number; price_eur: number; monthly_tokens: number;
  description: string; badge: string | null; highlight: boolean; is_purchasable: boolean; is_active: boolean;
  features: { label: string; included: boolean }[];
  site_addon_xaf: number | null;
};

/**
 * Les forfaits, modifiables : prix, volume en conversations, textes, mise en
 * avant, vente. Le changement vaut tout de suite pour la page des tarifs, la
 * facturation et les limites ; les mois déjà payés ne bougent pas.
 */
function Forfaits() {
  const [liste, setListe] = useState<ForfaitAdmin[] | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [prixSite, setPrixSite] = useState("");
  const [occupeSite, setOccupeSite] = useState(false);
  const charger = useCallback(() => {
    fetch("/api/admin/plans", { headers: { ...authHeaders() }, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setListe(Array.isArray(d.plans) ? d.plans : []);
        if (d.option_site_xaf != null) setPrixSite(String(d.option_site_xaf));
      })
      .catch(() => setListe([]));
  }, []);

  async function enregistrerPrixSite() {
    setOccupeSite(true);
    try {
      const r = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ option_site_xaf: Number(prixSite || 0) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Enregistrement refusé");
      toast.success("Prix de l'option Site enregistré");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupeSite(false);
    }
  }
  useEffect(() => { charger(); }, [charger]);
  if (!liste?.length) return null;

  return (
    <section className="ui-carte mt-5 rounded-[24px] p-5">
      <p className="text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>Forfaits</p>
      <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
        Prix et volumes valent pour les prochains paiements et pour les limites de ce mois ; les mois déjà payés ne changent pas.
      </p>
      {/* L'option Site : un prix par défaut, que chaque forfait peut remplacer par son propre supplément. */}
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[16px] p-3" style={{ background: "#FAF9FC" }}>
        <ChampForfait libelle="Option Site · prix par défaut (FCFA / mois)">
          <input className="ui-champ w-[180px]" type="number" min="0" step="500" value={prixSite} onChange={(e) => setPrixSite(e.target.value)} />
        </ChampForfait>
        <Bouton variante="clair" icone={Check} occupe={occupeSite} disabled={occupeSite} onClick={enregistrerPrixSite}>Enregistrer</Bouton>
        <span className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Un forfait peut avoir son propre supplément Site (ouvrir le forfait).</span>
      </div>
      <ul className="mt-3 space-y-2">
        {liste.map((p) => (
          <li key={p.id} className="rounded-[16px] p-3" style={{ background: "#FAF9FC" }}>
            <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOuvert(ouvert === p.id ? null : p.id)}>
              <span className="flex-1 text-[14px] font-medium">{p.label} <span className="font-normal" style={{ color: "var(--cl-ink-faint)" }}>· {p.id}</span></span>
              <span className="text-[13px]">{p.price_xaf === -1 ? "Sur devis" : `${p.price_xaf.toLocaleString("fr-FR")} FCFA`}</span>
              <span className="text-[12.5px]" style={{ color: "var(--cl-ink-soft)" }}>{libelleConversations(p.monthly_tokens)}</span>
              {p.site_addon_xaf != null ? <span className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Site +{p.site_addon_xaf.toLocaleString("fr-FR")}</span> : null}
              {!p.is_active ? <Pastille ton="gris">masqué</Pastille> : p.is_purchasable ? <Pastille ton="vert">en vente</Pastille> : <Pastille ton="ambre">hors vente</Pastille>}
              <ChevronDown className="h-4 w-4" style={{ transform: ouvert === p.id ? "rotate(180deg)" : undefined }} />
            </button>
            {ouvert === p.id ? <EditeurForfait p={p} onFait={() => { charger(); setOuvert(null); }} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditeurForfait({ p, onFait }: { p: ForfaitAdmin; onFait: () => void }) {
  const illimite = p.monthly_tokens === -1;
  const [f, setF] = useState({
    label: p.label,
    prix: p.price_xaf === -1 ? "" : String(p.price_xaf),
    surDevis: p.price_xaf === -1,
    conversations: illimite ? "" : String(enConversations(p.monthly_tokens)),
    illimite,
    description: p.description,
    badge: p.badge ?? "",
    highlight: p.highlight,
    vente: p.is_purchasable,
    visible: p.is_active,
    avantages: p.features.map((x) => (x.included ? x.label : `- ${x.label}`)).join("\n"),
    site: p.site_addon_xaf == null ? "" : String(p.site_addon_xaf),
  });
  const [occupe, setOccupe] = useState(false);
  const maj = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function enregistrer() {
    setOccupe(true);
    try {
      const r = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          id: p.id,
          label: f.label,
          price_xaf: f.surDevis ? -1 : Number(f.prix || 0),
          monthly_tokens: f.illimite ? -1 : Math.max(1, Number(f.conversations || 0)) * TOKENS_PAR_CONVERSATION,
          description: f.description,
          badge: f.badge,
          highlight: f.highlight,
          is_purchasable: f.vente,
          is_active: f.visible,
          site_addon_xaf: f.site.trim() === "" ? null : Number(f.site),
          // Une ligne par avantage ; « - » devant = non compris dans ce forfait.
          features: f.avantages.split("\n").map((l) => l.trim()).filter(Boolean)
            .map((l) => (l.startsWith("-") ? { label: l.replace(/^-\s*/, ""), included: false } : { label: l, included: true })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Enregistrement refusé");
      toast.success(`Forfait ${f.label} enregistré`);
      onFait();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  const case_ = (k: "surDevis" | "illimite" | "highlight" | "vente" | "visible", libelle: string) => (
    <label className="flex items-center gap-2 text-[13px]">
      <input type="checkbox" checked={f[k]} onChange={(e) => maj(k, e.target.checked)} /> {libelle}
    </label>
  );

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <ChampForfait libelle="Nom affiché"><input className="ui-champ" value={f.label} onChange={(e) => maj("label", e.target.value)} /></ChampForfait>
      <ChampForfait libelle="Badge (facultatif)"><input className="ui-champ" value={f.badge} placeholder="Populaire" onChange={(e) => maj("badge", e.target.value)} /></ChampForfait>
      <ChampForfait libelle="Prix par mois (FCFA)">
        <input className="ui-champ" type="number" min="0" step="100" disabled={f.surDevis} value={f.prix} onChange={(e) => maj("prix", e.target.value)} />
        {case_("surDevis", "Sur devis")}
      </ChampForfait>
      <ChampForfait libelle="Conversations par mois">
        <input className="ui-champ" type="number" min="1" step="10" disabled={f.illimite} value={f.conversations} onChange={(e) => maj("conversations", e.target.value)} />
        {case_("illimite", "Illimité")}
      </ChampForfait>
      <ChampForfait libelle="Supplément option Site (FCFA / mois) · vide = prix par défaut">
        <input className="ui-champ" type="number" min="0" step="500" value={f.site} placeholder="prix par défaut" onChange={(e) => maj("site", e.target.value)} />
      </ChampForfait>
      <div className="sm:col-span-2">
        <ChampForfait libelle="Description"><input className="ui-champ" value={f.description} onChange={(e) => maj("description", e.target.value)} /></ChampForfait>
      </div>
      <div className="sm:col-span-2">
        <ChampForfait libelle="Avantages · une ligne chacun, « - » devant pour « non compris »">
          <textarea className="ui-champ" rows={5} value={f.avantages} onChange={(e) => maj("avantages", e.target.value)} />
        </ChampForfait>
      </div>
      <div className="flex flex-wrap gap-4 sm:col-span-2">
        {case_("vente", "En vente (payable)")}
        {case_("highlight", "Mis en avant")}
        {case_("visible", "Visible sur la page des tarifs")}
      </div>
      <div className="sm:col-span-2">
        <Bouton variante="encre" icone={Check} occupe={occupe} disabled={occupe} onClick={enregistrer}>Enregistrer</Bouton>
      </div>
    </div>
  );
}

/** Comme `Champ`, mais le libellé reste visible sur grand écran : ici il n'y a pas de colonne pour le porter. */
function ChampForfait({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <p className="px-1 text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>{libelle}</p>
      {children}
    </div>
  );
}
