"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Journal de notifications du compte, côté web.
//
// Toutes les alertes du produit — commande reçue, agent déconnecté, quota de
// tokens, fin d'abonnement — passent par lib/fcm.notifyUser, qui les écrit
// dans camille.notifications AVANT de tenter le push. Le téléphone recevait
// donc tout ; le navigateur, lui, affichait une liste écrite en dur. Ce hook
// est le chaînon manquant : les mêmes notifications, à la même source.
//
// Le push navigateur n'est pas nécessaire ici : le compteur se rafraîchit
// tout seul, et au retour sur l'onglet.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/lib/auth-client";

export interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}

/** Intervalle de rafraîchissement en arrière-plan. */
const POLL_MS = 60_000;

/**
 * Destination d'une notification, déduite de son champ `data.type` — le même
 * aiguillage que l'application mobile, vers les écrans web équivalents.
 * `null` quand rien de pertinent n'existe côté web : la notification reste
 * alors lisible, simplement pas cliquable.
 */
export function notifHref(n: Notif): string | null {
  const d = n.data ?? {};
  const agentId = String(d.agentId ?? "").trim();
  switch (String(d.type ?? "")) {
    case "order":                 return "/dashboard/orders";
    case "stock":                 return agentId ? `/dashboard/${agentId}/catalog` : null;
    case "quota":
    case "subscription":          return "/dashboard/billing";
    case "whatsapp_disconnected":
    case "whatsapp_connected":    return agentId ? `/dashboard/${agentId}/integrations` : null;
    default:                      return null;
  }
}

/** « il y a 5 min », « il y a 3 h », puis la date. Identique au mobile. */
export function whenLabel(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (!Number.isFinite(min)) return "";
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 60 * 24) return `il y a ${Math.floor(min / 60)} h`;
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function useNotifications(limit = 30) {
  const [list, setList] = useState<Notif[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Une requête lente ne doit pas écraser un état plus récent : sans ce garde,
  // un marquage optimiste pouvait être annulé par la réponse d'un chargement
  // parti avant lui.
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/notifications?limit=${limit}`, {
        headers: { ...authHeaders() },
        credentials: "include",
        cache: "no-store",
      });
      const d = await r.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!r.ok) {
        // 401 : la session a expiré, le layout s'en charge. Inutile d'inquiéter
        // l'utilisateur avec une erreur rouge dans la cloche.
        setError(r.status === 401 ? "" : (d.error ?? "Chargement impossible"));
        setList([]);
        setUnread(0);
        return;
      }
      setError(d.error ?? "");
      setList(Array.isArray(d.notifications) ? d.notifications : []);
      setUnread(Number(d.unread ?? 0));
    } catch {
      if (mine === seq.current) { setList((p) => p ?? []); }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  // Rafraîchissement périodique, suspendu quand l'onglet est caché : un
  // dashboard laissé ouvert toute la journée ne doit pas interroger le serveur
  // dans le vide.
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  /** Marque une notification comme lue. Optimiste : l'effet est immédiat. */
  const markRead = useCallback((id: string) => {
    let changed = false;
    setList((p) => (p ?? []).map((x) => {
      if (x.id !== id || x.read_at) return x;
      changed = true;
      return { ...x, read_at: new Date().toISOString() };
    }));
    setUnread((n) => (changed ? Math.max(0, n - 1) : n));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setList((p) => (p ?? []).map((x) => ({ ...x, read_at: x.read_at ?? now })));
    setUnread(0);
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }, []);

  return { list, unread, error, loading, reload: load, markRead, markAllRead };
}
