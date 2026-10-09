"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Rejoindre une équipe — la page ouverte depuis le lien d'invitation.
//
// Connecté avec la bonne adresse : un bouton, et l'on rejoint. Sinon : se
// connecter ou créer son compte avec CETTE adresse, puis revenir ici (le lien
// est repris automatiquement après la connexion et la vérification).
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { CarteAuth, BoutonAuth } from "@/components/auth/CarteAuth";
import { apiLogout, authHeaders, clearAuth, getStoredToken, getStoredUser, type AuthUser } from "@/lib/auth-client";

export default function Page() {
  return <Suspense fallback={null}><Rejoindre /></Suspense>;
}

type Invitation = { valide: boolean; email?: string; role?: "gerant" | "vendeur"; invitant?: string; commerce?: string | null };

function Rejoindre() {
  const router = useRouter();
  const jeton = useSearchParams().get("jeton") || "";
  const [inv, setInv] = useState<Invitation | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setUser(getStoredToken() ? getStoredUser() : null);
    fetch(`/api/team/accept?jeton=${encodeURIComponent(jeton)}`)
      .then((r) => r.json())
      .then(setInv)
      .catch(() => setInv({ valide: false }));
  }, [jeton]);

  const ici = `/rejoindre?jeton=${encodeURIComponent(jeton)}`;

  const accepter = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErreur(null);
    try {
      const r = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ jeton }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.code === "email_non_verifie") { router.push(`/verifier-email?suite=${encodeURIComponent(ici)}`); return; }
        setErreur(d.error || "Impossible de rejoindre l'équipe.");
        return;
      }
      toast.success("Bienvenue dans l'équipe");
      router.push("/dashboard");
    } finally { setLoading(false); }
  };

  if (!inv) {
    return (
      <CarteAuth titre="Un instant…" sous="Lecture de l'invitation.">
        <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--cl-accent-deep)" }} /></div>
      </CarteAuth>
    );
  }

  if (!inv.valide) {
    return (
      <CarteAuth titre="Invitation expirée" sous="Ce lien a déjà servi, a été retiré, ou a dépassé ses 7 jours. Demandez à la personne qui vous a invité de vous en renvoyer un.">
        <div />
      </CarteAuth>
    );
  }

  const role = inv.role === "gerant" ? "gérant" : "vendeur";
  const qui = inv.commerce ? `${inv.invitant} (${inv.commerce})` : inv.invitant;
  const bonneAdresse = user && user.email.toLowerCase() === inv.email?.toLowerCase();

  return (
    <CarteAuth titre="Rejoindre l'équipe" sous={<><b style={{ color: "var(--cl-ink)" }}>{qui}</b> vous invite en tant que <b style={{ color: "var(--cl-ink)" }}>{role}</b>.</>}>
      <div className="mt-6 flex items-start gap-3 rounded-xl p-4 text-[14px] leading-[1.5]" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-ink-soft)" }}>
        <Users className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "var(--cl-accent-deep)" }} />
        <span>Invitation pour <b style={{ color: "var(--cl-ink)" }}>{inv.email}</b> : connectez-vous ou créez votre compte avec cette adresse.</span>
      </div>

      {bonneAdresse ? (
        <form onSubmit={accepter} className="mt-5">
          {erreur && <p className="mb-3 text-[13px]" style={{ color: "#C2504B" }}>{erreur}</p>}
          <BoutonAuth loading={loading}>Rejoindre</BoutonAuth>
        </form>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {user && (
            <p className="text-[13.5px]" style={{ color: "#C2504B" }}>
              Vous êtes connecté avec {user.email}. Connectez-vous avec {inv.email} pour accepter.
            </p>
          )}
          <button type="button"
            onClick={async () => {
              // Changer de compte : on ferme d'abord la session en cours, sinon
              // la page de connexion renverrait aussitôt au tableau de bord.
              if (user) { await apiLogout().catch(() => {}); clearAuth(); }
              window.location.href = `/login?suite=${encodeURIComponent(ici)}`;
            }}
            className="ca-btn flex w-full items-center justify-center rounded-lg font-semibold text-white" style={{ background: "var(--cl-accent-deep)" }}>
            {user ? "Changer de compte" : "Se connecter"}
          </button>
          {!user && (
            <Link href={`/login?mode=register&suite=${encodeURIComponent(ici)}`}
              className="flex h-[50px] w-full items-center justify-center rounded-lg text-center text-[16px] font-medium"
              style={{ border: "1px solid #D9D5DF", color: "var(--cl-ink)" }}>
              Créer mon compte
            </Link>
          )}
        </div>
      )}
    </CarteAuth>
  );
}
