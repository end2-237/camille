"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Plus, LogOut, ChevronLeft, ChevronDown, Users, Wallet, Globe,
  Search, Bell, HelpCircle, Command, LayoutDashboard, ExternalLink, CreditCard, BarChart2, Menu, Package, Settings, Plug, Receipt, ShieldCheck, Activity, ImageIcon, TrendingUp, Building2, Bike } from "lucide-react";
import { authHeaders }  from "@/lib/auth-client";
import { useAuth }      from "@/hooks/useAuth";
import { useAgents }    from "@/hooks/useAgents";
import { ThemeToggle }  from "@/components/ui/ThemeToggle";
import { CamilleIcon }  from "@/components/ui/CamilleIcon";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { cn } from "@/lib/utils";

const SIDEBAR_W   = 224;
const SIDEBAR_COL = 56;
const TOPBAR_H    = 52;

function Sidebar({ collapsedProp, onToggle, isDesktop, mobileOpen, onCloseMobile }: {
  collapsedProp: boolean; onToggle: () => void;
  isDesktop: boolean; mobileOpen: boolean; onCloseMobile: () => void;
}) {
  const pathname             = usePathname();
  const router               = useRouter();
  const { user, logout }     = useAuth();
  const { agents }           = useAgents();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Sur mobile, le drawer est toujours déployé (labels visibles) ; la réduction
  // ne concerne que le desktop.
  const collapsed = isDesktop ? collapsedProp : false;

  // Ferme le drawer dès qu'on navigue (mobile)
  useEffect(() => { if (!isDesktop) onCloseMobile(); /* eslint-disable-next-line */ }, [pathname]);

  const displayName = user?.full_name ?? user?.email ?? "Utilisateur";

  // L'agent affiché : celui de l'URL, sinon le premier du compte.
  const activeAgentId = pathname.match(/\/dashboard\/([0-9a-fA-F-]{8,})/)?.[1] || agents[0]?.id;

  // « Gestion du site » n'a de sens que pour un agent dont le site est branché.
  // Une clé d'API vivante est le signe le plus sûr : c'est elle qui fait
  // exister l'intégration.
  const [hasSite, setHasSite] = useState(false);
  useEffect(() => {
    if (!activeAgentId) { setHasSite(false); return; }
    let alive = true;
    fetch(`/api/agents/${activeAgentId}/api-keys`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setHasSite(Array.isArray(d.keys) && d.keys.some((k: { revoked_at?: string | null }) => !k.revoked_at));
      })
      .catch(() => { if (alive) setHasSite(false); });
    return () => { alive = false; };
  }, [activeAgentId]);

  // L'espace livreur : un compte rattaché à une boutique doit le trouver sans
  // qu'on lui donne une adresse à taper. Le badge dit combien de courses
  // attendent — c'est ce qui fait revenir sur la page.
  const [courses, setCourses] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/courier/orders", { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        // Un compte sans rattachement n'a pas d'espace livreur à montrer.
        setCourses(Array.isArray(d.missions) && d.missions.length ? (d.orders?.length ?? 0) : null);
      })
      .catch(() => { if (alive) setCourses(null); });
    return () => { alive = false; };
  }, [pathname]);

  const statusColor = (s: string) =>
    s === "active" ? "#34D399" : s === "paused" ? "#FBBF24" : "var(--border-strong)";

  const width = collapsed ? SIDEBAR_COL : SIDEBAR_W;

  return (
    <motion.aside
      animate={{ width }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed left-0 top-0 bottom-0 flex flex-col select-none overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        borderRight: "1px solid var(--border-subtle)",
        zIndex: isDesktop ? 40 : 50,
        transform: isDesktop ? "none" : `translateX(${mobileOpen ? "0" : "-102%"})`,
        transition: "transform 0.28s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: !isDesktop && mobileOpen ? "0 24px 60px rgba(25,23,27,0.25)" : "none",
      }}
    >
      {/* Logo */}
      <div className="flex items-center flex-shrink-0 px-3 gap-2"
        style={{ height: TOPBAR_H, borderBottom: "1px solid var(--border-subtle)" }}>
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0" aria-label="Retour à l'accueil">
          <CamilleIcon size="sm" className="transition-shadow duration-200 group-hover:shadow-[0_0_12px_rgba(124,90,248,0.3)]" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                className="font-good-timing text-sm font-bold whitespace-nowrap overflow-hidden text-gold-gradient"
              >
                Camille
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button onClick={isDesktop ? onToggle : onCloseMobile}
          className="ml-auto w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-150"
          style={{ color: "var(--text-disabled)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}
          title={!isDesktop ? "Fermer" : collapsed ? "Agrandir la sidebar" : "Réduire la sidebar"}
        >
          {!isDesktop ? (
            <ChevronLeft className="w-4 h-4" style={{ transform: "rotate(0deg)" }} />
          ) : (
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </motion.div>
          )}
        </button>
      </div>

      {/* New agent */}
      <div className="px-2.5 pt-3 pb-2 flex-shrink-0">
        <button onClick={() => router.push("/configure")}
          className="w-full flex items-center gap-2 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
          style={{
            background: "rgba(124,90,248,0.08)",
            color: "var(--color-gold)",
            border: "1px solid rgba(124,90,248,0.18)",
            padding: collapsed ? "8px 0" : "8px 10px",
            justifyContent: collapsed ? "center" : undefined,
          }}
          title={collapsed ? "Nouvel agent" : undefined}
        >
          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Nouvel agent
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-1 overflow-y-auto overflow-x-hidden space-y-0.5">
        <NavItem href="/dashboard" label="Tableau de bord"
          icon={<LayoutDashboard className="w-3.5 h-3.5" />}
          active={pathname === "/dashboard"} collapsed={collapsed} />
        <NavItem href="/dashboard" label="Mes agents"
          icon={<Bot className="w-3.5 h-3.5" />}
          active={false} collapsed={collapsed}
          badge={mounted ? agents.length : undefined} />

        {/* Trois familles au lieu d'une liste qui s'allongeait à chaque
            fonctionnalité : ce qu'on vend, ce que ça rapporte, et le site —
            ce dernier seulement quand il existe. */}
        <NavGroup
          label="Catalogue & ventes"
          icon={<Package className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          items={[
            { href: "/dashboard/orders", label: "Commandes", icon: <Receipt className="w-3.5 h-3.5" />, active: pathname === "/dashboard/orders" },
            ...(activeAgentId
              ? [
                  { href: `/dashboard/${activeAgentId}/catalog`, label: "Catalogue", icon: <Package className="w-3.5 h-3.5" />, active: pathname.endsWith("/catalog") },
                  { href: `/dashboard/${activeAgentId}/clientele`, label: "Clientèle", icon: <Users className="w-3.5 h-3.5" />, active: pathname.endsWith("/clientele") },
                  { href: `/dashboard/${activeAgentId}/livreurs`, label: "Livreurs", icon: <Bike className="w-3.5 h-3.5" />, active: pathname.endsWith("/livreurs") },
                  // Sans site branché, les visuels servent quand même à la
                  // conversation et au bon de commande : ils restent ici.
                  ...(hasSite
                    ? []
                    : [{ href: `/dashboard/${activeAgentId}/medias`, label: "Médias", icon: <ImageIcon className="w-3.5 h-3.5" />, active: pathname.endsWith("/medias") }]),
                ]
              : []),
          ]}
        />

        <NavGroup
          label="Chiffre d'affaires"
          icon={<BarChart2 className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          items={[
            { href: "/dashboard/stats", label: "Statistiques", icon: <BarChart2 className="w-3.5 h-3.5" />, active: pathname === "/dashboard/stats" },
            ...(activeAgentId
              ? [{ href: `/dashboard/${activeAgentId}/entreprises`, label: "Comptes entreprise", icon: <Building2 className="w-3.5 h-3.5" />, active: pathname.endsWith("/entreprises") }]
              : []),
            { href: "/dashboard/billing", label: "Facturation", icon: <CreditCard className="w-3.5 h-3.5" />, active: pathname === "/dashboard/billing" },
          ]}
        />

        {activeAgentId && hasSite && (
          <NavGroup
            label="Gestion du site"
            icon={<Globe className="w-3.5 h-3.5" />}
            collapsed={collapsed}
            items={[
              { href: `/dashboard/${activeAgentId}/trafic`, label: "Trafic du site", icon: <TrendingUp className="w-3.5 h-3.5" />, active: pathname.endsWith("/trafic") },
              { href: `/dashboard/${activeAgentId}/medias`, label: "Médias", icon: <ImageIcon className="w-3.5 h-3.5" />, active: pathname.endsWith("/medias") },
              { href: `/dashboard/${activeAgentId}/integrations`, label: "Intégrations", icon: <Plug className="w-3.5 h-3.5" />, active: pathname.endsWith("/integrations") },
            ]}
          />
        )}

        {/* Pas encore de site : le lien reste visible seul, sinon on ne
            pourrait jamais en brancher un. */}
        {activeAgentId && !hasSite && (
          <NavItem href={`/dashboard/${activeAgentId}/integrations`} label="Intégrations"
            icon={<Plug className="w-3.5 h-3.5" />}
            active={pathname.endsWith("/integrations")} collapsed={collapsed} />
        )}

        <NavItem href="/dashboard/notifications" label="Notifications"
          icon={<Bell className="w-3.5 h-3.5" />}
          active={pathname === "/dashboard/notifications"} collapsed={collapsed} />
        {activeAgentId && (
          <NavItem href={`/dashboard/${activeAgentId}/settings`} label="Config"
            icon={<Settings className="w-3.5 h-3.5" />}
            active={pathname.endsWith("/settings")} collapsed={collapsed} />
        )}

        {/* L'espace livreur, hors du tableau de bord : c'est un autre métier,
            et un autre écran. Toujours visible — un commerçant qui livre
            lui-même s'en sert aussi — avec le compte des courses en attente
            dès qu'une boutique a rattaché ce compte. */}
        <NavItem href="/livraison" label="Espace livreur"
          icon={<Bike className="w-3.5 h-3.5" />}
          active={false} collapsed={collapsed}
          badge={courses ?? undefined} />

        {/* Console d'exploitation. Le lien ne s'affiche que pour un
            administrateur, mais c'est la route serveur qui protège vraiment :
            masquer un lien n'a jamais interdit d'y aller. */}
        {user?.is_admin && (
          <>
            <NavItem href="/dashboard/admin" label="Exploitation"
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              active={pathname === "/dashboard/admin"} collapsed={collapsed} />
            {/* La page qui dit où l'agent se trompe. Elle existait déjà mais
                n'était atteignable qu'en tapant l'URL — donc jamais ouverte. */}
            <NavItem href="/dashboard/insights" label="Qualité de l'agent"
              icon={<Activity className="w-3.5 h-3.5" />}
              active={pathname === "/dashboard/insights"} collapsed={collapsed} />
          </>
        )}

        {mounted && agents.length > 0 && (
          <div className="pt-3">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <Link key={agent.id} href={`/dashboard/${agent.id}`}
                  title={collapsed ? agent.identity.name : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg text-xs transition-all duration-150 mb-0.5",
                    isActive ? "bg-[var(--surface-gold)]" : "hover:bg-[var(--bg-subtle)]"
                  )}
                  style={{
                    border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    padding: collapsed ? "6px 0" : "6px 8px",
                    justifyContent: collapsed ? "center" : undefined,
                    color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}>
                      {agent.identity.avatar_emoji ?? agent.identity.name?.[0] ?? "A"}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border"
                      style={{ background: statusColor(agent.status), borderColor: "var(--bg-elevated)" }} />
                  </div>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }}
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

      {/* User footer */}
      <div className="px-2.5 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2"
          style={{ padding: collapsed ? "4px 0" : "4px 6px", justifyContent: collapsed ? "center" : undefined }}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: "rgba(124,90,248,0.15)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.22)" }}
            title={collapsed && mounted ? displayName : undefined}
          >
            {mounted ? (displayName[0]?.toUpperCase() ?? "?") : "?"}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-xs font-semibold truncate whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  {mounted ? displayName : "Utilisateur"}
                </p>
                <p className="text-[10px] truncate whitespace-nowrap" style={{ color: "var(--text-disabled)" }}>
                  {mounted ? (user?.email ?? "") : ""}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button onClick={logout} title="Se déconnecter"
              className="p-1.5 rounded-lg transition-colors duration-150 hover:bg-[var(--surface-gold)] flex-shrink-0"
              style={{ color: "var(--text-disabled)" }}>
              <LogOut className="w-3 h-3" />
            </button>
          )}
        </div>
        {collapsed && (
          <div className="flex justify-center mt-1.5">
            <button onClick={logout} title="Se déconnecter"
              className="p-1.5 rounded-lg transition-colors duration-150 hover:bg-[var(--surface-gold)]"
              style={{ color: "var(--text-disabled)" }}>
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

type NavEntry = { href: string; label: string; icon: React.ReactNode; active: boolean };

/**
 * Une famille de pages, repliée par défaut.
 *
 * La barre latérale grandissait d'un lien à chaque fonctionnalité ; à douze
 * entrées, plus personne ne lisait la liste. Un groupe s'ouvre au clic, se
 * souvient de son état, et s'ouvre tout seul quand on est dans une de ses
 * pages. Barre réduite, il redevient une icône qui mène à sa première page —
 * un menu déroulant sans libellé ne s'explore pas.
 */
function NavGroup({ label, icon, items, collapsed }: {
  label: string; icon: React.ReactNode; items: NavEntry[]; collapsed: boolean;
}) {
  const activeInside = items.some((i) => i.active);
  const [open, setOpen] = useState(activeInside);

  useEffect(() => {
    if (activeInside) { setOpen(true); return; }
    try {
      const saved = localStorage.getItem(`cml-nav-${label}`);
      if (saved != null) setOpen(saved === "1");
    } catch { /* sans stockage, le groupe s'ouvre au clic */ }
  }, [activeInside, label]);

  function toggle() {
    setOpen((o) => {
      try { localStorage.setItem(`cml-nav-${label}`, o ? "0" : "1"); } catch { /* sans conséquence */ }
      return !o;
    });
  }

  if (!items.length) return null;
  if (collapsed) {
    return <NavItem href={items[0].href} label={label} icon={icon} active={activeInside} collapsed />;
  }

  return (
    <div>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg text-xs transition-all duration-150 hover:bg-[var(--bg-subtle)]"
        style={{
          border: "1px solid transparent",
          padding: "7px 10px",
          color: activeInside ? "var(--text-primary)" : "var(--text-tertiary)",
        }}
      >
        <span className="flex-shrink-0" style={{ opacity: activeInside ? 1 : 0.6 }}>{icon}</span>
        <span className="flex-1 truncate whitespace-nowrap text-left font-medium">{label}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "none", opacity: 0.5 }} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-[13px] mt-0.5 space-y-0.5 border-l pl-2" style={{ borderColor: "var(--border-subtle)" }}>
              {items.map((item) => (
                <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon}
                  active={item.active} collapsed={false} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ href, label, icon, active, collapsed, badge }: {
  href: string; label: string; icon: React.ReactNode;
  active: boolean; collapsed: boolean; badge?: number;
}) {
  return (
    <Link href={href} title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg text-xs transition-all duration-150",
        active ? "bg-[var(--surface-gold)]" : "hover:bg-[var(--bg-subtle)]"
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
            initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }}
            className="flex-1 font-medium truncate whitespace-nowrap overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="text-[10px] tabular-nums px-1.5 py-px rounded-md font-bold flex-shrink-0"
          style={{ background: "rgba(124,90,248,0.12)", color: "var(--color-gold)" }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function Topbar({ sidebarW, isDesktop, onBurger }: { sidebarW: number; isDesktop: boolean; onBurger: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { agents } = useAgents();
  const { user }   = useAuth();
  const [mounted, setMounted]       = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ]                   = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
        setTimeout(() => searchRef.current?.focus(), 80);
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pageLabel = (() => {
    if (pathname === "/dashboard")         return "Tableau de bord";
    if (pathname === "/dashboard/orders")  return "Commandes";
    if (pathname === "/dashboard/stats")   return "Statistiques";
    if (pathname === "/dashboard/billing") return "Plans & Facturation";
    if (pathname === "/dashboard/notifications") return "Notifications";
    const match = agents.find((a) => pathname.includes(a.id));
    if (match) return match.identity.name;
    return "Dashboard";
  })();

  const filtered = q.trim()
    ? agents.filter((a) => a.identity.name.toLowerCase().includes(q.toLowerCase()))
    : [];

  return (
    <motion.header
      animate={{ left: sidebarW }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed top-0 right-0 z-30 flex items-center gap-3 px-5"
      style={{ height: TOPBAR_H, background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)", backdropFilter: "blur(16px)" }}
    >
      {/* Burger — mobile uniquement */}
      {!isDesktop && (
        <button
          onClick={onBurger}
          aria-label="Ouvrir le menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 transition-colors"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
        >
          <Menu className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </button>
      )}

      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 mr-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-disabled)" }}>
          Dashboard
        </span>
        {pathname !== "/dashboard" && (
          <>
            <span style={{ color: "var(--text-disabled)" }}>/</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
              {pageLabel}
            </span>
          </>
        )}
      </div>

      <div className="flex-1 max-w-sm relative">
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 60); }}
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-all duration-150"
          style={{
            background: searchOpen ? "var(--bg-muted)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${searchOpen ? "rgba(124,90,248,0.3)" : "var(--border-subtle)"}`,
            color: "var(--text-disabled)",
          }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          {searchOpen ? (
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un agent…" className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: "var(--text-primary)" }}
              onBlur={() => { setTimeout(() => { setSearchOpen(false); setQ(""); }, 150); }} />
          ) : (
            <span className="flex-1 text-left">Rechercher…</span>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={{ background: "var(--bg-muted)", color: "var(--text-disabled)", border: "1px solid var(--border-subtle)" }}>
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
        <AnimatePresence>
          {searchOpen && q.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="absolute top-full mt-2 w-full rounded-xl overflow-hidden"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "0 16px 40px rgba(25,23,27,0.12)" }}
            >
              {filtered.length > 0 ? filtered.map((a) => (
                <button key={a.id}
                  onClick={() => { router.push(`/dashboard/${a.id}`); setSearchOpen(false); setQ(""); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors hover:bg-[var(--surface-gold)]"
                  style={{ color: "var(--text-secondary)" }}>
                  <Bot className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
                  {a.identity.name}
                </button>
              )) : (
                <p className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text-disabled)" }}>
                  Aucun résultat pour « {q} »
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto flex items-center gap-1 flex-shrink-0">
        {/* Accès à la console d'exploitation. Il n'apparaît que pour un
            administrateur, mais ce n'est PAS ce qui la protège : la route
            serveur refuse tout compte non administrateur. Masquer un lien n'a
            jamais interdit d'y aller — ici on économise un élément d'interface
            à ceux à qui il ne sert à rien, rien de plus. */}
        {user?.is_admin && (
          <Link href="/dashboard/admin" title="Console d'exploitation"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-110"
            style={{
              background: pathname === "/dashboard/admin" ? "rgba(220,38,38,0.16)" : "rgba(220,38,38,0.08)",
              color: "#B0322C",
              border: "1px solid rgba(220,38,38,0.22)",
            }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
        <button onClick={() => router.push("/configure")} title="Créer un agent"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-110"
          style={{ background: "rgba(124,90,248,0.08)", color: "var(--color-gold)", border: "1px solid rgba(124,90,248,0.18)" }}>
          <Plus className="w-3 h-3" />
          Nouvel agent
        </button>
        <ThemeToggle />
        <NotificationBell />
        <button title="Aide"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{ color: "var(--text-disabled)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}
          onClick={() => window.open("/contact", "_blank")}>
          <HelpCircle className="w-4 h-4" />
        </button>
        <Link href="/" title="Retour au site"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{ color: "var(--text-disabled)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop]   = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => { setIsDesktop(mq.matches); if (mq.matches) setMobileOpen(false); };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Largeur réservée au contenu : sidebar sur desktop, 0 sur mobile (drawer overlay)
  const contentW = isDesktop ? (collapsed ? SIDEBAR_COL : SIDEBAR_W) : 0;

  return (
    <div className="flex min-h-dvh" style={{ background: "var(--bg-base)" }}>
      <Sidebar
        collapsedProp={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        isDesktop={isDesktop}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Backdrop mobile */}
      <AnimatePresence>
        {!isDesktop && mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(25,23,27,0.45)", backdropFilter: "blur(2px)" }}
          />
        )}
      </AnimatePresence>

      <Topbar sidebarW={contentW} isDesktop={isDesktop} onBurger={() => setMobileOpen(true)} />

      <motion.div
        animate={{ marginLeft: contentW }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="flex-1 min-w-0"
        style={{ paddingTop: TOPBAR_H }}
      >
        {children}
      </motion.div>
    </div>
  );
}
