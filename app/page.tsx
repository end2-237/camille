// ─────────────────────────────────────────────────────────────────────────────
// app/page.tsx — Camille by Buyticle
// Landing v4 — design "Render-like" autonome (header + footer propres).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "Camille — Agents IA WhatsApp No-Code par Buyticle",
  description:
    "La voie la plus rapide vers un agent IA sur WhatsApp. Créez, connectez et faites grandir votre assistant — zéro code, zéro ops, cinq minutes.",
};

export default function HomePage() {
  return <Landing />;
}
