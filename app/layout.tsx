// ─────────────────────────────────────────────────────────────────────────────
// app/layout.tsx — Camille by Buyticle
// Polices : Inter (UI/app) · Cube (mots courts ≤6L) · Good Timing (branding long)
// Thème   : dark / light / system via ThemeProvider maison (localStorage + CSS vars).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import { ThemeProvider }  from "@/components/layout/ThemeProvider";
import { Navbar }         from "@/components/layout/Navbar";
import { Footer }         from "@/components/layout/Footer";
import { CookieBanner }   from "@/components/ui/CookieBanner";
import { Toaster }        from "sonner";
import { COMPANY }        from "@/lib/company";
// Inter chargé localement via @fontsource-variable — zéro requête réseau externe
import "@fontsource-variable/inter";
import "./globals.css";

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Camille — Agents IA No-Code par Buyticle",
    template: "%s | Camille",
  },
  description:
    "Créez, configurez et déployez des agents IA personnalisés pour WhatsApp, community management et stratégie — sans une ligne de code.",
  keywords: [
    "AI agent", "no-code", "WhatsApp automation",
    "community management", "SaaS", "Buyticle", "Camille",
  ],
  authors: [{ name: COMPANY.name, url: COMPANY.websiteUrl }],
  creator: COMPANY.name,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: COMPANY.productUrl,
    siteName: `${COMPANY.productName} by ${COMPANY.name}`,
    title: `${COMPANY.productName} — Agents IA No-Code`,
    description: "Déployez des agents IA premium sur WhatsApp en quelques minutes.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `${COMPANY.productName} by ${COMPANY.name}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${COMPANY.productName} — Agents IA No-Code par ${COMPANY.name}`,
    description: "Déployez des agents IA premium sur WhatsApp en minutes.",
    images: ["/og-image.png"],
    creator: COMPANY.twitter,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true, follow: true,
      "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// ── Layout ────────────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning évite le flash SSR/CSR du ThemeProvider
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {/* Ambient glow — adapté par le thème */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 h-[480px] ambient-glow z-0"
          />

          <Navbar />

          <div className="relative z-10">{children}</div>

          <Footer />

          <CookieBanner />

          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-gold)",
                color: "var(--text-primary)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
