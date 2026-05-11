// ─────────────────────────────────────────────────────────────────────────────
// hooks/useLocalAuth.ts — Camille by Buyticle
// Auth locale synchrone : lit localStorage à l'initialisation du state,
// donc loading = false dès le premier rendu côté client.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useCallback } from "react";
import {
  getLocalUser,
  signInLocal,
  signOutLocal,
  type LocalUser,
} from "@/lib/local/auth";
import { useRouter } from "next/navigation";

interface UseLocalAuthReturn {
  user: LocalUser | null;
  isLoggedIn: boolean;
  login: (email: string, name?: string) => LocalUser;
  logout: () => void;
}

export function useLocalAuth(): UseLocalAuthReturn {
  // Initialisation SYNCHRONE depuis localStorage — zéro état "loading"
  const [user, setUser] = useState<LocalUser | null>(() => {
    if (typeof window === "undefined") return null; // SSR guard
    return getLocalUser();
  });

  const router = useRouter();

  const login = useCallback((email: string, name?: string): LocalUser => {
    const u = signInLocal(email, name);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    signOutLocal();
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, isLoggedIn: !!user, login, logout };
}
