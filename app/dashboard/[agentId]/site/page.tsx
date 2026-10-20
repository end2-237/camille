// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/[agentId]/site/page.tsx — l'option « Site ».
//
// Un site unique à l'image du commerce, branché sur Camille : catalogue,
// prix, stock et horaires à jour tout seuls, commandes dans le même tableau
// de bord. Le commerçant dit ce qu'il veut ; Camille prépare le brief.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Globe, Send } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { PRIX_OPTION_SITE_XAF } from "@/lib/plans";
import { Bandeau, Bouton, Pastille, Squelettes, StylesUI } from "@/components/dashboard/ui";

type Demande = { id: string; statut: string; domaine: string | null; envies: string | null; url: string | null; created_at: string };

const STATUTS: Record<string, { l: string; ton: "ambre" | "violet" | "vert" }> = {
  demande: { l: "Demande reçue", ton: "ambre" },
  en_cours: { l: "En fabrication", ton: "violet" },
  en_ligne: { l: "En ligne", ton: "vert" },
};

export default function SitePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [demande, setDemande] = useState<Demande | null | undefined>(undefined);
  const [brief, setBrief] = useState("");
  const [envies, setEnvies] = useState("");
  const [domaine, setDomaine] = useState("");
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const d = await (await fetch(`/api/agents/${agentId}/site`, { headers: { ...authHeaders() } })).json().catch(() => ({}));
    setDemande(d.demande ?? null);
    setBrief(d.brief || "");
  }, [agentId]);
  useEffect(() => { charger(); }, [charger]);

  async function demander() {
    setOccupe(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/site`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ envies, domaine }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Demande non envoyée");
      toast.success("Demande envoyée : l'équipe vous recontacte sur WhatsApp.");
      charger();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  if (demande === undefined) return <div className="py-8"><StylesUI /><Squelettes n={2} hauteur={160} /></div>;

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-8">
      <StylesUI />
      <section className="min-w-0 space-y-5">
        <div className="ui-carte rounded-[28px] p-6">
          <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cl-accent-deep)" }}><Globe className="h-4 w-4" /> Option « Site »</p>
          <h2 className="mt-2 text-[26px] font-medium tracking-[-0.03em]" style={{ color: "var(--cl-ink)" }}>Votre site, unique, relié à Camille</h2>
          <p className="mt-2 max-w-[60ch] text-[14.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
            Un site à votre image, léger sur mobile. Catalogue, prix, stock et horaires se mettent à jour tout seuls ;
            les commandes arrivent ici, avec celles de WhatsApp.
          </p>
          <p className="mt-4 text-[22px] font-semibold" style={{ color: "var(--cl-ink)" }}>
            +{PRIX_OPTION_SITE_XAF.toLocaleString("fr-FR")} FCFA <span className="text-[13px] font-normal" style={{ color: "var(--cl-ink-faint)" }}>/ mois, en plus de votre forfait</span>
          </p>
        </div>

        {demande ? (
          <div className="ui-carte rounded-[28px] p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>Votre demande</p>
              <Pastille ton={STATUTS[demande.statut]?.ton || "ambre"} point>{STATUTS[demande.statut]?.l || demande.statut}</Pastille>
            </div>
            {demande.url && <a href={demande.url} target="_blank" rel="noreferrer" className="mt-3 block text-[15px] underline">{demande.url}</a>}
            {demande.domaine && <p className="mt-2 text-[13.5px]" style={{ color: "var(--cl-ink-soft)" }}>Domaine souhaité : {demande.domaine}</p>}
            {demande.statut === "demande" && (
              <Bandeau ton="violet">L&apos;équipe prépare votre site à partir de vos informations et vous écrit sur WhatsApp pour valider le style.</Bandeau>
            )}
          </div>
        ) : (
          <div className="ui-carte space-y-4 rounded-[28px] p-6">
            <label className="grid gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Ce que vous voulez</span>
              <textarea className="ui-champ" rows={4} maxLength={2000} value={envies} onChange={(e) => setEnvies(e.target.value)}
                placeholder="Le style, les couleurs, un site que vous aimez, l'histoire de votre boutique…" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Nom de domaine <span className="font-normal" style={{ color: "var(--cl-ink-faint)" }}>· facultatif</span></span>
              <input className="ui-champ" value={domaine} onChange={(e) => setDomaine(e.target.value)} placeholder="maboutique.cm" />
            </label>
            <Bouton variante="encre" icone={Send} occupe={occupe} disabled={occupe} onClick={demander}>Créer mon site</Bouton>
          </div>
        )}
      </section>

      <aside>
        <p className="mb-2 px-2 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Ce que Camille sait déjà de vous</p>
        <pre className="ui-carte max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-[24px] p-5 text-[12px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{brief}</pre>
        <p className="mt-2 px-2 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Complétez votre catalogue et vos réglages : le site en profite directement.</p>
      </aside>
    </div>
  );
}
