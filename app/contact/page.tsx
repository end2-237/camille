// ─────────────────────────────────────────────────────────────────────────────
// app/contact/page.tsx — Contact — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, MapPin, Clock, Send, Check, Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";

const TOPICS = [
  "Démo produit",
  "Support technique",
  "Partenariat",
  "Presse & Médias",
  "Autre",
];

const INFOS = [
  { icon: Mail,          label: "Email général",   value: COMPANY.emailPrimary,  href: `mailto:${COMPANY.emailPrimary}`  },
  { icon: MessageSquare, label: "Support",          value: COMPANY.emailSupport,  href: `mailto:${COMPANY.emailSupport}`  },
  { icon: Phone,         label: "Téléphone",        value: COMPANY.phone,         href: `tel:${COMPANY.phoneRaw}`         },
  { icon: MapPin,        label: "Localisation",     value: COMPANY.address,       href: undefined                         },
  { icon: Clock,         label: "Temps de réponse", value: "Sous 24h ouvrées",    href: undefined                         },
];

export default function ContactPage() {
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic]     = useState(TOPICS[0]);
  const [form, setForm]       = useState({ name: "", email: "", message: "" });
  const [errors, setErrors]   = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name    = "Votre nom est requis";
    if (!form.email.trim())   e.email   = "Un email valide est requis";
    if (!form.message.trim()) e.message = "Décrivez votre besoin";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    setSent(true);
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Background */}
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(124,90,248,0.1) 0%, transparent 60%)" }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.018]"
        style={{ backgroundImage: "linear-gradient(rgba(124,90,248,1) 1px,transparent 1px),linear-gradient(90deg,rgba(124,90,248,1) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-gold)" }}>
            Contact
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-good-timing text-4xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            Parlons de <span className="text-gold-gradient">votre projet</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Notre équipe répond dans les 24 heures ouvrées.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-4xl mx-auto pt-14 grid lg:grid-cols-[1fr_340px] gap-10">

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="flex flex-col items-center justify-center gap-5 py-20 text-center"
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(124,90,248,0.1)", border: "1px solid rgba(124,90,248,0.3)" }}>
                  <Check className="w-6 h-6" style={{ color: "var(--color-gold)" }} />
                </div>
                <div>
                  <h2 className="font-good-timing text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                    Message envoyé
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                    Merci {form.name}. Nous revenons vers vous sous 24h.
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Topic */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Sujet</label>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((t) => (
                      <button key={t} type="button" onClick={() => setTopic(t)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                        style={{
                          background: topic === t ? "rgba(124,90,248,0.1)" : "var(--bg-muted)",
                          border: topic === t ? "1px solid rgba(124,90,248,0.35)" : "1px solid var(--border-subtle)",
                          color: topic === t ? "var(--color-gold)" : "var(--text-tertiary)",
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name + Email */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Nom</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Marie Dupont" className="input-midnight" />
                    {errors.name && <p className="text-xs" style={{ color: "#f87171" }}>{errors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="marie@entreprise.com" className="input-midnight" />
                    {errors.email && <p className="text-xs" style={{ color: "#f87171" }}>{errors.email}</p>}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Message</label>
                  <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={5} placeholder="Décrivez votre projet, vos besoins, vos questions…"
                    className="input-midnight resize-none" />
                  {errors.message && <p className="text-xs" style={{ color: "#f87171" }}>{errors.message}</p>}
                </div>

                <button type="submit" disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                             transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#7C5AF8,#A78BFA 50%,#6442E8)", color: "#000", boxShadow: "0 4px 20px rgba(124,90,248,0.2)" }}>
                  {loading ? (
                    <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                      Envoi en cours…
                    </motion.span>
                  ) : (<><Send className="w-3.5 h-3.5" />Envoyer le message</>)}
                </button>
              </form>
            )}
          </motion.div>

          {/* Info sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
              {INFOS.map((info, i) => {
                const Icon = info.icon;
                const isClickable = !!info.href;
                const textColor = info.href?.startsWith("mailto") || info.href?.startsWith("tel")
                  ? "var(--color-gold)" : "var(--text-primary)";
                return (
                  <div key={info.label}
                    className="flex items-start gap-3 px-4 py-4"
                    style={{
                      borderBottom: i < INFOS.length - 1 ? "1px solid var(--border-subtle)" : undefined,
                      background: i % 2 === 0 ? "var(--bg-elevated)" : "var(--bg-muted)",
                    }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "rgba(124,90,248,0.08)", border: "1px solid rgba(124,90,248,0.15)" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-disabled)" }}>{info.label}</p>
                      {isClickable ? (
                        <a href={info.href} className="text-xs font-medium transition-colors hover:opacity-70"
                          style={{ color: textColor }}>{info.value}</a>
                      ) : (
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{info.value}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(124,90,248,0.04)", border: "1px solid rgba(124,90,248,0.14)" }}>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                Pour les demandes urgentes ou les démos personnalisées, mentionnez-le dans votre message — nous priorisons ces demandes.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
