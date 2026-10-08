"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Mot de passe oublié — on demande l'adresse, on envoie un lien. Le message de
// confirmation est le même que le compte existe ou non.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { CarteAuth, ChampAuth, BoutonAuth } from "@/components/auth/CarteAuth";

export default function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErreur("Adresse e-mail invalide"); return; }
    setErreur(null); setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErreur(d.error || "Réessayez dans un instant."); return; }
      setEnvoye(true);
    } catch {
      setErreur("Connexion impossible. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  if (envoye) {
    return (
      <CarteAuth titre="Vérifiez votre boîte" sous={<>Si un compte existe pour <b style={{ color: "var(--cl-ink)" }}>{email.trim()}</b>, un lien vient de partir. Il est valable 30 minutes.</>}>
        <div className="mt-6 flex items-start gap-3 rounded-xl p-4 text-[14px] leading-[1.5]" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-ink-soft)" }}>
          <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
          <span>Rien après quelques minutes ? Regardez dans les spams, ou vérifiez l&apos;adresse et{" "}
            <button type="button" onClick={() => setEnvoye(false)} className="font-medium underline" style={{ color: "var(--cl-accent-deep)" }}>recommencez</button>.
          </span>
        </div>
      </CarteAuth>
    );
  }

  return (
    <CarteAuth titre="Mot de passe oublié" sous="Indiquez l'adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau.">
      <form onSubmit={envoyer} noValidate className="mt-6 flex flex-col gap-5">
        <ChampAuth label="Adresse e-mail" erreur={erreur}>
          <input type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="nom@entreprise.com" className="ca-input" />
        </ChampAuth>
        <BoutonAuth loading={loading}>Envoyer le lien</BoutonAuth>
      </form>
    </CarteAuth>
  );
}
