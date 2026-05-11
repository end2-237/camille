// ─────────────────────────────────────────────────────────────────────────────
// app/login/page.tsx — Camille by Buyticle
// Auth form — Good Timing heading · immersive dark bg · Framer entrance
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowRight, User, Lock } from "lucide-react";
import { toast } from "sonner";
import { GoldButton } from "@/components/ui/GoldButton";
import { useLocalAuth } from "@/hooks/useLocalAuth";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email("Email invalide"),
  name:  z.string().min(2, "Minimum 2 caractères").optional(),
});
type FormData = z.infer<typeof schema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn } = useLocalAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) router.replace("/dashboard");
  }, [isLoggedIn, router]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, name }: FormData) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const user = login(email, name);
    toast.success(`Bienvenue, ${user.name} !`, { description: "Connecté en mode local." });
    router.push("/dashboard");
  };

  return (
    <main className="relative min-h-dvh flex items-center justify-center px-4 py-20 overflow-hidden">

      {/* Background elements */}
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.12) 0%, transparent 65%)" }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.018]"
        style={{ backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,1) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />

      {/* Decorative orbs */}
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none fixed"
        style={{ width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)", top: "10%", left: "10%", filter: "blur(40px)" }}
      />
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="pointer-events-none fixed"
        style={{ width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)", bottom: "15%", right: "12%", filter: "blur(50px)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          {/* Gold top edge */}
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)" }}
          />

          {/* Header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)" }}
            >
              <Lock className="w-5 h-5" style={{ color: "var(--color-gold)" }} />
            </motion.div>
            <div className="text-center space-y-1.5">
              <h1
                className="font-good-timing text-2xl font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Accéder à{" "}
                <span className="text-gold-gradient">Camille</span>
              </h1>
              <p className="text-xs px-3 py-1 rounded-full inline-block"
                style={{ background: "rgba(212,175,55,0.08)", color: "rgba(212,175,55,0.7)", border: "1px solid rgba(212,175,55,0.14)" }}>
                Mode local — données dans le navigateur
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  {...register("email")}
                  placeholder="vous@exemple.fr"
                  className="input-midnight pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-xs" style={{ color: "#f87171" }}>{errors.email.message}</p>
              )}
            </div>

            {/* Nom */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Prénom{" "}
                <span style={{ color: "var(--text-disabled)" }}>(optionnel)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-disabled)" }} />
                <input
                  id="name"
                  type="text"
                  autoComplete="given-name"
                  {...register("name")}
                  placeholder="Marie"
                  className="input-midnight pl-10"
                />
              </div>
            </div>

            <div className="pt-1">
              <GoldButton
                type="submit"
                loading={loading}
                className="w-full justify-center"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
              >
                Accéder à mon espace
              </GoldButton>
            </div>
          </form>

          {/* Info */}
          <div
            className="mt-5 rounded-xl p-3 text-center"
            style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Données stockées localement dans votre navigateur. Aucun serveur, aucun compte requis.
            </p>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center text-xs mt-5" style={{ color: "var(--text-disabled)" }}>
          Pas encore d'agent ?{" "}
          <Link
            href="/configure"
            className="transition-colors duration-200 hover:text-[var(--color-gold)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Créer mon premier agent →
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
