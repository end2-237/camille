"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Les notifications du tableau de bord, une seule fois pour toute la coquille :
// la cloche de l'en-tête (ordinateur), le bouton flottant (téléphone) et le
// son de caisse lisent la même source.
//
// Le son part dès qu'une NOUVELLE commande apparaît : tout de suite si le
// service worker relaie le push (application ouverte), sinon au
// rafraîchissement suivant. Une même commande ne sonne qu'une fois.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { jouerCaisse, preparerSon } from "@/lib/son";

type Valeur = ReturnType<typeof useNotifications>;
const Contexte = createContext<Valeur | null>(null);

export function useNotifsCoquille(): Valeur | null {
  return useContext(Contexte);
}

export function FournisseurNotifs({ children }: { children: React.ReactNode }) {
  const notifs = useNotifications(20);
  const { list, reload } = notifs;
  const vues = useRef<Set<string> | null>(null);
  const sonnees = useRef(new Set<string>());

  const sonner = (cle: string) => {
    if (!cle || sonnees.current.has(cle)) return;
    sonnees.current.add(cle);
    jouerCaisse();
  };

  useEffect(() => { preparerSon(); }, []);

  // Le push relayé par le service worker : instantané quand l'app est ouverte.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const recu = (e: MessageEvent) => {
      const d = e.data as { camille?: string; data?: Record<string, string> } | null;
      if (d?.camille !== "push") return;
      if (d.data?.type === "order") sonner(d.data.orderId || d.data.ref || String(Date.now()));
      reload();
    };
    navigator.serviceWorker.addEventListener("message", recu);
    return () => navigator.serviceWorker.removeEventListener("message", recu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  // Le rafraîchissement régulier : une commande apparue depuis la dernière
  // lecture sonne. La toute première lecture ne fait que mémoriser l'existant.
  useEffect(() => {
    if (!list) return;
    if (!vues.current) { vues.current = new Set(list.map((n) => n.id)); return; }
    for (const n of list) {
      if (vues.current.has(n.id)) continue;
      vues.current.add(n.id);
      if (!n.read_at && n.data?.type === "order") sonner(n.data.orderId || n.data.ref || n.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  return <Contexte.Provider value={notifs}>{children}</Contexte.Provider>;
}
