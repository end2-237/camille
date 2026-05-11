import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Midnight Gold Palette ──────────────────────────────────────
      colors: {
        midnight: {
          DEFAULT: "#09090E",
          950: "#05050A",
          900: "#09090E",
          800: "#0E0E15",
          700: "#131319",
          600: "#17171E",
          500: "#1D1D25",
        },
        gold: {
          DEFAULT: "#D4AF37",
          50:  "#FDF8E7",
          100: "#F7EDB8",
          200: "#EDD96A",
          300: "#D4AF37",
          400: "#C4961E",
          500: "#A8881A",
          600: "#9A7B18",
          700: "#7A6012",
          800: "#5A460D",
          900: "#3A2D08",
        },
        surface: {
          DEFAULT: "rgba(255,255,255,0.035)",
          hover:   "rgba(255,255,255,0.065)",
          active:  "rgba(212,175,55,0.08)",
        },
      },

      // ── Typography ────────────────────────────────────────────────
      fontFamily: {
        // UI principale — Inter Variable (@fontsource-variable, local, zéro réseau)
        sans: ["Inter Variable", "Inter", "Helvetica Neue", "Arial", "sans-serif"],
        // Branding courts ≤ 6 lettres (hero, marketing)
        cube: ["Cube", "-apple-system", "system-ui", "sans-serif"],
        // Branding longs + logo (hero, marketing)
        "good-timing": ["GoodTiming", "-apple-system", "system-ui", "sans-serif"],
        mono: [
          "Cascadia Code", "Fira Code", "Consolas",
          "Courier New", "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },

      // ── Spacing & Grid ────────────────────────────────────────────
      spacing: {
        "4.5": "1.125rem",
        "13":  "3.25rem",
        "18":  "4.5rem",
        "22":  "5.5rem",
        "30":  "7.5rem",
      },
      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },

      // ── Borders ───────────────────────────────────────────────────
      borderWidth: { "0.5": "0.5px" },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },

      // ── Shadows ───────────────────────────────────────────────────
      boxShadow: {
        gold:     "0 0 0 1px rgba(212,175,55,0.22), 0 4px 20px rgba(212,175,55,0.08)",
        "gold-lg":"0 0 0 1px rgba(212,175,55,0.32), 0 8px 32px rgba(212,175,55,0.14)",
        glass:    "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.50)",
        "glass-sm":"0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.40)",
      },

      // ── Blur / Glassmorphism ──────────────────────────────────────
      backdropBlur: {
        xs: "2px",
        "4xl": "64px",
      },

      // ── Gradients ─────────────────────────────────────────────────
      backgroundImage: {
        "gold-gradient":   "linear-gradient(135deg, #D4AF37 0%, #EDD96A 48%, #A8881A 100%)",
        "gold-shimmer":    "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.14) 50%, transparent 100%)",
        "surface-gradient":"linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
        "radial-gold":     "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 70%)",
        "radial-midnight": "radial-gradient(ellipse 100% 60% at 50% 100%, rgba(212,175,55,0.05) 0%, transparent 80%)",
        "noise":           "url('/noise.svg')",
      },

      // ── Animations ────────────────────────────────────────────────
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(212,175,55,0.3)" },
          "50%":      { boxShadow: "0 0 24px rgba(212,175,55,0.6)" },
        },
      },
      animation: {
        shimmer:  "shimmer 2.4s linear infinite",
        "fade-up":"fade-up 0.5s ease-out forwards",
        "fade-in":"fade-in 0.4s ease-out forwards",
        glow:     "glow 2s ease-in-out infinite",
      },

      // ── Transitions ───────────────────────────────────────────────
      transitionTimingFunction: {
        "premium":  "cubic-bezier(0.22, 1, 0.36, 1)",
        "snap":     "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "450": "450ms",
      },
    },
  },
  plugins: [],
};

export default config;
