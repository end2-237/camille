"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le journal complet des notifications, équivalent web de l'écran du mobile.
//
// La cloche n'en montre que les vingt dernières : quand un agent est resté
// déconnecté une nuit entière, ce qui compte est justement ce qui a défilé
// pendant qu'on ne regardait pas.
// ─────────────────────────────────────────────────────────────────────────────
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCheck } from "lucide-react";
import { useNotifications, notifHref, whenLabel, type Notif } from "@/hooks/useNotifications";
import { kindOf } from "@/components/ui/NotificationBell";

export default function NotificationsPage() {
  const router = useRouter();
  const { list, unread, error, loading, reload, markRead, markAllRead } = useNotifications(100);

  function activate(n: Notif) {
    if (!n.read_at) markRead(n.id);
    const href = notifHref(n);
    if (href) router.push(href);
  }

  const items = list ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>
            Notifications
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} disabled={loading} className="btn-ghost disabled:opacity-60">
            <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
            Actualiser
          </button>
          {unread > 0 && (
            <button onClick={markAllRead} className="btn-gold">
              <CheckCheck className="h-3.5 w-3.5" /> Tout lire
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg px-3.5 py-2.5 text-[12px]"
          style={{ background: "rgba(192,57,43,0.08)", color: "#c0392b", border: "1px solid rgba(192,57,43,0.2)" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        {!list ? (
          <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-disabled)" }}>Chargement…</p>
        ) : !items.length && !error ? (
          <p className="py-10 text-center text-[13px] leading-relaxed" style={{ color: "var(--text-disabled)" }}>
            Aucune notification pour l&apos;instant.<br />
            Les commandes reçues et les alertes de tes agents apparaîtront ici.
          </p>
        ) : items.map((n) => {
          const k = kindOf(n.kind);
          const isNew = !n.read_at;
          const href = notifHref(n);
          return (
            <button
              key={n.id}
              onClick={() => activate(n)}
              className="flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition-all hover:brightness-[1.02]"
              style={{
                border: `1px solid ${isNew ? "var(--color-gold)" : "var(--border-default)"}`,
                background: isNew ? "var(--surface-gold)" : "var(--bg-elevated)",
                cursor: href ? "pointer" : "default",
              }}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: k.bg }}>
                <k.Icon className="h-4 w-4" style={{ color: k.fg }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-2">
                  <span className={"flex-1 text-[13.5px] leading-snug " + (isNew ? "font-semibold" : "font-medium")}
                    style={{ color: "var(--text-primary)" }}>
                    {n.title}
                  </span>
                  {isNew && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--color-gold)" }} />}
                </span>
                {n.body ? (
                  <span className="mt-1 block text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                    {n.body}
                  </span>
                ) : null}
                <span className="mt-1.5 block text-[11px]" style={{ color: "var(--text-disabled)" }}>
                  {k.label} · {whenLabel(n.created_at)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
