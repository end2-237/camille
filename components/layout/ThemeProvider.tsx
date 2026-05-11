// ─────────────────────────────────────────────────────────────────────────────
// components/layout/ThemeProvider.tsx — Camille by Buyticle
// ThemeProvider maison sans dépendance externe.
// Lit + écrit dans localStorage, injecte data-theme sur <html>.
// Le script anti-FOUC dans layout.tsx applique le thème avant React.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  const resolve = useCallback((t: Theme): "dark" | "light" => {
    if (t !== "system") return t;
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }, []);

  const apply = useCallback(
    (t: Theme) => {
      const r = resolve(t);
      document.documentElement.setAttribute("data-theme", r);
      setResolvedTheme(r);
    },
    [resolve]
  );

  useEffect(() => {
    const stored = (localStorage.getItem("camille-theme") as Theme) || "dark";
    setThemeState(stored);
    apply(stored);

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const current = (localStorage.getItem("camille-theme") as Theme) || "dark";
      if (current === "system") apply("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [apply]);

  const setTheme = useCallback(
    (t: Theme) => {
      localStorage.setItem("camille-theme", t);
      setThemeState(t);
      apply(t);
    },
    [apply]
  );

  // Rendu direct — plus de visibility:hidden qui cachait la page
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
