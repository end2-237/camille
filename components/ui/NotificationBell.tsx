"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La cloche du dashboard web.
//
// Elle affichait trois lignes écrites en dur — « Camille a traité 142 messages
// aujourd'hui », un plan qui se renouvelle, un modèle disponible — identiques
// pour tout le monde et pour toujours. Pendant ce temps les vraies alertes
// (agent déconnecté, commande reçue, abonnement fini) n'arrivaient que sur le
// téléphone. Elle lit désormais le même journal que l'application mobile.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Receipt, AlertTriangle, Info } from "lucide-react";
import { useNotifications, notifHref, whenLabel, type Notif } from "@/hooks/useNotifications";

/** Une couleur et une icône par type : reconnaître sans lire. */
const KIND = {
  commande: { Icon: Receipt,        fg: "#4A6B00", bg: "rgba(198,242,78,0.20)", label: "Commande" },
  alerte:   { Icon: AlertTriangle,  fg: "#8A5A00", bg: "rgba(251,191,36,0.18)", label: "Alerte"   },
  systeme:  { Icon: Info,           fg: "#2557A7", bg: "rgba(37,87,167,0.14)",  label: "Système"  },
} as const;

export const kindOf = (k: string) => KIND[k as keyof typeof KIND] ?? KIND.systeme;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { list, unread, error, markRead, markAllRead } = useNotifications(20);

  // Fermeture au clic extérieur : l'ancien `onBlur` du bouton se déclenchait
  // aussi quand on cliquait DANS le panneau, et il fallait un délai pour que
  // le clic ait le temps d'aboutir. Un écouteur sur le document règle les deux.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function activate(n: Notif) {
    if (!n.read_at) markRead(n.id);
    const href = notifHref(n);
    if (href) { setOpen(false); router.push(href); }
  }

  const items = list ?? [];

  return (
    <div className="relative" ref={wrap}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
        style={{ color: "var(--text-disabled)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}
      >
        <Bell className="w-4 h-4" />
        {/* La pastille était affichée en permanence : elle ne voulait plus rien
            dire. Elle ne paraît maintenant qu'avec des notifications non lues,
            et porte leur nombre au-delà d'une. */}
        {unread > 0 && (
          unread > 1 ? (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-bold leading-none"
              style={{ background: "var(--color-gold)", color: "#fff" }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-gold)" }} />
          )
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-2 w-[320px] max-w-[calc(100vw-24px)] rounded-xl overflow-hidden"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "0 16px 40px rgba(25,23,27,0.14)" }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(124,90,248,0.12)", color: "var(--color-gold)" }}>
                {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "à jour"}
              </span>
            </div>

            {error ? (
              <p className="px-4 py-3 text-[11px]" style={{ color: "#c0392b" }}>{error}</p>
            ) : null}

            <div className="max-h-[320px] overflow-y-auto">
              {!list ? (
                <p className="px-4 py-6 text-center text-[11.5px]" style={{ color: "var(--text-disabled)" }}>Chargement…</p>
              ) : !items.length ? (
                <p className="px-4 py-6 text-center text-[11.5px] leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                  Aucune notification pour l&apos;instant.<br />Les commandes et les alertes apparaîtront ici.
                </p>
              ) : items.map((n, i) => {
                const k = kindOf(n.kind);
                const isNew = !n.read_at;
                return (
                  <button
                    key={n.id}
                    onClick={() => activate(n)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-gold)]"
                    style={{
                      borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : undefined,
                      background: isNew ? "var(--surface-gold)" : undefined,
                    }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: k.bg }}>
                      <k.Icon className="w-3.5 h-3.5" style={{ color: k.fg }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-1.5">
                        <span className={"text-xs leading-snug flex-1 " + (isNew ? "font-semibold" : "font-medium")}
                          style={{ color: "var(--text-primary)" }}>
                          {n.title}
                        </span>
                        {isNew && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: "var(--color-gold)" }} />}
                      </span>
                      {n.body ? (
                        <span className="block text-[11px] leading-snug mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                          {n.body}
                        </span>
                      ) : null}
                      <span className="block text-[10px] mt-1" style={{ color: "var(--text-disabled)" }}>
                        {k.label} · {whenLabel(n.created_at)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => { setOpen(false); router.push("/dashboard/notifications"); }}
                className="text-xs transition-colors hover:opacity-70"
                style={{ color: "var(--color-gold)" }}
              >
                Tout voir
              </button>
              <button
                onClick={markAllRead}
                disabled={unread === 0}
                className="text-xs transition-colors hover:opacity-70 disabled:opacity-40 disabled:cursor-default"
                style={{ color: "var(--text-disabled)" }}
              >
                Tout marquer comme lu
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
