"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le journal complet des notifications, équivalent web de l'écran du mobile.
//
// La cloche n'en montre que le nombre : quand un agent est resté sans
// surveillance une nuit entière, ce qui compte est justement ce qui a défilé
// pendant qu'on ne regardait pas. D'où un journal rangé par jour, filtrable
// par type, avec à côté le résumé et l'activation des alertes hors du site.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BellOff, BellRing, Check, CheckCheck, ChevronRight, Loader2, Receipt, AlertTriangle,
  Info, RefreshCw, Share,
} from "lucide-react";
import { toast } from "sonner";
import { useNotifications, notifHref, whenLabel, type Notif } from "@/hooks/useNotifications";
import { activerPushWeb, desactiverPushWeb, lireEtatPush, pushRefuseIci, type EtatPush } from "@/lib/push-web";
import { activerSon, jouerCaisse, sonActive } from "@/lib/son";
import { Doodle } from "@/components/dashboard/Doodle";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

// ── Types de notification ───────────────────────────────────────────────────

type Type = "commande" | "alerte" | "systeme";
const TYPES: Record<Type, { Icone: React.ElementType; fond: string; encre: string; libelle: string; pluriel: string }> = {
  commande: { Icone: Receipt,       fond: "#E4F6EA", encre: "#1E7A3A", libelle: "Commande", pluriel: "Commandes" },
  alerte:   { Icone: AlertTriangle, fond: "#FDF1DC", encre: "#9A6510", libelle: "Alerte",   pluriel: "Alertes" },
  systeme:  { Icone: Info,          fond: "#F0EBFF", encre: "#6442E8", libelle: "Système",  pluriel: "Système" },
};
const typeDe = (k: string): Type => (k in TYPES ? (k as Type) : "systeme");

type Filtre = "toutes" | "non-lues" | Type;

/** « Nouvelle commande — 6 000 XAF » : le montant devient une pastille. */
function decouper(titre: string): { texte: string; montant: string | null } {
  const m = titre.match(/^(.*?)\s+[—–-]\s+([\d\s.,  ]+\s?(?:XAF|FCFA|€|EUR|\$|USD))$/i);
  return m ? { texte: m[1], montant: m[2].trim() } : { texte: titre, montant: null };
}

/** Le jour, pour ranger le journal : aujourd'hui, hier, cette semaine, puis la date. */
function jourDe(iso: string): string {
  const d = new Date(iso);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const j = new Date(d); j.setHours(0, 0, 0, 0);
  const ecart = Math.round((auj.getTime() - j.getTime()) / 86_400_000);
  if (ecart <= 0) return "Aujourd'hui";
  if (ecart === 1) return "Hier";
  if (ecart < 7) return "Cette semaine";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
}

// ── La page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const { list, unread, error, loading, reload, markRead, markAllRead } = useNotifications(100);
  const [filtre, setFiltre] = useState<Filtre>("toutes");

  const items = useMemo(() => list ?? [], [list]);
  const comptes = useMemo(() => ({
    toutes: items.length,
    "non-lues": items.filter((n) => !n.read_at).length,
    commande: items.filter((n) => typeDe(n.kind) === "commande").length,
    alerte: items.filter((n) => typeDe(n.kind) === "alerte").length,
    systeme: items.filter((n) => typeDe(n.kind) === "systeme").length,
  }), [items]);

  const visibles = useMemo(() => items.filter((n) =>
    filtre === "toutes" ? true : filtre === "non-lues" ? !n.read_at : typeDe(n.kind) === filtre
  ), [items, filtre]);

  const groupes = useMemo(() => {
    const g: { jour: string; notifs: Notif[] }[] = [];
    for (const n of visibles) {
      const jour = jourDe(n.created_at);
      const dernier = g[g.length - 1];
      if (dernier?.jour === jour) dernier.notifs.push(n); else g.push({ jour, notifs: [n] });
    }
    return g;
  }, [visibles]);

  function ouvrir(n: Notif) {
    if (!n.read_at) markRead(n.id);
    const href = notifHref(n);
    if (href) router.push(href);
  }

  const FILTRES: { cle: Filtre; libelle: string }[] = [
    { cle: "toutes", libelle: "Toutes" },
    { cle: "non-lues", libelle: "Non lues" },
    { cle: "commande", libelle: TYPES.commande.pluriel },
    { cle: "alerte", libelle: TYPES.alerte.pluriel },
    { cle: "systeme", libelle: TYPES.systeme.pluriel },
  ];

  return (
    <div className="ntf grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-8">
      {/* ── Le journal ─────────────────────────────────────────────────────── */}
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Les filtres, en boutons radio arrondis */}
          <div role="radiogroup" aria-label="Filtrer les notifications" className="ntf-filtres flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
            {FILTRES.map(({ cle, libelle }) => {
              const actif = filtre === cle;
              return (
                <button key={cle} role="radio" aria-checked={actif} onClick={() => setFiltre(cle)}
                  className="relative flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13.5px] transition-colors"
                  style={{ color: actif ? "#fff" : "var(--cl-ink-soft)" }}>
                  {actif && <motion.span layoutId="ntf-filtre" transition={RESSORT} className="absolute inset-0 rounded-full" style={{ background: "var(--cl-ink)" }} />}
                  <span className="relative">{libelle}</span>
                  <span className="relative rounded-full px-1.5 text-[11.5px] tabular-nums"
                    style={{ background: actif ? "rgba(255,255,255,0.18)" : "#EAE6F1", color: actif ? "#fff" : "var(--cl-ink-faint)" }}>
                    {comptes[cle]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.94 }} onClick={reload} disabled={loading} aria-label="Actualiser"
              className="ntf-rond flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-60">
              <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={markAllRead} disabled={unread === 0}
              className="flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium text-white transition-opacity disabled:opacity-40"
              style={{ background: "var(--cl-ink)" }}>
              <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
            </motion.button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-[18px] px-4 py-3 text-[13px]" style={{ background: "#FBEAE6", color: "#8E3322" }}>{error}</p>
        ) : null}

        <div className="mt-6">
          {!list ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="ntf-squelette h-[86px] rounded-[24px]" style={{ animationDelay: `${i * 120}ms` }} />)}
            </div>
          ) : groupes.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-10 text-center">
              <Doodle nom="levitate" className="ntf-flotte h-[170px] w-auto" />
              <p className="mt-5 text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>
                {filtre === "non-lues" ? "Tout est lu." : items.length ? "Rien dans ce filtre." : "Tout est calme pour l'instant."}
              </p>
              <p className="mt-1 max-w-sm text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                Les commandes reçues et les alertes de vos agents apparaîtront ici, au fil de la journée.
              </p>
            </motion.div>
          ) : (
            groupes.map((g) => (
              <div key={g.jour} className="mb-6">
                <p className="ntf-jour sticky z-10 mb-2.5 inline-flex rounded-full px-3 py-1 text-[12px] font-medium">{g.jour}</p>
                <motion.ul layout className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {g.notifs.map((n, i) => (
                      <Ligne key={n.id} n={n} rang={i} onOuvrir={() => ouvrir(n)} onLu={() => markRead(n.id)} />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── À côté : le résumé et les alertes hors du site ─────────────────── */}
      <aside className="space-y-4 lg:sticky lg:top-[96px] lg:self-start">
        <Resume items={items} unread={unread} />
        <CartePush />
        <CarteSon />
      </aside>

      <style jsx global>{`
        .ntf-filtres { background: #F4F2F7; scrollbar-width: none; }
        .ntf-filtres::-webkit-scrollbar { display: none; }
        .ntf-rond { border: 1px solid var(--cl-line); color: var(--cl-ink); background: #fff; }
        .ntf-jour { top: 84px; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); color: var(--cl-ink-faint); border: 1px solid var(--cl-line-soft); }
        .ntf-ligne { border: 1px solid var(--cl-line-soft); background: #fff; transition: box-shadow .25s ease, border-color .25s ease, transform .25s cubic-bezier(.34,1.56,.64,1); }
        .ntf-ligne:hover { box-shadow: 0 14px 30px rgba(70,40,190,0.09); border-color: var(--cl-lavender); transform: translateY(-2px); }
        .ntf-ligne[data-nouvelle] { background: linear-gradient(90deg, #F7F4FF 0%, #fff 70%); border-color: #E2D9FF; }
        .ntf-ligne .ntf-lu { opacity: 0; transform: scale(.8); transition: opacity .2s ease, transform .2s cubic-bezier(.34,1.56,.64,1); }
        .ntf-ligne:hover .ntf-lu, .ntf-ligne:focus-within .ntf-lu { opacity: 1; transform: scale(1); }
        @media (hover: none) { .ntf-ligne .ntf-lu { opacity: 1; transform: none; } }
        .ntf-squelette { background: linear-gradient(90deg, #F4F2F7 0%, #FBFAFD 50%, #F4F2F7 100%); background-size: 200% 100%; animation: ntf-reflet 1.4s ease-in-out infinite; }
        @keyframes ntf-reflet { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .ntf-flotte { animation: ntf-flotte 5s ease-in-out infinite; }
        @keyframes ntf-flotte { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .ntf-carte { border: 1px solid var(--cl-line-soft); background: #fff; }
        .ntf-interrupteur { transition: background-color .25s ease; }
        .ntf-interrupteur span { transition: transform .3s cubic-bezier(.34,1.56,.64,1); }
        @media (prefers-reduced-motion: reduce) { .ntf-flotte, .ntf-squelette { animation: none; } }
      `}</style>
    </div>
  );
}

// ── Une notification ────────────────────────────────────────────────────────

function Ligne({ n, rang, onOuvrir, onLu }: { n: Notif; rang: number; onOuvrir: () => void; onLu: () => void }) {
  const t = TYPES[typeDe(n.kind)];
  const nouvelle = !n.read_at;
  const href = notifHref(n);
  const { texte, montant } = decouper(n.title);
  return (
    <motion.li layout
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      transition={{ ...RESSORT, delay: Math.min(rang, 8) * 0.03 }}>
      <div data-nouvelle={nouvelle ? "1" : undefined} role={href ? "link" : undefined} tabIndex={href ? 0 : undefined}
        onClick={href ? onOuvrir : undefined} onKeyDown={(e) => { if (href && e.key === "Enter") onOuvrir(); }}
        className={"ntf-ligne group flex items-start gap-4 rounded-[24px] p-4 sm:p-5 " + (href ? "cursor-pointer" : "")}>
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: t.fond, color: t.encre }}>
          <t.Icone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className={"text-[15px] leading-snug " + (nouvelle ? "font-semibold" : "font-medium")} style={{ color: "var(--cl-ink)" }}>{texte}</p>
            {montant && (
              <span className="rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold tabular-nums" style={{ background: t.fond, color: t.encre }}>{montant}</span>
            )}
          </div>
          {n.body ? <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>{n.body}</p> : null}
          <p className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
            <span className="rounded-full px-2 py-0.5" style={{ background: "#F4F2F7" }}>{t.libelle}</span>
            {whenLabel(n.created_at)}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 self-center">
          {nouvelle && (
            <button onClick={(e) => { e.stopPropagation(); onLu(); }} aria-label="Marquer comme lu" title="Marquer comme lu"
              className="ntf-lu ntf-rond flex h-9 w-9 items-center justify-center rounded-full">
              <Check className="h-4 w-4" />
            </button>
          )}
          {nouvelle && <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cl-accent)" }} aria-label="Non lue" />}
          {href && <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--cl-ink-faint)" }} />}
        </div>
      </div>
    </motion.li>
  );
}

// ── Le résumé ───────────────────────────────────────────────────────────────

function Resume({ items, unread }: { items: Notif[]; unread: number }) {
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const semaine = Date.now() - 7 * 86_400_000;
  const commandesAuj = items.filter((n) => typeDe(n.kind) === "commande" && new Date(n.created_at) >= auj).length;
  const alertes7 = items.filter((n) => typeDe(n.kind) === "alerte" && new Date(n.created_at).getTime() >= semaine).length;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={RESSORT}
      className="relative overflow-hidden rounded-[28px] p-6" style={{ background: "linear-gradient(150deg, #A792F4 0%, #C6B8FA 100%)" }}>
      <p className="text-[13px] text-white/80">À lire</p>
      <p className="mt-1 text-[52px] font-light leading-none tracking-[-0.04em] text-white tabular-nums">{unread}</p>
      <p className="mt-1 text-[13px] text-white/80">{unread ? `notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}` : "tout est à jour"}</p>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-[18px] bg-white/90 p-3.5">
          <p className="text-[22px] font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>{commandesAuj}</p>
          <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>commandes aujourd&apos;hui</p>
        </div>
        <div className="rounded-[18px] bg-white/90 p-3.5">
          <p className="text-[22px] font-medium tabular-nums" style={{ color: "var(--cl-ink)" }}>{alertes7}</p>
          <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>alertes sur 7 jours</p>
        </div>
      </div>
      <Doodle nom="reading" className="pointer-events-none absolute -right-3 top-3 h-[118px] w-auto opacity-95" />
    </motion.div>
  );
}

// ── Les alertes hors du site ────────────────────────────────────────────────
// Le navigateur n'accorde l'autorisation qu'après un geste de l'utilisateur :
// la demander au chargement fait surgir une fenêtre que personne n'attend, et
// un refus est définitif. D'où cet interrupteur explicite.

function CartePush() {
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let vivant = true;
    lireEtatPush().then((initial) => {
      if (!vivant) return;
      setEtat(initial);
      // Déjà autorisé : on rattache le jeton sans rien demander, sauf si ce
      // navigateur a été éteint volontairement.
      if (initial === "actif" || (initial === "a-activer" && !pushRefuseIci() && Notification.permission === "granted")) {
        activerPushWeb(false).then((suite) => vivant && setEtat(suite));
      }
    });
    return () => { vivant = false; };
  }, []);

  if (etat === null || etat === "non-configure") return null;

  async function basculer() {
    setOccupe(true);
    try {
      if (etat === "actif") {
        await desactiverPushWeb();
        setEtat("a-activer");
        toast.success("Ce navigateur ne recevra plus d'alertes");
      } else {
        const r = await activerPushWeb(true);
        setEtat(r);
        if (r === "actif") toast.success("Alertes activées sur ce navigateur");
        else if (r === "refuse") toast.error("Autorisation refusée : à réactiver dans les réglages du navigateur");
      }
    } finally { setOccupe(false); }
  }

  const textes: Record<Exclude<EtatPush, "non-configure">, { Icone: React.ElementType; titre: string; texte: string }> = {
    "actif":        { Icone: BellRing, titre: "Alertes hors du site", texte: "Activées : vous les recevez même site fermé." },
    "a-activer":    { Icone: Bell,     titre: "Alertes hors du site", texte: "Commande reçue, agent déconnecté, rupture de stock : comme sur le téléphone." },
    "refuse":       { Icone: BellOff,  titre: "Alertes bloquées", texte: "Le navigateur les refuse pour ce site. Réactivez-les dans ses réglages, à côté de la barre d'adresse." },
    "a-installer":  { Icone: Share,    titre: "Ajoutez Camille à l'écran d'accueil", texte: "Sur iPhone, les alertes n'arrivent qu'à l'application installée : Partager, puis « Sur l'écran d'accueil ». Ouvrez-la depuis l'icône et activez ici." },
    "non-supporte": { Icone: BellOff,  titre: "Navigateur non compatible", texte: "Les alertes hors onglet demandent un navigateur récent (iOS 16.4 au minimum). Ce journal reste à jour." },
  };
  const { Icone, titre, texte } = textes[etat];
  const interrupteur = etat === "actif" || etat === "a-activer";
  const allume = etat === "actif";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RESSORT, delay: 0.06 }}
      className="ntf-carte rounded-[28px] p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: allume ? "#E4F6EA" : "var(--cl-accent-soft)", color: allume ? "#1E7A3A" : "var(--cl-accent-deep)" }}>
          <Icone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>{titre}</p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{texte}</p>
        </div>
        {interrupteur && (
          <button role="switch" aria-checked={allume} aria-label="Alertes sur ce navigateur" onClick={basculer} disabled={occupe}
            className="ntf-interrupteur relative mt-1 h-7 w-12 flex-shrink-0 rounded-full disabled:opacity-60"
            style={{ background: allume ? "#1DAB55" : "#DCD6E6" }}>
            <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow"
              style={{ transform: allume ? "translateX(20px)" : "none" }}>
              {occupe && <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--cl-ink-faint)" }} />}
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Le son des commandes ────────────────────────────────────────────────────
// Le « ka-ching » joué par le tableau de bord ouvert à chaque nouvelle
// commande. Réglage propre à cet appareil.

function CarteSon() {
  const [allume, setAllume] = useState(true);
  useEffect(() => setAllume(sonActive()), []);
  const basculer = () => {
    const suite = !allume;
    activerSon(suite);
    setAllume(suite);
    if (suite) jouerCaisse(true);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RESSORT, delay: 0.1 }}
      className="ntf-carte rounded-[28px] p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[20px]"
          style={{ background: allume ? "#E4F6EA" : "var(--cl-accent-soft)" }}>
          💰
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>Son des commandes</p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
            Un « ka-ching » à chaque nouvelle commande, tant que Camille est ouverte sur cet appareil.
          </p>
          <button type="button" onClick={() => jouerCaisse(true)} className="mt-2 text-[13px] font-medium underline"
            style={{ color: "var(--cl-accent-deep)" }}>
            Écouter
          </button>
        </div>
        <button role="switch" aria-checked={allume} aria-label="Son des commandes" onClick={basculer}
          className="ntf-interrupteur relative mt-1 h-7 w-12 flex-shrink-0 rounded-full"
          style={{ background: allume ? "#1DAB55" : "#DCD6E6" }}>
          <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow" style={{ transform: allume ? "translateX(20px)" : "none" }} />
        </button>
      </div>
    </motion.div>
  );
}
