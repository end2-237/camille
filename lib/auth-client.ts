"use client";

const TOKEN_KEY = "camille_token";
const USER_KEY  = "camille_user";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  /** Accès à la console d'exploitation. */
  is_admin?: boolean;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeAuth(user: AuthUser, token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Connexion échouée");
  return data as { user: AuthUser; token: string };
}

export async function apiRegister(email: string, password: string, full_name?: string) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Inscription échouée");
  return data as { user: AuthUser; token: string };
}

export async function apiLogout() {
  const token = getStoredToken();
  if (!token) return;
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
