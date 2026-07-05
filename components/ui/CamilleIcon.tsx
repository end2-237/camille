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
        borderRadius: size === "sm" ? 7 : 8,
        background: "#16141A",
        border: "1px solid rgba(124,90,248,0.45)",
        boxShadow: "0 0 12px rgba(124,90,248,0.10)",
      }}
    >
      <span
        style={{
          fontFamily: "Blackout",
          fontSize: font,
          color: "#8E6BFA",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        C
      </span>
    </div>
  );
}
