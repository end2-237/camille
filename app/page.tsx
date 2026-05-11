// ─────────────────────────────────────────────────────────────────────────────
// app/page.tsx — Camille by Buyticle
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { HeroSection }          from "@/components/sections/HeroSection";
import { FeaturesSection }      from "@/components/sections/FeaturesSection";
import { HowItWorksSection }    from "@/components/sections/HowItWorksSection";
import { PartnersStrip }        from "@/components/sections/PartnersStrip";
import { ShowcaseCarousel }     from "@/components/sections/ShowcaseCarousel";
import { TestimonialsSection }  from "@/components/sections/TestimonialsSection";
import { NewsletterSection }    from "@/components/sections/NewsletterSection";
import { MarqueeStrip }         from "@/components/ui/MarqueeStrip";

export const metadata: Metadata = {
  title: "Camille — Agents IA No-Code par Buyticle",
};

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <HeroSection />
      <PartnersStrip />
      <MarqueeStrip />
      <FeaturesSection />
      <HowItWorksSection />
      <ShowcaseCarousel />
      <TestimonialsSection />
      <NewsletterSection />

      {/* Final CTA */}
      <section className="py-28 px-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-xl mx-auto text-center space-y-7">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-gold)" }}
          >
            Prêt ?
          </p>
          <h2
            className="font-good-timing text-3xl md:text-4xl font-bold leading-tight tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Déployez votre agent{" "}
            <span className="text-gold-gradient">maintenant</span>
          </h2>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Moins de 5 minutes pour créer un agent IA qui parle exactement comme votre marque.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link
              href="/configure"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                         transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg,#D4AF37 0%,#EDD96A 50%,#A8881A 100%)",
                color: "#000",
                boxShadow: "0 2px 20px rgba(212,175,55,0.2)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Créer mon agent gratuitement
            </Link>
            <Link
              href="/pricing"
              className="text-sm transition-colors duration-150 hover:opacity-80"
              style={{ color: "var(--text-tertiary)" }}
            >
              Voir les tarifs →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
