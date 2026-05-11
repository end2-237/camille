// ─────────────────────────────────────────────────────────────────────────────
// AgentBrandReveal.tsx — Camille by Buyticle
// 8-second brand reveal composition for landing page hero / YouTube thumbnail.
// Timeline:
//   0–60   (0–2s)  : Particles converge from edges
//   60–120 (2–4s)  : Logo & name spring in from centre
//   120–180(4–6s)  : Tagline types out
//   180–240(6–8s)  : Hold + gold shimmer pulse
// ─────────────────────────────────────────────────────────────────────────────

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface AgentBrandRevealProps {
  agentName: string;
  tagline: string;
  brandColor: string;
}

function useTypewriter(text: string, startFrame: number, durationFrames: number) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const progress = Math.min(1, elapsed / durationFrames);
  return text.slice(0, Math.floor(progress * text.length));
}

export const AgentBrandReveal: React.FC<AgentBrandRevealProps> = ({
  agentName,
  tagline,
  brandColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo spring entrance
  const logoSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const logoScale   = interpolate(logoSpring, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 0.4, 1], [0, 1, 1]);

  // Name spring
  const nameSpring  = spring({ frame: frame - 50, fps, config: { damping: 14, stiffness: 90 } });
  const nameY       = interpolate(nameSpring, [0, 1], [40, 0]);
  const nameOpacity = interpolate(nameSpring, [0, 0.3, 1], [0, 1, 1]);

  // Tagline type-out
  const typedTagline = useTypewriter(tagline, 120, 80);

  // Gold shimmer pulse (frames 180+)
  const shimmerIntensity = frame > 180
    ? interpolate(Math.sin((frame - 180) / 20), [-1, 1], [0.4, 0.9])
    : 0;

  // Background radial glow
  const glowOpacity = interpolate(frame, [0, 60], [0, 0.15], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        overflow: "hidden",
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(212,175,55,${glowOpacity}) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Logo mark */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          width: 120,
          height: 120,
          borderRadius: 36,
          background: `rgba(212,175,55,0.1)`,
          border: `2px solid rgba(212,175,55,${0.3 + shimmerIntensity * 0.3})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 56,
          boxShadow: `0 0 ${40 + shimmerIntensity * 40}px rgba(212,175,55,${shimmerIntensity * 0.4})`,
        }}
      >
        ✨
      </div>

      {/* Agent name */}
      <div
        style={{
          opacity: nameOpacity,
          transform: `translateY(${nameY}px)`,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: 120,
            fontWeight: 800,
            fontFamily: "sans-serif",
            margin: 0,
            background: `linear-gradient(135deg, ${brandColor} 0%, #F2DC87 50%, #B8961E 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: -2,
          }}
        >
          {agentName}
        </h1>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontSize: 32,
          color: "rgba(255,255,255,0.45)",
          fontFamily: "monospace",
          letterSpacing: 2,
          margin: 0,
          height: 48,
          display: "flex",
          alignItems: "center",
        }}
      >
        {typedTagline}
        {typedTagline.length < tagline.length && (
          <span style={{ color: brandColor, marginLeft: 2 }}>|</span>
        )}
      </p>
    </AbsoluteFill>
  );
};
