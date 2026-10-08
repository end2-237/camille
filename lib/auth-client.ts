"use client";

const TOKEN_KEY = "camille_token";
const USER_KEY  = "camille_user";
// « Se souvenir de moi » décoché : la session tient tant que le navigateur est
// ouvert. Le jeton reste dans localStorage (partagé entre onglets), mais une
// marque en sessionStorage — effacée à la fermeture — dit s'il est encore valable.
const EPHEMERE_KEY = "camille_ephemere";
const VIVANT_KEY   = "camille_session_vivante";

/** À appeler juste après la connexion. */
export function retenirConnexion(retenir: boolean) {
  try {
    if (retenir) {
      localStorage.removeItem(EPHEMERE_KEY);
    } else {
      localStorage.setItem(EPHEMERE_KEY, "1");
      sessionStorage.setItem(VIVANT_KEY, "1");
    }
  } catch { /* stockage bloqué : la session reste comme avant */ }
}

/** Session « sans souvenir » dont le navigateur a été fermé depuis. */
function sessionExpiree(): boolean {
  try {
    return localStorage.getItem(EPHEMERE_KEY) === "1" && !sessionStorage.getItem(VIVANT_KEY);
  } catch {
    return false;
  }
}

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
  if (sessionExpiree()) { clearAuth(); return null; }
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  if (sessionExpiree()) { clearAuth(); return null; }
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
  localStorage.removeItem(EPHEMERE_KEY);
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
