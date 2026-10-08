"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Nouveau mot de passe — la page ouverte depuis le lien reçu par e-mail.
// On vérifie le lien en arrivant, pour ne pas faire taper un mot de passe
// pour rien ; une fois changé, toutes les sessions sont fermées.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { CarteAuth, ChampAuth, BoutonAuth, OeilAuth } from "@/components/auth/CarteAuth";

export default function Page() {
  return <Suspense fallback={null}><Reinitialiser /></Suspense>;
}

function force(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const NIVEAUX = [
  { t: "Trop court", c: "#C2504B" }, { t: "Faible", c: "#D9822B" }, { t: "Correct", c: "#C9A227" },
  { t: "Bon", c: "#1DAB55" }, { t: "Excellent", c: "#1DAB55" },
];

function Reinitialiser() {
  const router = useRouter();
  const jeton = useSearchParams().get("jeton") || "";
  const [etat, setEtat] = useState<"verif" | "valide" | "invalide" | "fait">("verif");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [conf, setConf] = useState("");
  const [voir, setVoir] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!jeton) { setEtat("invalide"); return; }
    fetch(`/api/auth/reset?jeton=${encodeURIComponent(jeton)}`)
      .then((r) => r.json())
      .then((d) => { if (d.valide) { setEmail(d.email || ""); setEtat("valide"); } else setEtat("invalide"); })
      .catch(() => setEtat("invalide"));
  }, [jeton]);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mdp.length < 8) { setErreur("Minimum 8 caractères"); return; }
    if (mdp !== conf) { setErreur("Les deux mots de passe ne correspondent pas"); return; }
    setErreur(null); setLoading(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, password: mdp }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Échec. Réessayez."); if (r.status === 400 && /lien/.test(d.error || "")) setEtat("invalide"); return; }
      // Les sessions ont été fermées côté serveur : on oublie aussi celle d'ici.
      try { localStorage.removeItem("camille_token"); localStorage.removeItem("camille_user"); } catch {}
      setEtat("fait");
      toast.success("Mot de passe changé");
    } catch {
      setErreur("Connexion impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  if (etat === "verif") {
    return (
      <CarteAuth titre="Un instant…" sous="Vérification du lien.">
        <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--cl-accent-deep)" }} /></div>
      </CarteAuth>
    );
  }

  if (etat === "invalide") {
    return (
      <CarteAuth titre="Lien expiré" sous="Ce lien a déjà servi ou a dépassé ses 30 minutes. Demandez-en un nouveau, ça prend quelques secondes.">
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/mot-de-passe-oublie" className="ca-btn flex w-full items-center justify-center gap-2 rounded-lg font-semibold text-white" style={{ background: "var(--cl-accent-deep)" }}>
            <LinkIcon className="h-4 w-4" /> Recevoir un nouveau lien
          </Link>
        </div>
      </CarteAuth>
    );
  }

  if (etat === "fait") {
    return (
      <CarteAuth titre="C'est fait" sous="Votre mot de passe est changé. Par sécurité, tous vos appareils ont été déconnectés.">
        <div className="mt-6 flex items-center gap-3 rounded-xl p-4 text-[14px]" style={{ background: "#E8F7EE", color: "#17663A" }}>
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> Vous pouvez vous reconnecter avec le nouveau.
        </div>
        <button type="button" onClick={() => router.push("/login")}
          className="ca-btn mt-5 flex w-full items-center justify-center rounded-lg font-semibold text-white" style={{ background: "var(--cl-accent-deep)" }}>
          Se connecter
        </button>
      </CarteAuth>
    );
  }

  const f = force(mdp);
  return (
    <CarteAuth titre="Nouveau mot de passe" sous={email ? <>Pour le compte <b style={{ color: "var(--cl-ink)" }}>{email}</b>.</> : "Choisissez-en un que vous n'utilisez pas ailleurs."}>
      <form onSubmit={valider} noValidate className="mt-6 flex flex-col gap-5">
        <ChampAuth label="Nouveau mot de passe">
          <div className="relative">
            <input type={voir ? "text" : "password"} autoComplete="new-password" autoFocus value={mdp} onChange={(e) => setMdp(e.target.value)}
              placeholder="Minimum 8 caractères" className="ca-input pr-12" />
            <OeilAuth voir={voir} onClick={() => setVoir((v) => !v)} />
          </div>
          {mdp && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < f ? NIVEAUX[f].c : "#ECE9F1" }} />
                ))}
              </div>
              <span className="text-[12px] font-medium" style={{ color: NIVEAUX[f].c }}>{NIVEAUX[f].t}</span>
            </div>
          )}
        </ChampAuth>
        <ChampAuth label="Confirmer" erreur={erreur}>
          <input type={voir ? "text" : "password"} autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)}
            placeholder="Le même, une seconde fois" className="ca-input" />
        </ChampAuth>
        <BoutonAuth loading={loading}>Changer le mot de passe</BoutonAuth>
      </form>
    </CarteAuth>
  );
}
