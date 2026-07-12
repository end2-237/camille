"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowRight, User, Lock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAuth } from "@/hooks/useAuth";

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

export default function LoginPage() {
  const router  = useRouter();
  const { login, register: registerUser, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode]       = useState<"login" | "register">("login");

  useEffect(() => {
    if (isLoggedIn) router.replace("/dashboard");
  }, [isLoggedIn, router]);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onLogin = async ({ email, password }: LoginForm) => {
    setLoading(true);
    try {
      const user = await login(email, password);
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
      toast.success(`Compte créé ! Bienvenue, ${user.full_name ?? user.email} !`);
      router.push("/dashboard");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-dvh flex items-center justify-center px-4 py-20 overflow-hidden">

      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,90,248,0.12) 0%, transparent 65%)" }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.018]"
        style={{ backgroundImage: "linear-gradient(rgba(124,90,248,1) 1px,transparent 1px),linear-gradient(90deg,rgba(124,90,248,1) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="rounded-3xl p-8 relative"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(124,90,248,0.5), transparent)" }}
          />

          {/* Header */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(124,90,248,0.1)", border: "1px solid rgba(124,90,248,0.25)" }}
            >
              <Lock className="w-5 h-5" style={{ color: "var(--color-gold)" }} />
            </div>
            <div className="text-center space-y-1.5">
              <h1 className="font-good-timing text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {mode === "login" ? "Accéder à " : "Créer un compte "}
                <span className="text-gold-gradient">Camille</span>
              </h1>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden mb-6"
            style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2 text-xs font-medium transition-all duration-150"
                style={{
                  background: mode === m ? "rgba(124,90,248,0.1)" : "transparent",
                  color: mode === m ? "var(--color-gold)" : "var(--text-disabled)",
                  borderBottom: mode === m ? "2px solid var(--color-gold)" : "2px solid transparent",
                }}
              >
                {m === "login" ? "Se connecter" : "Créer un compte"}
              </button>
            ))}
          </div>

          {/* Login form */}
          {mode === "login" && (
            <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
                  <input type="email" autoComplete="email" autoFocus {...loginForm.register("email")}
                    placeholder="vous@exemple.fr" className="input-midnight pl-10" />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
                  <input type="password" autoComplete="current-password" {...loginForm.register("password")}
                    placeholder="••••••••" className="input-midnight pl-10" />
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="pt-1">
                <GoldButton type="submit" loading={loading} className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />} iconPosition="right">
                  Se connecter
                </GoldButton>
              </div>
            </form>
          )}

          {/* Register form */}
          {mode === "register" && (
            <form onSubmit={registerForm.handleSubmit(onRegister)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Prénom <span style={{ color: "var(--text-disabled)" }}>(optionnel)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
                  <input type="text" autoFocus {...registerForm.register("full_name")}
                    placeholder="Marie" className="input-midnight pl-10" />
                </div>
                {registerForm.formState.errors.full_name && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{registerForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
                  <input type="email" autoComplete="email" {...registerForm.register("email")}
                    placeholder="vous@exemple.fr" className="input-midnight pl-10" />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
                  <input type="password" autoComplete="new-password" {...registerForm.register("password")}
                    placeholder="Minimum 8 caractères" className="input-midnight pl-10" />
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="pt-1">
                <GoldButton type="submit" loading={loading} className="w-full justify-center"
                  icon={<UserPlus className="w-3.5 h-3.5" />} iconPosition="right">
                  Créer mon compte
                </GoldButton>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-5" style={{ color: "var(--text-disabled)" }}>
          Pas encore d'agent ?{" "}
          <Link href="/configure"
            className="transition-colors duration-200 hover:text-[var(--color-gold)]"
            style={{ color: "var(--text-tertiary)" }}>
            Créer mon premier agent →
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
