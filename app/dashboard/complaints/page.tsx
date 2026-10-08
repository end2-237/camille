// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/complaints/page.tsx
//
// Les réclamations, et surtout : RENDRE LA MAIN À CAMILLE.
//
// Pourquoi cette page existe, et pourquoi son absence était grave.
//
// Quand un client réclame, Camille se tait pour ce client — c'est la bonne
// règle : répondre par-dessus un humain est pire que ne pas répondre. Mais
// l'API qui pose ce silence existait depuis le début, et RIEN dans
// l'application ne permettait de le lever. Le drapeau `human_takeover` restait
// à vrai pour toujours.
//
// Observé en production, sur le numéro Buyticle : un client demande « qu'est-ce
// qui se passe si ma commande ne vient pas ? » — une question, pas une
// réclamation. Camille passe la main. Le client écrit ensuite « tu peux me
// proposer un truc pour écouter ? » et ne reçoit PLUS RIEN. Jamais. Un client
// prêt à acheter, perdu par une question.
//
// D'où les deux gestes de cette page, délibérément séparés :
//   • rendre la parole à Camille, sans classer le dossier ;
//   • classer le dossier, ce qui rend aussi la parole.
// Garder la main sur un client sans clore son dossier est un cas réel ; clore
// un dossier en laissant l'agent muet à vie ne doit plus en être un.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BotMessageSquare, CheckCheck, Hand, MessageCircle, RefreshCw, RotateCcw, Store, UserRound, VolumeX } from "lucide-react";
import { authHeaders } from "@/lib/auth-client";
import { Bandeau, Bouton, BoutonRond, Filtres, LienBouton, Pastille, Squelettes, StylesUI, Tuile, Vide, apparait } from "@/components/dashboard/ui";

type Complaint = {
  id: string;
  phone: string;
  title: string;
  content: Record<string, unknown> | null;
  status: string;
  created_at: string;
  agent_id: string;
  business_name: string;
  human_takeover: boolean;
};

/** « il y a 3 h » plutôt qu'une date : c'est l'attente qui compte ici. */
function depuis(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mn = Math.round(ms / 60000);
  if (!Number.isFinite(mn) || mn < 1) return "à l'instant";
  if (mn < 60) return `il y a ${mn} min`;
  const h = Math.round(mn / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? "s" : ""}`;
}

/** Le message du client, tel qu'il l'a écrit. C'est la seule chose qui compte. */
function messageDe(c: Complaint): string {
  const v = c.content && typeof c.content === "object" ? c.content : {};
  const m = (v as Record<string, unknown>).message;
  return typeof m === "string" && m.trim() ? m : "(sans message)";
}

export default function ComplaintsPage() {
  const [liste, setListe] = useState<Complaint[] | null>(null);
  const [filtre, setFiltre] = useState<"active" | "done">("active");
  const [err, setErr] = useState("");
  const [enCours, setEnCours] = useState<string>("");

  const charger = useCallback(async () => {
    try {
      const r = await fetch(`/api/complaints?status=${filtre}`, { headers: await authHeaders() });
      const d = await r.json();
      setListe(Array.isArray(d.complaints) ? d.complaints : []);
      setErr(d.error && !d.complaints?.length ? String(d.error) : "");
    } catch (e) {
      setErr((e as Error).message);
      setListe([]);
    }
  }, [filtre]);

  useEffect(() => { charger(); }, [charger]);

  /** Les deux gestes passent par le même appel, avec un corps différent. */
  const agir = async (id: string, corps: Record<string, unknown>) => {
    setEnCours(id);
    setErr("");
    try {
      const r = await fetch("/api/complaints", {
        method: "PATCH",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...corps }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Action refusée");
      await charger();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEnCours("");
    }
  };

  const muets = (liste || []).filter((c) => c.human_takeover).length;

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Filtres id="reclamations" label="Afficher" valeur={filtre}
              onChange={(v) => { setListe(null); setFiltre(v); }}
              options={[{ cle: "active", libelle: "En cours" }, { cle: "done", libelle: "Réglées" }]} />
            <BoutonRond icone={RefreshCw} label="Actualiser" onClick={charger} />
          </div>

          <div className="mt-4 space-y-3">
            {/* Le compteur n'est pas décoratif : chaque client muet est un client
                qui n'obtient plus aucune réponse, même pour une question anodine. */}
            {muets > 0 && (
              <Bandeau ton="ambre" titre={`${muets} client${muets > 1 ? "s sont" : " est"} entre vos mains.`}>
                Camille ne {muets > 1 ? "leur" : "lui"} répond plus, même s&apos;{muets > 1 ? "ils écrivent" : "il écrit"} pour autre chose.
                Rendez-lui la parole dès que c&apos;est réglé.
              </Bandeau>
            )}
            {err && <Bandeau ton="rouge">{err}</Bandeau>}
          </div>

          <div className="mt-5">
            {liste === null ? (
              <Squelettes n={3} hauteur={150} />
            ) : liste.length === 0 ? (
              <Vide doodle={filtre === "active" ? "meditating" : "reading"}
                titre={filtre === "active" ? "Aucune réclamation en cours." : "Aucune réclamation réglée pour l'instant."}
                texte={filtre === "active" ? "Quand un client se plaint ou demande à parler à quelqu'un, son dossier apparaît ici." : undefined} />
            ) : (
              <motion.div layout className="grid gap-3">
                <AnimatePresence initial={false}>
                  {liste.map((c, i) => {
                    const occupe = enCours === c.id;
                    return (
                      <motion.article key={c.id} layout {...apparait(i)} exit={{ opacity: 0, x: -24 }}
                        className="ui-carte rounded-[28px] p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                            <UserRound className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold" style={{ color: "var(--cl-ink)" }}>{c.phone || "Numéro inconnu"}</p>
                            <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                              <Store className="h-3.5 w-3.5" /> {c.business_name} · {depuis(c.created_at)}
                            </p>
                          </div>
                          {c.human_takeover
                            ? <Pastille ton="ambre" point>Camille est muette</Pastille>
                            : <Pastille ton="vert" point>Camille répond</Pastille>}
                        </div>

                        {/* Le message du client, en bulle : c'est ce qu'on vient lire. */}
                        <div className="mt-4 rounded-[22px] rounded-tl-[8px] px-4 py-3 text-[14px] leading-relaxed"
                          style={{ background: "#F4F2F7", color: "var(--cl-ink)", whiteSpace: "pre-wrap" }}>
                          {messageDe(c)}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {/* Le geste que l'application ne savait pas faire. */}
                          {c.human_takeover ? (
                            <Bouton variante="encre" icone={BotMessageSquare} occupe={occupe} disabled={occupe}
                              onClick={() => agir(c.id, { takeover: false })}>Rendre la main à Camille</Bouton>
                          ) : (
                            <Bouton variante="doux" icone={Hand} occupe={occupe} disabled={occupe}
                              onClick={() => agir(c.id, { takeover: true })}>Je m&apos;en occupe moi-même</Bouton>
                          )}
                          {c.status !== "done" ? (
                            <Bouton variante="clair" icone={CheckCheck} disabled={occupe} onClick={() => agir(c.id, { status: "done" })}>C&apos;est réglé</Bouton>
                          ) : (
                            <Bouton variante="clair" icone={RotateCcw} disabled={occupe} onClick={() => agir(c.id, { status: "active" })}>Rouvrir</Bouton>
                          )}
                          <LienBouton variante="vert" icone={MessageCircle} className="sm:ml-auto" href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer">
                            Écrire au client
                          </LienBouton>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>

        {/* ── À côté : où en est-on, et ce que font les deux gestes ─────────── */}
        <aside className="space-y-4 lg:sticky lg:top-[96px] lg:self-start">
          <Tuile icone={VolumeX} titre="Clients sans réponse" valeur={muets} fort={muets > 0}
            sous={muets > 0 ? "Camille attend votre feu vert" : "Camille répond à tout le monde"} />
          <motion.div {...apparait(1)} className="ui-carte rounded-[28px] p-5">
            <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Les deux gestes</p>
            <div className="mt-3 space-y-3 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
              <p><span className="font-medium" style={{ color: "var(--cl-ink)" }}>C&apos;est réglé</span> classe le dossier, rend la parole à Camille et prévient le client.</p>
              <p><span className="font-medium" style={{ color: "var(--cl-ink)" }}>Je m&apos;en occupe moi-même</span> fait taire Camille sans classer le dossier : utile pour suivre un client de bout en bout.</p>
            </div>
          </motion.div>
        </aside>
      </div>
    </div>
  );
}
