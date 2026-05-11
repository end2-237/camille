// ─────────────────────────────────────────────────────────────────────────────
// marketing-vfx/src/Root.tsx — Camille by Buyticle
// Registers all Remotion compositions.
// ─────────────────────────────────────────────────────────────────────────────

import { Composition } from "remotion";
import { WhatsAppFlow } from "./compositions/WhatsAppFlow";
import { AgentBrandReveal } from "./compositions/AgentBrandReveal";

export const Root: React.FC = () => (
  <>
    {/*
      WhatsAppFlow — 15-second animation showing a WhatsApp message being
      received, processed by the System Prompt, and answered by the agent.
      1080×1920 (9:16) — optimised for Instagram/TikTok/Reels.
    */}
    <Composition
      id="WhatsAppFlow"
      component={WhatsAppFlow}
      durationInFrames={450} // 15s @ 30fps
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        agentName: "Camille",
        agentEmoji: "✨",
        businessName: "La Belle Époque",
        incomingMessage: "Bonjour ! Avez-vous ce sac en rouge ?",
        agentReply:
          "Bonjour 👋 Oui absolument ! Notre sac Camille est disponible en rouge carmin. Souhaitez-vous que je vous envoie une fiche produit ?",
        brandColor: "#D4AF37",
      }}
    />

    {/*
      AgentBrandReveal — 8-second logo reveal for brand collateral.
      1920×1080 (16:9) — for landing page hero or YouTube.
    */}
    <Composition
      id="AgentBrandReveal"
      component={AgentBrandReveal}
      durationInFrames={240} // 8s @ 30fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        agentName: "Camille",
        tagline: "Agents IA No-Code · by Buyticle",
        brandColor: "#D4AF37",
      }}
    />
  </>
);
