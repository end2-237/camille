"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";

/**
 * Payer au Mobile Money, sans quitter Camille : le numéro, la demande qui
 * arrive sur le téléphone, puis l'attente de la confirmation.
 *
 * Avec Monetbil (secours, quand buyfacturation n'est pas configuré), la
 * réponse porte une page de paiement : on y va.
 */
export function PaiementMobileMoney({
  agentId, kind, planId, montant, libelle, onPaye,
}: {
  agentId: string;
  kind: "forfait" | "site";
  planId?: string;
  montant: number;
  libelle: string;
  onPaye: () => void;
}) {
  const [numero, setNumero] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [attente, setAttente] = useState<{ ref: string; instruction: string } | null>(null);
  const fini = useRef(false);

  useEffect(() => {
    if (!attente) return;
    fini.current = false;
    let essais = 0;
    const tic = setInterval(async () => {
      essais += 1;
      try {
        const d = await (await fetch(`/api/payments/verify?ref=${encodeURIComponent(attente.ref)}`, { headers: { ...authHeaders() } })).json();
        if (fini.current) return;
        if (d.status === "success") {
          fini.current = true;
          clearInterval(tic);
          toast.success("Paiement reçu, merci !");
          setAttente(null);
          onPaye();
        } else if (d.status === "failed") {
          fini.current = true;
          clearInterval(tic);
          toast.error("Le paiement n'est pas passé (refusé, solde insuffisant ou délai dépassé).");
          setAttente(null);
        }
      } catch { /* on réessaie au tour suivant */ }
      // Trois minutes : au-delà, l'opérateur a abandonné la demande.
      if (essais >= 45 && !fini.current) {
        clearInterval(tic);
        toast("Toujours en attente. Si vous avez validé, le paiement apparaîtra dans quelques minutes.");
        setAttente(null);
      }
    }, 4000);
    return () => clearInterval(tic);
  }, [attente, onPaye]);

  const payer = async () => {
    setEnvoi(true);
    try {
      const r = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ agentId, kind, planId, phone: numero, country: "CM" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Paiement impossible");
      if (d.payment_url) {
        window.location.href = d.payment_url;
        return;
      }
      setAttente({ ref: d.payment_ref, instruction: d.instruction });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Paiement impossible");
    } finally {
      setEnvoi(false);
    }
  };

  if (attente) {
    return (
      <div className="rounded-xl border p-4 text-[13.5px] leading-relaxed" style={{ borderColor: "var(--cl-line, #E7E3EE)" }}>
        <p className="font-medium" style={{ color: "var(--cl-ink, #19171B)" }}>📲 Demande envoyée sur le {numero}</p>
        <p className="mt-1" style={{ color: "var(--cl-ink-soft, #5F5A6B)" }}>{attente.instruction}</p>
        <p className="mt-2 text-[12px]" style={{ color: "var(--cl-ink-faint, #9A94A6)" }}>En attente de la confirmation de l&apos;opérateur…</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          className="ui-champ min-w-[160px] flex-1"
          type="tel"
          inputMode="tel"
          placeholder="Numéro MTN ou Orange · 6XXXXXXXX"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <button
          type="button"
          onClick={payer}
          disabled={envoi || numero.replace(/\D/g, "").length < 9}
          className="rounded-full px-5 py-2.5 text-[13.5px] font-medium text-white disabled:opacity-40"
          style={{ background: "var(--cl-ink, #19171B)" }}
        >
          {envoi ? "Envoi…" : `Payer ${montant.toLocaleString("fr-FR")} FCFA`}
        </button>
      </div>
      <p className="text-[12px]" style={{ color: "var(--cl-ink-faint, #9A94A6)" }}>
        {libelle} · une demande de paiement arrive sur ce téléphone, validez-la avec votre code.
      </p>
    </div>
  );
}
