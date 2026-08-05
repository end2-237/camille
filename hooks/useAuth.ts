"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredUser,
  getStoredToken,
  authHeaders,
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

/**
 * Une seule requête par chargement de page, quel que soit le nombre de
 * composants qui appellent useAuth.
 *
 * La barre latérale et la barre du haut l'appellent toutes les deux ; sans ce
 * partage, chaque rendu de page déclencherait autant d'appels à /api/auth/me
 * qu'il y a d'appelants, pour un résultat identique.
 */
let ficheEnCours: Promise<AuthUser | null> | null = null;

function chargerFiche(): Promise<AuthUser | null> {
  if (!ficheEnCours) {
    ficheEnCours = fetch("/api/auth/me", { headers: { ...authHeaders() }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.user as AuthUser | undefined) ?? null)
      .catch(() => null);
  }
  return ficheEnCours;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    return getStoredUser();
  });

  const router = useRouter();

  // ── Rafraîchissement de la fiche utilisateur ────────────────────────────────
  //
  // L'utilisateur affiché venait uniquement du localStorage, écrit une fois à
  // la connexion. Un compte passé administrateur en base restait donc simple
  // vendeur dans son navigateur jusqu'à ce qu'il se déconnecte et se
  // reconnecte — et personne ne pense à faire ça, puisque rien n'indique
  // qu'il le faudrait. C'est ce qui rendait la console d'exploitation
  // introuvable pour son propre administrateur.
  //
  // On resynchronise donc au montage. Silencieux par construction : une
  // erreur réseau laisse simplement la version stockée en place.
  useEffect(() => {
    let vivant = true;
    chargerFiche()
      .then((frais) => {
        if (!vivant || !frais) return;
        setUser((precedent) => {
          // Ne réécrire que si quelque chose a bougé : un setState à chaque
          // montage relancerait les effets qui dépendent de `user`.
          if (precedent && JSON.stringify(precedent) === JSON.stringify(frais)) return precedent;
          const jeton = getStoredToken();
          if (jeton) storeAuth(frais, jeton);
          return frais;
        });
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // La fiche en cache appartient au compte précédent : la garder ferait
    // réapparaître l'ancien utilisateur au prochain montage.
    ficheEnCours = null;
    const { user, token } = await apiLogin(email, password);
    storeAuth(user, token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (email: string, password: string, full_name?: string) => {
    ficheEnCours = null;
    const { user, token } = await apiRegister(email, password, full_name);
    storeAuth(user, token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    ficheEnCours = null;
    await apiLogout();
    clearAuth();
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, isLoggedIn: !!user, login, register, logout };
}
