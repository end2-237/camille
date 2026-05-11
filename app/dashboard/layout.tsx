// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/layout.tsx — Camille by Buyticle
// Sidebar rétractable + Topbar avec recherche, notifs, raccourcis
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef }    from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Bot, Plus, LogOut, ChevronLeft,
  Search, Bell, Settings, Moon, Sun, HelpCircle,
  Command, LayoutDashboard, ExternalLink,
} from "lucide-react";
import { useLocalAuth }   from "@/hooks/useLocalAuth";
import { useLocalAgents } from "@/hooks/useLocalAgents";
import { ThemeToggle }    from "@/components/ui/ThemeToggle";
import { cn }             from "@/lib/utils";

const SIDEBAR_W   = 224;
const SIDEBAR_COL = 56;
const TOPBAR_H    = 52;

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname         = usePathname();
  const router           = useRouter();
  const { user, logout } = useLocalAuth();
  const { agents }       = useLocalAgents();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const statusColor = (s: string) =>
    s === "active" ? "#34D399" : s === "paused" ? "#FBBF24" : "rgba(255,255,255,0.12)";

  return (
    <motion.aside
      animate={{ width: collapsed ? SIDEBAR_COL : SIDEBAR_W }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed left-0 top-0 bottom-0 flex flex-col z-40 select-none overflow-hidden"
      style={{ background: "var(--bg-elevated)", borderRight: "1px solid var(--border-subtle)" }}
    >
      {/* ── Logo row ── */}
      <div
        className="flex items-center flex-shrink-0 px-3 gap-2"
        style={{ height: TOPBAR_H, borderBottom: "1px solid var(--border-subtle)" }}
      >
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0" aria-label="Retour à l'accueil">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-shadow duration-200 group-hover:shadow-[0_0_12px_rgba(212,175,55,0.3)]"
            style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.22)" }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                className="font-good-timing text-sm font-bold whitespace-nowrap overflow-hidden text-gold-gradient"
              >
                Camille
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="ml-auto w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-150"
          style={{ color: "var(--text-disabled)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-glass)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-disabled)";
          }}
          title={collapsed ? "Agrandir la sidebar" : "Réduire la sidebar"}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </motion.div>
        </button>
      </div>

      {/* ── New agent CTA ── */}
      <div className="px-2.5 pt-3 pb-2 flex-shrink-0">
        <button
          onClick={() => router.push("/configure")}
          className="w-full flex items-center gap-2 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
          style={{
            background: "rgba(212,175,55,0.08)",
            color: "var(--color-gold)",
            border: "1px solid rgba(212,175,55,0.18)",
            padding: collapsed ? "8px 0" : "8px 10px",
            justifyContent: collapsed ? "center" : undefined,
          }}
          title={collapsed ? "Nouvel agent" : undefined}
        >
          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Nouvel agent
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2.5 py-1 overflow-y-auto overflow-x-hidden space-y-0.5">
        <NavItem
          href="/dashboard"
          label="Tableau de bord"
          icon={<LayoutDashboard className="w-3.5 h-3.5" />}
          active={pathname === "/dashboard"}
          collapsed={collapsed}
          badge={undefined}
        />
        <NavItem
          href="/dashboard"
          label="Mes agents"
          icon={<Bot className="w-3.5 h-3.5" />}
          active={false}
          collapsed={collapsed}
          badge={mounted ? agents.length : undefined}
        />

        {/* Per-agent list */}
        {mounted && agents.length > 0 && (
          <div className="pt-3">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] whitespace-nowrap"
                  style={{ color: "var(--text-disabled)" }}
                >
                  Agents actifs
                </motion.p>
              )}
            </AnimatePresence>

            {agents.map((agent) => {
              const isActive = pathname === `/dashboard/${agent.id}`;
              return (
                <Link
                  key={agent.id}
                  href={`/dashboard/${agent.id}`}
                  title={collapsed ? agent.identity.name : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg text-xs transition-all duration-150 mb-0.5",
                    isActive
                      ? "bg-[var(--surface-glass)]"
                      : "hover:bg-[rgba(255,255,255,0.03)]"
                  )}
                  style={{
                    border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    padding: collapsed ? "6px 0" : "6px 8px",
                    justifyContent: collapsed ? "center" : undefined,
                    color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
                    >
                      {agent.identity.avatar_emoji ?? agent.identity.name?.[0] ?? "A"}
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border"
                      style={{
                        background: statusColor(agent.status),
                        borderColor: "var(--bg-elevated)",
                      }}
                    />
                  </div>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex-1 font-medium truncate whitespace-nowrap overflow-hidden"
                      >
                        {agent.identity.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* ── User footer ── */}
      <div className="px-2.5 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div
          className="flex items-center gap-2"
          style={{ padding: collapsed ? "4px 0" : "4px 6px", justifyContent: collapsed ? "center" : undefined }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{
              background: "rgba(212,175,55,0.15)",
              color: "var(--color-gold)",
              border: "1px solid rgba(212,175,55,0.22)",
            }}
            title={collapsed && mounted ? (user?.name ?? "Utilisateur") : undefined}
          >
            {mounted ? (user?.name?.[0]?.toUpperCase() ?? "?") : "?"}
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-xs font-semibold truncate whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  {mounted ? (user?.name ?? "Utilisateur") : "Utilisateur"}
                </p>
                <p className="text-[10px] truncate whitespace-nowrap" style={{ color: "var(--text-disabled)" }}>
                  {mounted ? user?.email : ""}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!collapsed && (
            <button
              onClick={logout}
              title="Se déconnecter"
              className="p-1.5 rounded-lg transition-colors duration-150 hover:bg-[var(--surface-glass)] flex-shrink-0"
              style={{ color: "var(--text-disabled)" }}
            >
              <LogOut className="w-3 h-3" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center mt-1.5">
            <button
              onClick={logout}
              title="Se déconnecter"
              className="p-1.5 rounded-lg transition-colors duration-150 hover:bg-[var(--surface-glass)]"
              style={{ color: "var(--text-disabled)" }}
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  href, label, icon, active, collapsed, badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg text-xs transition-all duration-150",
        active
          ? "bg-[var(--surface-glass)]"
          : "hover:bg-[rgba(255,255,255,0.03)]"
      )}
      style={{
        border: active ? "1px solid var(--border-subtle)" : "1px solid transparent",
        padding: collapsed ? "7px 0" : "7px 10px",
        justifyContent: collapsed ? "center" : undefined,
        color: active ? "var(--text-primary)" : "var(--text-tertiary)",
      }}
    >
      <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 font-medium truncate whitespace-nowrap overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && badge !== undefined && badge > 0 && (
        <span
          className="text-[10px] tabular-nums px-1.5 py-px rounded-md font-bold flex-shrink-0"
          style={{ background: "rgba(212,175,55,0.12)", color: "var(--color-gold)" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

function Topbar({ sidebarW }: { sidebarW: number }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { agents } = useLocalAgents();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery]     = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
        setTimeout(() => searchRef.current?.focus(), 80);
      }
      if (e.key === "Escape") { setSearchOpen(false); setNotifOpen(false); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Page label from pathname
  const pageLabel = (() => {
    if (pathname === "/dashboard") return "Tableau de bord";
    const match = agents.find((a) => pathname.includes(a.id));
    if (match) return match.identity.name;
    return "Dashboard";
  })();

  const NOTIFS = [
    { id: 1, text: "Camille a traité 142 messages aujourd'hui", time: "Il y a 5 min", dot: "#34D399" },
    { id: 2, text: "Votre plan Pro se renouvelle dans 7 jours", time: "Il y a 2h",    dot: "#FBBF24" },
    { id: 3, text: "Nouveau modèle Claude 3.7 disponible",      time: "Hier",         dot: "var(--color-gold)" },
  ];

  const filtered = query.trim()
    ? agents.filter((a) => a.identity.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <motion.header
      animate={{ left: sidebarW }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed top-0 right-0 z-30 flex items-center gap-3 px-5"
      style={{
        height: TOPBAR_H,
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border-subtle)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--text-disabled)" }}>
          Dashboard
        </span>
        {pathname !== "/dashboard" && (
          <>
            <span style={{ color: "var(--text-disabled)" }}>/</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-secondary)" }}>
              {pageLabel}
            </span>
          </>
        )}
      </div>

      {/* ── Search bar ── */}
      <div className="flex-1 max-w-sm relative">
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 60); }}
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-all duration-150"
          style={{
            background: searchOpen ? "var(--bg-muted)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${searchOpen ? "rgba(212,175,55,0.3)" : "var(--border-subtle)"}`,
            color: "var(--text-disabled)",
          }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          {searchOpen ? (
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un agent…"
              className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: "var(--text-primary)" }}
              onBlur={() => { setTimeout(() => { setSearchOpen(false); setQuery(""); }, 150); }}
            />
          ) : (
            <span className="flex-1 text-left">Rechercher…</span>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={{ background: "var(--bg-muted)", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        {/* Search results dropdown */}
        <AnimatePresence>
          {searchOpen && query.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="absolute top-full mt-2 w-full rounded-xl overflow-hidden"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "0 16px 40px rgba(0,0,0,0.4)" }}
            >
              {filtered.length > 0 ? filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { router.push(`/dashboard/${a.id}`); setSearchOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors hover:bg-[var(--surface-glass)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Bot className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
                  {a.identity.name}
                </button>
              )) : (
                <p className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text-disabled)" }}>
                  Aucun résultat pour « {query} »
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right actions ── */}
      <div className="ml-auto flex items-center gap-1 flex-shrink-0">

        {/* Raccourci : nouvel agent */}
        <button
          onClick={() => router.push("/configure")}
          title="Créer un agent"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-110"
          style={{
            background: "rgba(212,175,55,0.08)",
            color: "var(--color-gold)",
            border: "1px solid rgba(212,175,55,0.18)",
          }}
        >
          <Plus className="w-3 h-3" />
          Nouvel agent
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            onBlur={() => setTimeout(() => setNotifOpen(false), 180)}
            title="Notifications"
            className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: "var(--text-disabled)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-glass)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}
          >
            <Bell className="w-4 h-4" />
            {/* Unread dot */}
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--color-gold)" }} />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "0 16px 40px rgba(0,0,0,0.45)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(212,175,55,0.12)", color: "var(--color-gold)" }}>
                    {NOTIFS.length}
                  </span>
                </div>
                {NOTIFS.map((n, i) => (
                  <div key={n.id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-glass)]"
                    style={{ borderBottom: i < NOTIFS.length - 1 ? "1px solid var(--border-subtle)" : undefined }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: n.dot }} />
                    <div className="min-w-0">
                      <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>{n.text}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-disabled)" }}>{n.time}</p>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5">
                  <button className="w-full text-xs text-center transition-colors hover:opacity-70"
                    style={{ color: "var(--text-disabled)" }}>
                    Tout marquer comme lu
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Help */}
        <button
          title="Aide"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{ color: "var(--text-disabled)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-glass)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}
          onClick={() => window.open("/contact", "_blank")}
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Site link */}
        <Link
          href="/"
          title="Retour au site"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{ color: "var(--text-disabled)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-glass)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.header>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarW = collapsed ? SIDEBAR_COL : SIDEBAR_W;

  return (
    <div className="flex min-h-dvh" style={{ background: "var(--bg-base)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Topbar sidebarW={sidebarW} />

      {/* Main content: offset by sidebar + topbar */}
      <motion.div
        animate={{ marginLeft: sidebarW }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="flex-1 min-w-0"
        style={{ paddingTop: TOPBAR_H }}
      >
        {children}
      </motion.div>
    </div>
  );
}
