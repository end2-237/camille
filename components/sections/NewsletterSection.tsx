"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

const PERKS = [
  "Nouveautés produit en avant-première",
  "Guides pratiques sur les agents IA",
  "Études de cas clients exclusives",
];

export function NewsletterSection() {
  const sectionRef               = useRef<HTMLElement>(null);
  const [email, setEmail]        = useState("");
  const [state, setState]        = useState<"idle" | "loading" | "done" | "error">("idle");
  const [touched, setTouched]    = useState(false);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const showErr = touched && email.length > 0 && !isValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    setState("loading");
    await new Promise((r) => setTimeout(r, 900));
    setState("done");
  }

  return (
    <section
      ref={sectionRef}
      className="relative py-24 px-6 overflow-hidden"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      {/* Background ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 55% at 50% 100%, rgba(212,175,55,0.06) 0%, transparent 65%)" }} />

      {/* Decorative grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,1) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="max-w-5xl mx-auto relative">
        <div className="grid lg:grid-cols-[1fr_400px] gap-16 items-center">

          {/* ── Left copy ── */}
          <div className="space-y-6">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--color-gold)" }}
            >
              Newsletter
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="font-good-timing text-3xl md:text-4xl font-bold leading-tight tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              L'IA qui travaille pour vous,{" "}
              <span className="text-gold-gradient">les insights qui vous avancent</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-sm leading-relaxed max-w-md"
              style={{ color: "var(--text-tertiary)" }}
            >
              Rejoignez les équipes qui suivent l'évolution des agents IA. Pas de spam — une synthèse bi-mensuelle, dense et actionnables.
            </motion.p>

            {/* Perks */}
            <motion.ul
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }}
              className="space-y-2.5"
            >
              {PERKS.map((p) => (
                <motion.li
                  key={p}
                  variants={{
                    hidden:   { opacity: 0, x: -12 },
                    visible:  { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
                  }}
                  className="flex items-center gap-2.5"
                >
                  <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p}</span>
                </motion.li>
              ))}
            </motion.ul>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.45 }}
              className="flex items-center gap-3 pt-2"
            >
              {/* Avatar stack */}
              <div className="flex -space-x-2">
                {["OB", "FK", "AM", "DS"].map((init, i) => (
                  <div key={init}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-2"
                    style={{
                      background: `hsl(${i * 55 + 30}, 40%, 18%)`,
                      color: `hsl(${i * 55 + 30}, 70%, 70%)`,
                      ringColor: "var(--bg-base)",
                    }}>
                    {init}
                  </div>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>+1 200 </span>
                professionnels abonnés
              </p>
            </motion.div>
          </div>

          {/* ── Right form card ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            {/* Gold hairline */}
            <div className="h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)" }} />

            <div className="p-7 space-y-6">
              {/* Card header */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Camille Insights</p>
                  <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>Bi-mensuel · Gratuit · Sans spam</p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {state === "done" ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                    className="flex flex-col items-center gap-4 py-6 text-center"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)" }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: "var(--color-gold)" }} />
                    </div>
                    <div>
                      <p className="font-good-timing text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                        Vous êtes inscrit·e
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        Confirmez votre email — le premier numéro arrive sous 48h.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    noValidate
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {/* Email field */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        Adresse email professionnelle
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder="vous@entreprise.com"
                        className="input-midnight"
                        style={showErr ? { borderColor: "#f87171" } : {}}
                        required
                      />
                      <AnimatePresence>
                        {showErr && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-[10px]"
                            style={{ color: "#f87171" }}
                          >
                            Entrez une adresse email valide
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={state === "loading"}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                                 transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg,#D4AF37,#EDD96A 50%,#A8881A)",
                        color: "#000",
                        boxShadow: "0 4px 20px rgba(212,175,55,0.2)",
                      }}
                    >
                      {state === "loading" ? (
                        <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                          Inscription en cours…
                        </motion.span>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          S'abonner gratuitement
                        </>
                      )}
                    </button>

                    {/* RGPD note */}
                    <p className="text-[10px] text-center leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                      En vous inscrivant, vous acceptez notre{" "}
                      <a href="/policies#privacy" className="underline underline-offset-2 transition-colors hover:opacity-70"
                        style={{ color: "var(--text-disabled)" }}>
                        politique de confidentialité
                      </a>
                      . Désabonnement en un clic.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
