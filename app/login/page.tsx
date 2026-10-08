"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Connexion — deux colonnes : à gauche ce que fait Camille, à droite la carte
// de connexion. Toujours en clair, aux couleurs de Camille (violet, lavande),
// indépendamment du thème du tableau de bord.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Zap, ShieldCheck, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { retenirConnexion } from "@/lib/auth-client";
import { IllustrationConnexion } from "@/components/auth/IllustrationConnexion";
import pkg from "@/package.json";

const loginSchema = z.object({
  email:    z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const registerSchema = z.object({
  email:     z.string().email("Email invalide"),
  password:  z.string().min(8, "Minimum 8 caractères"),
  full_name: z.string().min(2, "Minimum 2 caractères").optional(),
});

type LoginForm    = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

const ATOUTS = [
  { icon: Zap,         titre: "Réponse",    sous: "instantanée",   couleur: "#1DAB55" },
  { icon: ShieldCheck, titre: "Connexion",  sous: "sécurisée",     couleur: "#6442E8" },
  { icon: Briefcase,   titre: "Prêt pour",  sous: "les pros",      couleur: "#7C5AF8" },
];

export default function LoginPage() {
  const router  = useRouter();
  const { login, register: registerUser, isLoggedIn } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [mode, setMode]         = useState<"login" | "register">("login");
  const [voir, setVoir]         = useState(false);
  const [retenir, setRetenir]   = useState(true);

  useEffect(() => {
    if (isLoggedIn) router.replace("/dashboard");
  }, [isLoggedIn, router]);

  const loginForm    = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onLogin = async ({ email, password }: LoginForm) => {
    setLoading(true);
    try {
      const user = await login(email, password);
      retenirConnexion(retenir);
      toast.success(`Bienvenue, ${user.full_name ?? user.email} !`);
      router.push("/dashboard");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async ({ email, password, full_name }: RegisterForm) => {
    setLoading(true);
    try {
      const user = await registerUser(email, password, full_name);
      retenirConnexion(true);
      toast.success(`Compte créé ! Bienvenue, ${user.full_name ?? user.email} !`);
      router.push("/dashboard");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  const connexion = mode === "login";
  const erreur = (m?: string) => m ? <p className="mt-1.5 text-[12px]" style={{ color: "#C2504B" }}>{m}</p> : null;

  return (
    <div className="cnx flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ── Gauche : ce que fait Camille ─────────────────────────────── */}
        <aside className="cnx-gauche hidden flex-col justify-between px-12 py-12 lg:flex lg:w-1/2 xl:px-16">
          <div>
            <Marque />
            <h1 className="mt-14 text-[44px] font-bold leading-[1.08] tracking-[-0.03em]" style={{ color: "var(--cl-ink)" }}>
              Répondre. Vendre.<br />Livrer.
            </h1>
            <p className="mt-5 max-w-[440px] text-[17px] leading-[1.6]" style={{ color: "var(--cl-ink-soft)" }}>
              Votre vendeur WhatsApp qui répond, montre le catalogue et prend les commandes —
              jour et nuit, depuis une seule plateforme.
            </p>
          </div>

          <IllustrationConnexion className="my-8 w-full max-w-[620px]" />

          <ul className="grid max-w-[560px] grid-cols-3 gap-4">
            {ATOUTS.map(({ icon: Icon, titre, sous, couleur }) => (
              <li key={titre} className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white" style={{ boxShadow: "0 4px 14px rgba(100,66,232,0.08)" }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: couleur }} />
                </span>
                <span className="text-[13px] leading-tight" style={{ color: "var(--cl-ink-soft)" }}>
                  {titre}<br />{sous}
                </span>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Droite : la carte de connexion ───────────────────────────── */}
        <main className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-10">
          <div className="mb-8 lg:hidden"><Marque /></div>

          <div className="cnx-carte w-full max-w-[548px] rounded-2xl bg-white px-6 py-9 sm:px-9">
            <h2 className="text-[28px] font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>
              {connexion ? "Bon retour" : "Créer un compte"}
            </h2>
            <p className="mt-1 text-[16px]" style={{ color: "var(--cl-ink-soft)" }}>
              {connexion ? "Connectez-vous pour continuer" : "Quelques secondes, et votre agent est à vous"}
            </p>

            {connexion ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="mt-8 space-y-5">
                <Champ label="Adresse e-mail">
                  <input type="email" autoComplete="email" autoFocus {...loginForm.register("email")}
                    placeholder="nom@entreprise.com" className="cnx-input" />
                  {erreur(loginForm.formState.errors.email?.message)}
                </Champ>
                <Champ label="Mot de passe">
                  <div className="relative">
                    <input type={voir ? "text" : "password"} autoComplete="current-password" {...loginForm.register("password")}
                      placeholder="••••••••" className="cnx-input pr-12" />
                    <BoutonOeil voir={voir} onClick={() => setVoir((v) => !v)} />
                  </div>
                  {erreur(loginForm.formState.errors.password?.message)}
                </Champ>

                <div className="flex items-center justify-between gap-3 text-[13.5px] sm:text-[15px]">
                  <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap sm:gap-2.5" style={{ color: "var(--cl-ink-soft)" }}>
                    <input type="checkbox" checked={retenir} onChange={(e) => setRetenir(e.target.checked)} className="cnx-case" />
                    Se souvenir de moi
                  </label>
                  <Link href="/contact" className="whitespace-nowrap font-medium hover:underline" style={{ color: "var(--cl-accent-deep)" }}>
                    Mot de passe oublié ?
                  </Link>
                </div>

                <BoutonPrincipal loading={loading}>Se connecter</BoutonPrincipal>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} noValidate className="mt-8 space-y-5">
                <Champ label="Prénom (optionnel)">
                  <input type="text" autoFocus {...registerForm.register("full_name")} placeholder="Marie" className="cnx-input" />
                  {erreur(registerForm.formState.errors.full_name?.message)}
                </Champ>
                <Champ label="Adresse e-mail">
                  <input type="email" autoComplete="email" {...registerForm.register("email")}
                    placeholder="nom@entreprise.com" className="cnx-input" />
                  {erreur(registerForm.formState.errors.email?.message)}
                </Champ>
                <Champ label="Mot de passe">
                  <div className="relative">
                    <input type={voir ? "text" : "password"} autoComplete="new-password" {...registerForm.register("password")}
                      placeholder="Minimum 8 caractères" className="cnx-input pr-12" />
                    <BoutonOeil voir={voir} onClick={() => setVoir((v) => !v)} />
                  </div>
                  {erreur(registerForm.formState.errors.password?.message)}
                </Champ>
                <BoutonPrincipal loading={loading}>Créer mon compte</BoutonPrincipal>
              </form>
            )}

            <div className="my-7 flex items-center gap-4">
              <span className="h-px flex-1" style={{ background: "var(--cl-line)" }} />
              <span className="text-[12px] font-semibold tracking-[0.12em]" style={{ color: "var(--cl-ink-faint)" }}>OU</span>
              <span className="h-px flex-1" style={{ background: "var(--cl-line)" }} />
            </div>

            <button type="button" onClick={() => setMode(connexion ? "register" : "login")} className="cnx-secondaire">
              {connexion ? "Créer un compte" : "J'ai déjà un compte"}
            </button>
          </div>

          <p className="mt-7 text-center text-[15px]" style={{ color: "var(--cl-ink-soft)" }}>
            Pas encore d&apos;agent ?{" "}
            <Link href="/configure" className="font-medium hover:underline" style={{ color: "var(--cl-accent-deep)" }}>
              Créer mon premier agent.
            </Link>
          </p>
        </main>
      </div>

      {/* ── Pied de page ─────────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-center gap-x-14 gap-y-2 border-t px-6 py-5 text-[13px] font-medium sm:justify-between lg:px-16"
        style={{ borderColor: "var(--cl-line)", background: "#FBFAFD", color: "var(--cl-ink-soft)" }}>
        <span>© {new Date().getFullYear()} Camille by Buyticle</span>
        <span className="flex gap-10">
          <Link href="/privacy" className="hover:underline">Confidentialité</Link>
          <Link href="/terms" className="hover:underline">Conditions d&apos;utilisation</Link>
        </span>
        <span style={{ color: "var(--cl-ink-faint)" }}>Version {pkg.version} •</span>
      </footer>

      <style jsx>{`
        .cnx { background: #fff; font-family: "Inter Variable", "Inter", system-ui, sans-serif; }
        .cnx-gauche { background: linear-gradient(180deg, #FAF8FF 0%, #F5F1FF 100%); }
        .cnx-carte { box-shadow: 0 1px 2px rgba(25,23,27,0.04), 0 18px 50px rgba(100,66,232,0.08); border: 1px solid var(--cl-line-soft); }
        :global(.cnx-input) {
          width: 100%; height: 52px; border-radius: 8px; padding: 0 16px; font-size: 16px;
          color: var(--cl-ink); background: #fff; border: 1px solid #D9D5DF; outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        :global(.cnx-input::placeholder) { color: #8E88A0; }
        :global(.cnx-input:focus) { border-color: var(--cl-accent); box-shadow: 0 0 0 3px rgba(124,90,248,0.14); }
        :global(.cnx-case) { width: 18px; height: 18px; accent-color: var(--cl-accent-deep); }
        :global(.cnx-secondaire) {
          width: 100%; height: 56px; border-radius: 8px; font-size: 17px; font-weight: 500;
          color: var(--cl-ink); background: #fff; border: 1px solid #D9D5DF; transition: background .15s, border-color .15s;
        }
        :global(.cnx-secondaire:hover) { background: var(--cl-accent-soft); border-color: var(--cl-lavender); }
      `}</style>
    </div>
  );
}

function Marque() {
  return (
    <div className="flex items-center gap-3.5">
      <Image src="/icons/camille-192.png" alt="" width={44} height={44} className="rounded-xl" />
      <div className="leading-tight">
        <div className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: "var(--cl-ink)", fontFamily: "var(--font-good-timing)" }}>Camille</div>
        <div className="text-[12.5px] font-medium tracking-[0.14em]" style={{ color: "var(--cl-ink-soft)" }}>BY BUYTICLE</div>
      </div>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[14.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</label>
      {children}
    </div>
  );
}

function BoutonOeil({ voir, onClick }: { voir: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md"
      style={{ color: "var(--cl-ink-soft)" }}>
      {voir ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}

function BoutonPrincipal({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading}
      className="flex h-[58px] w-full items-center justify-center gap-2 rounded-lg text-[19px] font-semibold text-white transition disabled:opacity-70"
      style={{ background: "var(--cl-accent-deep)", boxShadow: "0 8px 22px rgba(100,66,232,0.28)" }}>
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}
