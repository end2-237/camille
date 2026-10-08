"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Mon profil — le compte, pas l'agent.
//
// Qui je suis (nom, e-mail), comment j'entre (mot de passe, autres appareils),
// ce que j'ai (abonnement, agents, et pour chacun : sur quel WhatsApp il parle).
// Tout ce qui touche à l'accès au compte redemande le mot de passe actuel : le
// serveur l'exige de toute façon (PATCH /api/auth/me).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, Check, ChevronRight, KeyRound, LogOut, Mail, MonitorSmartphone, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { authHeaders, getStoredToken, storeAuth, type AuthUser } from "@/lib/auth-client";
import { useAuth } from "@/hooks/useAuth";
import { useAgentCourant } from "@/components/dashboard/coquille/AgentCourant";
import { Bandeau, Bouton, Pastille, StylesUI, apparait, type Ton } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

const PLANS: Record<string, { libelle: string; ton: Ton }> = {
  free: { libelle: "Gratuit", ton: "gris" },
  starter: { libelle: "Starter", ton: "violet" },
  pro: { libelle: "Pro", ton: "violet" },
  enterprise: { libelle: "Enterprise", ton: "vert" },
};

type EtatWa = { connecte: boolean; mode?: "propre" | "application" | null; numero?: string | null; nom_verifie?: string | null };

async function patch(corps: Record<string, unknown>) {
  const r = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(corps),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
  // Le navigateur garde une copie du compte : on la remet à jour.
  const jeton = getStoredToken();
  if (d.user && jeton) storeAuth(d.user as AuthUser, jeton);
  return d as { user: AuthUser; sessions_fermees: number; code_envoye?: boolean };
}

function Section({ icone: Icone, titre, sous, rang, children }: {
  icone: React.ElementType; titre: string; sous?: string; rang: number; children: React.ReactNode;
}) {
  return (
    <motion.section {...apparait(rang)} className="ui-carte rounded-[28px] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
          <Icone className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[17px] font-medium" style={{ color: "var(--cl-ink)" }}>{titre}</p>
          {sous && <p className="mt-0.5 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>{sous}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

function Champ({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</span>
      {children}
      {aide && <span className="mt-1 block px-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{aide}</span>}
    </label>
  );
}

/** Une jauge simple : longueur et variété, pas un faux calcul d'entropie. */
function force(mdp: string): { niveau: number; texte: string; couleur: string } {
  let n = 0;
  if (mdp.length >= 8) n++;
  if (mdp.length >= 12) n++;
  if (/[A-Z]/.test(mdp) && /[a-z]/.test(mdp)) n++;
  if (/\d/.test(mdp) && /[^A-Za-z0-9]/.test(mdp)) n++;
  const t = [
    { texte: "Trop court", couleur: "#C2504B" },
    { texte: "Faible", couleur: "#E0A43A" },
    { texte: "Correct", couleur: "#E0A43A" },
    { texte: "Solide", couleur: "#1DAB55" },
    { texte: "Très solide", couleur: "#1DAB55" },
  ][n];
  return { niveau: n, ...t };
}

export default function ProfilPage() {
  const { user, logout } = useAuth();
  const { visibles } = useAgentCourant();
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  // ── Identité ──────────────────────────────────────────────────────────────
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [mdpEmail, setMdpEmail] = useState("");
  const [occupeId, setOccupeId] = useState(false);
  useEffect(() => { if (user) { setNom(user.full_name || ""); setEmail(user.email || ""); } }, [user]);
  // Rien n'est « modifié » tant que les champs n'ont pas reçu les valeurs du
  // compte (sinon, au premier rendu, le champ vide passerait pour un changement).
  const rempli = monte && !!user && email !== "";
  const emailChange = rempli && email.trim() !== user!.email;
  const identiteModifiee = rempli && (nom.trim() !== (user!.full_name || "") || emailChange);

  async function enregistrerIdentite() {
    setOccupeId(true);
    try {
      const d = await patch({ full_name: nom, ...(emailChange ? { email, current_password: mdpEmail } : {}) });
      setMdpEmail("");
      // Nouvelle adresse : elle se confirme par le code qui vient d'y partir.
      if (d.user?.email_verified === false) {
        toast.success("Adresse changée — saisissez le code reçu");
        window.location.href = "/verifier-email?suite=/dashboard/profil";
        return;
      }
      toast.success("Profil enregistré");
      // useAuth relit le navigateur au prochain affichage ; on recharge pour
      // que l'en-tête montre tout de suite le nouveau nom.
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setOccupeId(false); }
  }

  // ── Mot de passe ──────────────────────────────────────────────────────────
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [occupeMdp, setOccupeMdp] = useState(false);
  const f = force(nouveau);
  const mdpPret = actuel && nouveau.length >= 8 && nouveau === confirmation;

  async function changerMdp() {
    setOccupeMdp(true);
    try {
      const d = await patch({ current_password: actuel, new_password: nouveau });
      setActuel(""); setNouveau(""); setConfirmation("");
      toast.success(d.sessions_fermees ? `Mot de passe changé · ${d.sessions_fermees} autre(s) appareil(s) déconnecté(s)` : "Mot de passe changé");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setOccupeMdp(false); }
  }

  // ── Appareils ─────────────────────────────────────────────────────────────
  const [occupeApp, setOccupeApp] = useState(false);
  async function fermerAutres() {
    setOccupeApp(true);
    try {
      const d = await patch({ deconnecter_autres: true });
      toast.success(d.sessions_fermees ? `${d.sessions_fermees} autre(s) appareil(s) déconnecté(s)` : "Aucun autre appareil n'était connecté");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setOccupeApp(false); }
  }

  // ── WhatsApp de chaque agent ──────────────────────────────────────────────
  const [wa, setWa] = useState<Record<string, EtatWa | null>>({});
  const ids = useMemo(() => visibles.map((a) => a.id).join(","), [visibles]);
  useEffect(() => {
    let vivant = true;
    visibles.forEach((a) => {
      fetch(`/api/agents/${a.id}/meta`, { headers: { ...authHeaders() } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => vivant && setWa((w) => ({ ...w, [a.id]: d })))
        .catch(() => vivant && setWa((w) => ({ ...w, [a.id]: null })));
    });
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const plan = (monte && PLANS[user?.plan || "free"]) || PLANS.free;
  const initiale = monte ? (user?.full_name || user?.email || "?").trim()[0]?.toUpperCase() : "";

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* ── Identité ─────────────────────────────────────────────────── */}
          <Section icone={UserRound} titre="Identité" sous="Votre nom apparaît dans le tableau de bord et les notifications." rang={0}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={RESSORT}
                className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full text-[30px] font-semibold text-white"
                style={{ background: "linear-gradient(150deg, #A792F4 0%, #6442E8 100%)" }}>
                {initiale}
              </motion.span>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <Champ label="Nom complet">
                  <input className="ui-champ" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom" autoComplete="name" />
                </Champ>
                <Champ label="E-mail de connexion">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
                    <input className="ui-champ" style={{ paddingLeft: 42 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                </Champ>
                <AnimatePresence>
                  {emailChange && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      transition={RESSORT} className="overflow-hidden sm:col-span-2">
                      <Champ label="Mot de passe actuel" aide="Nécessaire pour changer l'adresse de connexion.">
                        <input className="ui-champ" type="password" value={mdpEmail} onChange={(e) => setMdpEmail(e.target.value)} autoComplete="current-password" />
                      </Champ>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Bouton variante="encre" icone={Check} occupe={occupeId}
                disabled={!identiteModifiee || occupeId || (emailChange && !mdpEmail)} onClick={enregistrerIdentite}>
                Enregistrer
              </Bouton>
            </div>
          </Section>

          {/* ── Mot de passe ─────────────────────────────────────────────── */}
          <Section icone={KeyRound} titre="Mot de passe" sous="Changer de mot de passe déconnecte aussi vos autres appareils." rang={1}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Champ label="Actuel">
                <input className="ui-champ" type="password" value={actuel} onChange={(e) => setActuel(e.target.value)} autoComplete="current-password" />
              </Champ>
              <Champ label="Nouveau">
                <input className="ui-champ" type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} autoComplete="new-password" />
              </Champ>
              <Champ label="Confirmation" aide={confirmation && confirmation !== nouveau ? "Les deux mots de passe diffèrent." : undefined}>
                <input className="ui-champ" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" />
              </Champ>
            </div>
            {nouveau && (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex flex-1 gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span key={i} className="h-1.5 flex-1 rounded-full" initial={false}
                      animate={{ backgroundColor: i < f.niveau ? f.couleur : "#ECE9F1" }} transition={{ duration: 0.25 }} />
                  ))}
                </div>
                <span className="text-[12.5px] font-medium" style={{ color: f.couleur }}>{f.texte}</span>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <Bouton variante="encre" icone={ShieldCheck} occupe={occupeMdp} disabled={!mdpPret || occupeMdp} onClick={changerMdp}>
                Changer le mot de passe
              </Bouton>
            </div>
          </Section>

          {/* ── Appareils ────────────────────────────────────────────────── */}
          <Section icone={MonitorSmartphone} titre="Appareils connectés" sous="Un téléphone perdu, un ordinateur partagé ? Fermez toutes les autres sessions." rang={2}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] p-4" style={{ background: "#FAF9FC" }}>
              <span className="flex items-center gap-2 text-[14px]" style={{ color: "var(--cl-ink)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: "#1DAB55" }} /> Cet appareil reste connecté.
              </span>
              <div className="flex flex-wrap gap-2">
                <Bouton variante="clair" icone={MonitorSmartphone} occupe={occupeApp} disabled={occupeApp} onClick={fermerAutres}>
                  Déconnecter les autres appareils
                </Bouton>
                <Bouton variante="danger" icone={LogOut} onClick={logout}>Se déconnecter</Bouton>
              </div>
            </div>
          </Section>
        </div>

        {/* ── À côté : l'abonnement et les WhatsApp ─────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-[96px] lg:self-start">
          <motion.div {...apparait(1)} className="relative overflow-hidden rounded-[28px] p-6" style={{ background: "linear-gradient(150deg, #A792F4 0%, #C6B8FA 100%)" }}>
            <p className="text-[13px] text-white/80">Votre abonnement</p>
            <p className="mt-1 flex items-center gap-2 text-[34px] font-light leading-none tracking-[-0.03em] text-white">
              <Sparkles className="h-6 w-6" /> {plan.libelle}
            </p>
            <p className="mt-2 text-[13px] text-white/80">{visibles.length} agent{visibles.length > 1 ? "s" : ""} sur ce compte</p>
            <Link href="/dashboard/billing"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>
              Gérer l&apos;abonnement <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div {...apparait(2)} className="ui-carte rounded-[28px] p-5">
            <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>WhatsApp de vos agents</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Connecter ou déconnecter se fait sur la page de chaque agent.</p>
            <ul className="mt-4 space-y-2">
              {visibles.map((a) => {
                const e = wa[a.id];
                const ton: Ton = e === undefined ? "gris" : e?.connecte ? "vert" : "ambre";
                const texte = e === undefined ? "…" : !e ? "Inconnu" : e.mode === "propre" ? "Son numéro" : e.mode === "application" ? "Numéro de l'appli" : "Non connecté";
                return (
                  <li key={a.id}>
                    <Link href={`/dashboard/${a.id}/whatsapp`}
                      className="flex items-center gap-3 rounded-[18px] p-2.5 transition-colors hover:bg-[#F4F0FF]">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[15px]" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                        {a.identity.avatar_emoji || a.identity.name?.[0]?.toUpperCase() || "A"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{a.identity.name}</span>
                        <span className="block truncate text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                          {e?.connecte ? (e.nom_verifie || e.numero || "WhatsApp officiel") : "WhatsApp officiel"}
                        </span>
                      </span>
                      <Pastille ton={ton} point>{texte}</Pastille>
                    </Link>
                  </li>
                );
              })}
              {!visibles.length && <li className="text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>Aucun agent pour l&apos;instant.</li>}
            </ul>
          </motion.div>

          {monte && user?.is_admin && (
            <Bandeau ton="violet" titre="Compte administrateur">
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" /> Accès à la console d&apos;exploitation.</span>
            </Bandeau>
          )}
        </aside>
      </div>
    </div>
  );
}
