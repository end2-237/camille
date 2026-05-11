// ─────────────────────────────────────────────────────────────────────────────
// lib/local/auth.ts — Camille by Buyticle
// Authentification locale (localStorage). Remplace Supabase Auth en dev.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = "camille-session";

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// ── Lecture ───────────────────────────────────────────────────────────────────

export function getLocalUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalUser) : null;
  } catch {
    return null;
  }
}

// ── Connexion ─────────────────────────────────────────────────────────────────

export function signInLocal(email: string, name?: string): LocalUser {
  const existing = getLocalUser();
  // Réutilise le compte si même email
  if (existing && existing.email === email) return existing;

  const user: LocalUser = {
    id:        `user-${Date.now()}`,
    email,
    name:      name?.trim() || email.split("@")[0],
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

// ── Déconnexion ───────────────────────────────────────────────────────────────

export function signOutLocal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

// ── Guard ─────────────────────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
  return getLocalUser() !== null;
}
