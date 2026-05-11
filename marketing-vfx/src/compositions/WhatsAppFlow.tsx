// ─────────────────────────────────────────────────────────────────────────────
// WhatsAppFlow.tsx — Camille by Buyticle
// 15-second Remotion animation showing a WhatsApp message being received,
// routed through the System Prompt, and answered by the agent.
//
// Timeline (@ 30fps):
//   0–60    (0–2s)   : Black screen → Camille logo fade-in
//   60–120  (2–4s)   : Incoming WhatsApp message bubble slides in
//   120–180 (4–6s)   : "System Prompt" chip appears + processes
//   180–300 (6–10s)  : Agent reply types out character by character
//   300–390 (10–13s) : Stats banner: "< 1s · 0 code · 100% brand-aligned"
//   390–450 (13–15s) : CTA fade-out
// ─────────────────────────────────────────────────────────────────────────────

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WhatsAppFlowProps {
  agentName: string;
  agentEmoji: string;
  businessName: string;
  incomingMessage: string;
  agentReply: string;
  brandColor: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Animate a string so it types out over `durationFrames` frames */
function useTypewriter(text: string, startFrame: number, durationFrames: number) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const progress = Math.min(1, elapsed / durationFrames);
  const charCount = Math.floor(progress * text.length);
  return text.slice(0, charCount);
}

/** Spring-based slide-in from bottom */
function useSlideIn(
  startFrame: number,
  config = { damping: 14, stiffness: 120 }
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - startFrame, fps, config });
  const y = interpolate(s, [0, 1], [60, 0]);
  const opacity = interpolate(s, [0, 0.3, 1], [0, 1, 1]);
  return { y, opacity };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Logo({ color }: { color: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 40], [0.85, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        position: "absolute",
        top: 80,
        left: "50%",
        transform: `scale(${scale}) translateX(-50%)`,
        transformOrigin: "top center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: `rgba(212,175,55,0.12)`,
          border: `1.5px solid rgba(212,175,55,0.4)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
        }}
      >
        ✨
      </div>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 36,
            fontWeight: 700,
            color,
            fontFamily: "sans-serif",
            margin: 0,
          }}
        >
          Camille
        </p>
        <p
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "sans-serif",
            margin: 0,
          }}
        >
          by Buyticle
        </p>
      </div>
    </div>
  );
}

function IncomingBubble({
  message,
  startFrame,
}: {
  message: string;
  startFrame: number;
}) {
  const { y, opacity } = useSlideIn(startFrame);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        justifyContent: "flex-end",
        padding: "0 48px",
        marginTop: 16,
      }}
    >
      <div
        style={{
          background: "rgba(37,211,102,0.15)",
          border: "1px solid rgba(37,211,102,0.3)",
          borderRadius: "20px 20px 4px 20px",
          padding: "16px 20px",
          maxWidth: 520,
          fontSize: 28,
          color: "rgba(255,255,255,0.85)",
          fontFamily: "sans-serif",
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
    </div>
  );
}

function SystemPromptChip({ startFrame }: { startFrame: number }) {
  const { y, opacity } = useSlideIn(startFrame, { damping: 18, stiffness: 100 });
  const frame = useCurrentFrame();
  const dotOpacity = interpolate(
    (frame % 30) / 30,
    [0, 0.5, 1],
    [0.3, 1, 0.3]
  );

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        justifyContent: "center",
        padding: "0 48px",
        marginTop: 32,
      }}
    >
      <div
        style={{
          background: "rgba(212,175,55,0.10)",
          border: "1px solid rgba(212,175,55,0.35)",
          borderRadius: 50,
          padding: "12px 28px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#D4AF37",
            opacity: dotOpacity,
          }}
        />
        <span
          style={{
            fontSize: 22,
            color: "#D4AF37",
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >
          System Prompt · Processing…
        </span>
      </div>
    </div>
  );
}

function AgentReplyBubble({
  agentName,
  agentEmoji,
  replyText,
  startFrame,
  brandColor,
}: {
  agentName: string;
  agentEmoji: string;
  replyText: string;
  startFrame: number;
  brandColor: string;
}) {
  const { y, opacity } = useSlideIn(startFrame);
  const typed = useTypewriter(replyText, startFrame + 10, 120);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        justifyContent: "flex-start",
        padding: "0 48px",
        marginTop: 24,
        gap: 16,
        alignItems: "flex-end",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: `rgba(212,175,55,0.12)`,
          border: `1.5px solid rgba(212,175,55,0.3)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          flexShrink: 0,
        }}
      >
        {agentEmoji}
      </div>

      <div>
        <p
          style={{
            fontSize: 18,
            color: brandColor,
            fontFamily: "sans-serif",
            margin: "0 0 6px 4px",
            fontWeight: 600,
          }}
        >
          {agentName}
        </p>
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: "4px 20px 20px 20px",
            padding: "16px 20px",
            maxWidth: 560,
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
            fontFamily: "sans-serif",
            lineHeight: 1.5,
            minHeight: 70,
          }}
        >
          {typed}
          {typed.length < replyText.length && (
            <span style={{ opacity: 0.4, animation: "blink 1s infinite" }}>▌</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsBanner({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const stats = [
    { value: "< 1s", label: "Temps de réponse" },
    { value: "0",    label: "Ligne de code" },
    { value: "100%", label: "Brand-aligned" },
  ];

  return (
    <div
      style={{
        opacity,
        display: "flex",
        justifyContent: "center",
        gap: 32,
        padding: "0 48px",
        marginTop: 48,
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            textAlign: "center",
            background: "rgba(212,175,55,0.06)",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: 20,
            padding: "24px 32px",
            minWidth: 200,
          }}
        >
          <p
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#D4AF37",
              fontFamily: "sans-serif",
              margin: 0,
            }}
          >
            {s.value}
          </p>
          <p
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.45)",
              fontFamily: "sans-serif",
              margin: "8px 0 0",
            }}
          >
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main composition ──────────────────────────────────────────────────────────

export const WhatsAppFlow: React.FC<WhatsAppFlowProps> = ({
  agentName,
  agentEmoji,
  incomingMessage,
  agentReply,
  brandColor,
}) => {
  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        flexDirection: "column",
        justifyContent: "flex-start",
        paddingTop: 180,
        overflow: "hidden",
      }}
    >
      {/* 0-60: Logo */}
      <Logo color={brandColor} />

      {/* 60-120: Incoming message */}
      <Sequence from={60}>
        <IncomingBubble message={incomingMessage} startFrame={0} />
      </Sequence>

      {/* 120-180: Processing chip */}
      <Sequence from={120} durationInFrames={90}>
        <SystemPromptChip startFrame={0} />
      </Sequence>

      {/* 180-360: Agent reply types out */}
      <Sequence from={180}>
        <AgentReplyBubble
          agentName={agentName}
          agentEmoji={agentEmoji}
          replyText={agentReply}
          startFrame={0}
          brandColor={brandColor}
        />
      </Sequence>

      {/* 300-390: Stats */}
      <Sequence from={300}>
        <StatsBanner startFrame={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
