import { cn } from "@/lib/utils";

interface CamilleIconProps {
  size?: "sm" | "md";
  className?: string;
}

export function CamilleIcon({ size = "md", className }: CamilleIconProps) {
  const dim  = size === "sm" ? 28 : 32;
  const font = size === "sm" ? 18 : 20;

  return (
    <div
      className={cn("flex-shrink-0 flex items-center justify-center", className)}
      style={{
        width: dim,
        height: dim,
        borderRadius: size === "sm" ? 8 : 10,
        background: "#0a0a00",
        border: "1px solid rgba(212,175,55,0.45)",
        boxShadow: "0 0 12px rgba(212,175,55,0.08)",
      }}
    >
      <span
        style={{
          fontFamily: "Blackout",
          fontSize: font,
          color: "#D4AF37",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        C
      </span>
    </div>
  );
}
