"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Équipe — inviter ceux qui travaillent avec soi.
//
// Le propriétaire invite une adresse e-mail avec un rôle (gérant ou vendeur)
// et choisit les agents ouverts. L'invité reçoit un lien ; le propriétaire peut
// aussi le copier pour l'envoyer par WhatsApp. Un membre voit ici les comptes
// auxquels il a accès et peut les quitter.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Mail, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { useAgentCourant } from "@/components/dashboard/coquille/AgentCourant";
import { Bandeau, Bouton, Pastille, StylesUI, Squelettes, Vide, apparait } from "@/components/dashboard/ui";

type Membre = {
  id: string; email: string; role: "gerant" | "vendeur"; agent_ids: string[] | null;
  status: "pending" | "active"; invited_at: string; accepted_at: string | null; expiree: boolean; full_name: string | null;
};
type Acces = { id: string; role: "gerant" | "vendeur"; agent_ids: string[] | null; proprietaire_email: string; proprietaire_nom: string | null };

const ROLES = {
  gerant: { libelle: "Gérant", texte: "Ventes, catalogue et réglages des agents. Ni facturation, ni équipe." },
  vendeur: { libelle: "Vendeur", texte: "Commandes, réclamations, clients et livraisons." },
} as const;

export default function EquipePage() {
  const { visibles } = useAgentCourant();
  const miens = visibles.filter((a) => !a.role || a.role === "proprietaire");
  const [membres, setMembres] = useState<Membre[] | null>(null);
  const [acces, setAcces] = useState<Acces[]>([]);
  const [erreur, setErreur] = useState("");

  const [ouvert, setOuvert] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"gerant" | "vendeur">("vendeur");
  const [tous, setTous] = useState(true);
  const [choix, setChoix] = useState<string[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [lien, setLien] = useState("");
  const [aRetirer, setARetirer] = useState("");

  const charger = useCallback(async () => {
    try {
      const r = await fetch("/api/team", { headers: { ...authHeaders() }, cache: "no-store" });
      const d = await r.json();
      setErreur(d.error || "");
      setMembres(d.membres || []);
      setAcces(d.acces || []);
    } catch (e) {
      setErreur((e as Error).message);
      setMembres([]);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function inviter() {
    setOccupe(true); setLien("");
    try {
      const r = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email, role, agent_ids: tous ? null : choix }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Invitation impossible"); return; }
      toast.success(d.envoye ? `Invitation envoyée à ${email}` : "Invitation créée — copiez le lien pour l'envoyer");
      setLien(d.lien || "");
      setEmail(""); setChoix([]); setTous(true);
      await charger();
    } finally { setOccupe(false); }
  }

  async function retirer(id: string) {
    const r = await fetch(`/api/team/${id}`, { method: "DELETE", headers: { ...authHeaders() } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || "Impossible"); return; }
    setARetirer("");
    toast.success("Accès retiré");
    charger();
  }

  async function changerRole(m: Membre, nouveau: "gerant" | "vendeur") {
    const r = await fetch(`/api/team/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ role: nouveau }),
    });
    if (r.ok) { toast.success(`${m.email} est maintenant ${ROLES[nouveau].libelle.toLowerCase()}`); charger(); }
  }

  const nomAgent = (id: string) => visibles.find((a) => a.id === id)?.identity?.name || "Agent";
  const portee = (ids: string[] | null) => (ids === null ? "Tous les agents" : ids.map(nomAgent).join(", "));

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          {erreur && <Bandeau ton="rouge">{erreur}</Bandeau>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px]" style={{ color: "var(--cl-ink-soft)" }}>
              Les personnes qui travaillent avec vous, chacune avec le rôle qui lui convient.
            </p>
            {!ouvert && miens.length > 0 && (
              <Bouton variante="encre" icone={UserPlus} onClick={() => setOuvert(true)}>Inviter</Bouton>
            )}
          </div>

          <AnimatePresence>
            {ouvert && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="ui-carte space-y-4 rounded-[28px] p-5 sm:p-6">
                <p className="text-[17px] font-medium" style={{ color: "var(--cl-ink)" }}>Nouvelle invitation</p>
                <label className="block">
                  <span className="mb-1.5 block px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Adresse e-mail</span>
                  <input className="ui-champ" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" />
                </label>
                <div>
                  <span className="mb-1.5 block px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Rôle</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((k) => (
                      <button key={k} type="button" onClick={() => setRole(k)}
                        className="rounded-[20px] p-4 text-left transition"
                        style={{ background: role === k ? "var(--cl-accent-soft)" : "#FAF9FC", boxShadow: role === k ? "inset 0 0 0 1.5px var(--cl-accent)" : "none" }}>
                        <p className="text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{ROLES[k].libelle}</p>
                        <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--cl-ink-faint)" }}>{ROLES[k].texte}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Agents ouverts</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setTous(true)} className="rounded-full px-3.5 py-2 text-[13px]"
                      style={{ background: tous ? "var(--cl-ink)" : "#F4F2F7", color: tous ? "#fff" : "var(--cl-ink)" }}>Tous</button>
                    {miens.map((a) => {
                      const actif = !tous && choix.includes(a.id);
                      return (
                        <button key={a.id} type="button"
                          onClick={() => { setTous(false); setChoix((c) => (c.includes(a.id) ? c.filter((x) => x !== a.id) : [...c, a.id])); }}
                          className="rounded-full px-3.5 py-2 text-[13px]"
                          style={{ background: actif ? "var(--cl-ink)" : "#F4F2F7", color: actif ? "#fff" : "var(--cl-ink)" }}>
                          {a.identity?.name || "Agent"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Bouton onClick={() => { setOuvert(false); setLien(""); }}>Fermer</Bouton>
                  <Bouton variante="encre" icone={Mail} occupe={occupe}
                    disabled={occupe || !/^\S+@\S+\.\S+$/.test(email) || (!tous && !choix.length)} onClick={inviter}>
                    Envoyer l&apos;invitation
                  </Bouton>
                </div>
                {lien && (
                  <Bandeau ton="violet" titre="Le lien d'invitation"
                    action={<Bouton icone={Copy} onClick={() => { navigator.clipboard?.writeText(lien); toast.success("Lien copié"); }}>Copier</Bouton>}>
                    Envoyez-le aussi par WhatsApp si vous voulez. Il ne fonctionne que pour l&apos;adresse invitée, pendant 7 jours.
                  </Bandeau>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {membres === null ? (
            <Squelettes n={2} hauteur={84} />
          ) : membres.length === 0 ? (
            miens.length > 0 ? (
              <Vide doodle="sitting-reading" titre="Vous travaillez seul pour l'instant."
                texte="Invitez un vendeur pour suivre les commandes, ou un gérant pour vous aider à tenir la boutique."
                action={!ouvert ? <Bouton variante="encre" icone={Plus} onClick={() => setOuvert(true)}>Inviter quelqu&apos;un</Bouton> : undefined} />
            ) : null
          ) : (
            <ul className="space-y-3">
              {membres.map((m, i) => (
                <motion.li key={m.id} {...apparait(i)} className="ui-carte rounded-[24px] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-semibold"
                      style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
                      {(m.full_name || m.email).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{m.full_name || m.email}</p>
                      <p className="truncate text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                        {m.full_name ? `${m.email} · ` : ""}{portee(m.agent_ids)}
                      </p>
                    </div>
                    {m.status === "pending" ? (
                      <Pastille ton={m.expiree ? "rouge" : "ambre"} point>{m.expiree ? "Invitation expirée" : "Invitation envoyée"}</Pastille>
                    ) : (
                      <select value={m.role} onChange={(e) => changerRole(m, e.target.value as "gerant" | "vendeur")}
                        className="h-9 rounded-full px-3 text-[13px]" style={{ background: "#F4F2F7", color: "var(--cl-ink)" }}>
                        <option value="vendeur">Vendeur</option>
                        <option value="gerant">Gérant</option>
                      </select>
                    )}
                    {aRetirer === m.id ? (
                      <div className="flex gap-2">
                        <Bouton onClick={() => setARetirer("")}>Garder</Bouton>
                        <Bouton variante="danger" onClick={() => retirer(m.id)}>Retirer</Bouton>
                      </div>
                    ) : (
                      <Bouton variante="doux" icone={Trash2} onClick={() => setARetirer(m.id)} aria-label="Retirer">
                        <span className="sr-only">Retirer</span>
                      </Bouton>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <motion.div {...apparait(1)} className="ui-carte rounded-[28px] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: "var(--cl-accent-deep)" }} />
              <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Qui peut faire quoi</p>
            </div>
            <ul className="space-y-2.5 text-[13px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>
              <li><b style={{ color: "var(--cl-ink)" }}>Propriétaire</b> — tout, dont l&apos;abonnement et l&apos;équipe.</li>
              <li><b style={{ color: "var(--cl-ink)" }}>Gérant</b> — {ROLES.gerant.texte}</li>
              <li><b style={{ color: "var(--cl-ink)" }}>Vendeur</b> — {ROLES.vendeur.texte}</li>
            </ul>
          </motion.div>

          {acces.length > 0 && (
            <motion.div {...apparait(2)} className="ui-carte rounded-[28px] p-5">
              <p className="mb-3 text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Équipes que vous avez rejointes</p>
              <ul className="space-y-3">
                {acces.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{a.proprietaire_nom || a.proprietaire_email}</p>
                      <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{ROLES[a.role].libelle}</p>
                    </div>
                    <Bouton variante="doux" onClick={() => retirer(a.id)}>Quitter</Bouton>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </aside>
      </div>
    </div>
  );
}
