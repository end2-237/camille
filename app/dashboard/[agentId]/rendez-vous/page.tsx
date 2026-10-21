"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Les rendez-vous de l'agent : ceux demandés sur WhatsApp, à confirmer ; ceux
// confirmés, à honorer ; et un rendez-vous saisi à la main (téléphone, salon).
// Deux rendez-vous actifs ne se chevauchent jamais : la base le refuse.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarClock, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { Bandeau, Bouton, Pastille, Squelettes, StylesUI, type Ton } from "@/components/dashboard/ui";

type Rdv = {
  id: string; phone: string; nom: string | null; prestation: string | null;
  debut: string; fin: string; statut: "demande" | "confirme" | "annule" | "termine" | "absent"; source: string;
};

const STATUTS: Record<Rdv["statut"], { l: string; ton: Ton }> = {
  demande: { l: "À confirmer", ton: "ambre" },
  confirme: { l: "Confirmé", ton: "vert" },
  annule: { l: "Annulé", ton: "gris" },
  termine: { l: "Terminé", ton: "violet" },
  absent: { l: "Absent", ton: "rouge" },
};

const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Douala" });
const cleJour = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { timeZone: "Africa/Douala" });

export default function RendezVousPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [donnees, setDonnees] = useState<{ pret: boolean; rendezVous: Rdv[]; reglages: { duree: number; pas: number }; libres: string[]; horaires: string | null } | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [form, setForm] = useState({ nom: "", phone: "", date: "", heure: "", duree: "", prestation: "" });
  const [reglages, setReglages] = useState({ duree: 30, pas: 30 });

  const charger = useCallback(async () => {
    const d = await (await fetch(`/api/agents/${agentId}/rendez-vous?jours=30`, { headers: { ...authHeaders() } })).json().catch(() => null);
    if (d) {
      setDonnees(d);
      setReglages(d.reglages);
    }
  }, [agentId]);
  useEffect(() => { charger(); }, [charger]);

  const parJour = useMemo(() => {
    const m = new Map<string, Rdv[]>();
    for (const r of donnees?.rendezVous || []) {
      if (r.statut === "annule") continue;
      const k = cleJour(r.debut);
      m.set(k, [...(m.get(k) || []), r]);
    }
    return [...m.entries()];
  }, [donnees]);
  const aConfirmer = (donnees?.rendezVous || []).filter((r) => r.statut === "demande" && new Date(r.debut) > new Date());

  async function statut(id: string, s: Rdv["statut"]) {
    const motif = s === "annule" ? prompt("Motif (facultatif, envoyé au client)") ?? "" : "";
    setOccupe(id);
    try {
      const r = await fetch(`/api/agents/${agentId}/rendez-vous`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id, statut: s, motif }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Refusé");
      if (d.avertissement) toast.warning(d.avertissement);
      else toast.success(s === "confirme" ? "Confirmé : le client est prévenu sur WhatsApp" : s === "annule" ? "Annulé : le client est prévenu" : "Enregistré");
      charger();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(null);
    }
  }

  async function creer() {
    if (!form.phone || !form.date || !form.heure) return toast.error("Téléphone, date et heure");
    setOccupe("nouveau");
    try {
      const debut = new Date(`${form.date}T${form.heure}:00+01:00`).toISOString();
      const r = await fetch(`/api/agents/${agentId}/rendez-vous`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nom: form.nom, phone: form.phone, debut, duree: form.duree ? Number(form.duree) : undefined, prestation: form.prestation }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Refusé");
      toast.success("Rendez-vous ajouté, client prévenu");
      if (d.avertissement) toast.warning(d.avertissement);
      setNouveau(false);
      setForm({ nom: "", phone: "", date: "", heure: "", duree: "", prestation: "" });
      charger();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(null);
    }
  }

  async function enregistrerReglages() {
    const r = await fetch(`/api/agents/${agentId}/rendez-vous`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(reglages),
    });
    if (r.ok) { toast.success("Réglages enregistrés"); charger(); } else toast.error("Réglages refusés");
  }

  if (!donnees) return <div className="py-8"><StylesUI /><Squelettes n={3} hauteur={120} /></div>;

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-8">
      <StylesUI />
      <section className="min-w-0 space-y-4">
        {!donnees.pret && (
          <Bandeau ton="ambre" titre="Une étape avant d'utiliser les rendez-vous">
            Exécutez migration_rendezvous.sql dans Supabase Studio, puis rechargez cette page.
          </Bandeau>
        )}
        {!donnees.horaires && (
          <Bandeau ton="violet" titre="Pas d'horaires d'ouverture">
            Sans horaires, Camille propose du lundi au samedi, 8 h-19 h. Réglez vos horaires dans la page de l'agent.
          </Bandeau>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>
            <CalendarClock className="h-5 w-5" /> Rendez-vous
            {aConfirmer.length > 0 && <Pastille ton="ambre" point>{aConfirmer.length} à confirmer</Pastille>}
          </p>
          <Bouton variante="encre" icone={Plus} onClick={() => setNouveau((v) => !v)}>Ajouter</Bouton>
        </div>

        {nouveau && (
          <div className="ui-carte grid gap-3 rounded-[24px] p-5 sm:grid-cols-2">
            <input className="ui-champ" placeholder="Nom du client" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            <input className="ui-champ" placeholder="Téléphone (6XXXXXXXX)" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="ui-champ" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="ui-champ" type="time" step={900} value={form.heure} onChange={(e) => setForm({ ...form, heure: e.target.value })} />
            <input className="ui-champ" placeholder={`Durée (min) — ${reglages.duree} par défaut`} type="number" min={15} step={15} value={form.duree} onChange={(e) => setForm({ ...form, duree: e.target.value })} />
            <input className="ui-champ" placeholder="Prestation (facultatif)" value={form.prestation} onChange={(e) => setForm({ ...form, prestation: e.target.value })} />
            <div className="sm:col-span-2">
              <Bouton variante="encre" icone={Check} occupe={occupe === "nouveau"} disabled={occupe === "nouveau"} onClick={creer}>Enregistrer et prévenir le client</Bouton>
            </div>
          </div>
        )}

        {parJour.length === 0 ? (
          <div className="ui-carte rounded-[24px] p-6 text-[14px]" style={{ color: "var(--cl-ink-soft)" }}>
            Aucun rendez-vous pour l&apos;instant. Ceux demandés sur WhatsApp apparaîtront ici, à confirmer.
          </div>
        ) : parJour.map(([k, liste]) => (
          <div key={k} className="ui-carte rounded-[24px] p-4">
            <p className="mb-2 px-1 text-[13px] font-medium capitalize" style={{ color: "var(--cl-ink-soft)" }}>{jour(liste[0].debut)}</p>
            <ul className="divide-y" style={{ borderColor: "var(--cl-line)" }}>
              {liste.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-1 py-3">
                  <span className="w-[92px] shrink-0 text-[15px] font-semibold tabular-nums" style={{ color: "var(--cl-ink)" }}>{heure(r.debut)}–{heure(r.fin)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{r.nom || `+${r.phone}`}{r.prestation ? ` · ${r.prestation}` : ""}</span>
                    <span className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>+{r.phone} · {r.source === "tableau" ? "saisi ici" : "WhatsApp"}</span>
                  </span>
                  <Pastille ton={STATUTS[r.statut].ton} point>{STATUTS[r.statut].l}</Pastille>
                  <span className="flex gap-1.5">
                    {r.statut === "demande" && <Bouton variante="encre" icone={Check} occupe={occupe === r.id} onClick={() => statut(r.id, "confirme")}>Confirmer</Bouton>}
                    {(r.statut === "demande" || r.statut === "confirme") && <Bouton variante="clair" icone={X} onClick={() => statut(r.id, "annule")}>Annuler</Bouton>}
                    {r.statut === "confirme" && new Date(r.debut) < new Date() && (
                      <>
                        <Bouton variante="clair" onClick={() => statut(r.id, "termine")}>Venu</Bouton>
                        <Bouton variante="clair" onClick={() => statut(r.id, "absent")}>Absent</Bouton>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside className="space-y-4">
        <div className="ui-carte space-y-3 rounded-[24px] p-5">
          <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Réglages</p>
          <label className="grid gap-1 text-[13px]">
            Durée d&apos;un rendez-vous (minutes)
            <input className="ui-champ" type="number" min={15} step={15} value={reglages.duree} onChange={(e) => setReglages({ ...reglages, duree: Number(e.target.value) })} />
          </label>
          <label className="grid gap-1 text-[13px]">
            Espacement des créneaux proposés (minutes)
            <input className="ui-champ" type="number" min={15} step={15} value={reglages.pas} onChange={(e) => setReglages({ ...reglages, pas: Number(e.target.value) })} />
          </label>
          <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
            Une prestation peut avoir sa propre durée. Deux rendez-vous ne se chevauchent jamais : un créneau pris n&apos;est plus proposé.
          </p>
          <Bouton variante="encre" onClick={enregistrerReglages}>Enregistrer</Bouton>
        </div>
        <div className="ui-carte rounded-[24px] p-5">
          <p className="mb-2 text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Prochains créneaux libres</p>
          {donnees.libres.length ? (
            <ul className="space-y-1 text-[13.5px]">
              {donnees.libres.map((d) => <li key={d} className="capitalize">{jour(d)} · {heure(d)}</li>)}
            </ul>
          ) : <p className="text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>Aucun créneau libre dans les 15 prochains jours.</p>}
        </div>
      </aside>
    </div>
  );
}
