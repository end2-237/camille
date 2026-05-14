"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredUser,
  storeAuth,
  clearAuth,
  apiLogin,
  apiRegister,
  apiLogout,
  type AuthUser,
} from "@/lib/auth-client";

interface UseAuthReturn {
  user: AuthUser | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, full_name?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    return getStoredUser();
  });

  const router = useRouter();

  const login = useCallback(async (email: string, password: string) => {
    const { user, token } = await apiLogin(email, password);
    storeAuth(user, token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (email: string, password: string, full_name?: string) => {
    const { user, token } = await apiRegister(email, password, full_name);
    storeAuth(user, token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearAuth();
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, isLoggedIn: !!user, login, register, logout };
}
