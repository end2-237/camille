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
import { motion } from "framer-motion";
import { RefreshCw, ShieldAlert, RotateCw, Check, X, Radio, TrendingUp, Bot, Siren, Eye, HeartPulse, ChevronDown } from "lucide-react";
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
                    <div className="admin-actions min-w-0 xl:justify-self-end">
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
