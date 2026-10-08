"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Confirmer son adresse e-mail — le code à 6 chiffres reçu à l'inscription
// (ou après un changement d'adresse). Tant qu'il n'est pas saisi, créer un
// agent et payer restent fermés.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { CarteAuth, BoutonAuth } from "@/components/auth/CarteAuth";
import { authHeaders, getStoredToken, getStoredUser, storeAuth, type AuthUser } from "@/lib/auth-client";

export default function Page() {
  return <Suspense fallback={null}><Verifier /></Suspense>;
}

/** Une suite interne seulement : jamais de redirection vers un autre site. */
function suiteSure(s: string | null) {
  return s && s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

function Verifier() {
  const router = useRouter();
  const suite = suiteSure(useSearchParams().get("suite"));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attente, setAttente] = useState(0);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getStoredToken()) { router.replace("/login"); return; }
    const u = getStoredUser();
    if (u?.email_verified !== false) { router.replace(suite); return; }
    setUser(u);
    setAttente(45); // le premier code vient de partir
  }, [router, suite]);

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((a) => a - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  const appeler = (corps: object) =>
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(corps),
    }).then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }));

  const valider = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) { setErreur("Le code fait 6 chiffres."); return; }
    setErreur(null); setLoading(true);
    try {
      const { ok, d } = await appeler({ code });
      if (!ok) { setErreur(d.error || "Code refusé."); setCode(""); champ.current?.focus(); return; }
      const jeton = getStoredToken();
      if (jeton && user) storeAuth({ ...user, email_verified: true }, jeton);
      toast.success("Adresse confirmée");
      router.push(suite);
    } catch {
      setErreur("Connexion impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const renvoyer = async () => {
    setErreur(null);
    const { ok, d } = await appeler({ renvoyer: 1 });
    if (!ok) { setErreur(d.error || "Envoi impossible."); if (d.attente) setAttente(Math.min(d.attente, 3600)); return; }
    toast.success("Nouveau code envoyé");
    setAttente(60);
  };

  // Six chiffres saisis (ou collés) : on valide sans attendre le clic.
  useEffect(() => {
    if (code.length === 6 && !loading) valider();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!user) return null;

  return (
    <CarteAuth titre="Confirmez votre adresse" sous={<>Nous avons envoyé un code à 6 chiffres à <b style={{ color: "var(--cl-ink)" }}>{user.email}</b>.</>}>
      <form onSubmit={valider} noValidate className="mt-6 flex flex-col gap-5">
        <div>
          <input ref={champ} value={code} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-label="Code de vérification" placeholder="••••••"
            className="ca-input text-center font-semibold" style={{ fontSize: 26, letterSpacing: "0.5em", paddingLeft: "0.5em" }} />
          {erreur && <p className="mt-1.5 text-[12px]" style={{ color: "#C2504B" }}>{erreur}</p>}
        </div>
        <BoutonAuth loading={loading} disabled={code.length !== 6}>Confirmer</BoutonAuth>
      </form>

      <div className="mt-6 flex items-start gap-3 rounded-xl p-4 text-[14px] leading-[1.5]" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-ink-soft)" }}>
        <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
        <span>
          Rien reçu ? Regardez dans les spams, ou{" "}
          {attente > 0 ? (
            <span>redemandez un code dans {attente} s</span>
          ) : (
            <button type="button" onClick={renvoyer} className="font-medium underline" style={{ color: "var(--cl-accent-deep)" }}>renvoyez un code</button>
          )}
          . Mauvaise adresse ?{" "}
          <Link href="/dashboard/profil" className="font-medium underline" style={{ color: "var(--cl-accent-deep)" }}>Corrigez-la</Link>.
        </span>
      </div>
    </CarteAuth>
  );
}
