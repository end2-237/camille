"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Intégrations — ce qui relie l'agent au reste du monde.
//
// En tête, les plateformes compatibles (OFS active, Shopify/WooCommerce bientôt,
// MCP disponible) ; pour OFS : connexion du compte → import boutique /
// catalogue plateforme (CJ) / tout.
//
// Dessous, deux colonnes : à gauche ce qu'on manipule (les clés d'API du site
// du marchand, les médias de prospection) ; à droite, collés en haut de
// l'écran, les réglages qu'on vérifie d'un coup d'œil (secteur, mode de
// conversion, source du catalogue, vectorisation).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { authHeaders } from "@/lib/auth-client";
import { sectorProfile, type SectorMode } from "@/lib/sectorProfiles";
import {
  BookOpen, Boxes, Check, ChevronDown, Clock, Code2, Compass, Copy, Images, KeyRound, Library,
  Lock, Paperclip, Plug, Plus, ShoppingBag, Sparkles, Store, Target, Trash2,
} from "lucide-react";
import { Bandeau, Bouton, BoutonRond, Filtres, LienBouton, Pastille, StylesUI, apparait } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

type MediaItem = { kind: string; url: string; caption?: string };

type Platform = {
  key: string; name: string; desc: string; status: "active" | "soon" | "beta";
  icon: React.ReactNode; accent: string;
};

const PLATFORMS: Platform[] = [
  { key: "ofs", name: "OFS — OneFreeStyle", desc: "Importe le catalogue de ta boutique OFS, ou tout le catalogue plateforme (CJ) si super-admin.", status: "active", icon: <Store className="w-5 h-5" />, accent: "#0e9d63" },
  { key: "mcp", name: "MCP (Claude, IDE…)", desc: "Expose ton catalogue à Claude Desktop et tout client compatible MCP.", status: "active", icon: <Sparkles className="w-5 h-5" />, accent: "#7a5cff" },
  { key: "shopify", name: "Shopify", desc: "Synchronise les produits d'une boutique Shopify.", status: "soon", icon: <ShoppingBag className="w-5 h-5" />, accent: "#95BF47" },
  { key: "woocommerce", name: "WooCommerce", desc: "Importe le catalogue d'un site WooCommerce/WordPress.", status: "soon", icon: <Boxes className="w-5 h-5" />, accent: "#7f54b3" },
];

function Badge({ status }: { status: Platform["status"] }) {
  if (status === "active") return <Pastille ton="vert"><Check className="h-3 w-3" />Disponible</Pastille>;
  if (status === "beta") return <Pastille ton="ambre"><Sparkles className="h-3 w-3" />Bêta</Pastille>;
  return <Pastille ton="gris"><Clock className="h-3 w-3" />Bientôt</Pastille>;
}

// ── Les petites pièces de la page ───────────────────────────────────────────

/** Une carte de section : la pastille d'icône, le titre, une phrase d'aide. */
function Section({ icone: Icone, titre, texte, rang = 0, children, action }: {
  icone: React.ElementType; titre: string; texte?: React.ReactNode; rang?: number;
  children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <motion.section {...apparait(rang)} className="ui-carte min-w-0 rounded-[28px] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
          <Icone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-medium leading-tight tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>{titre}</h2>
          {texte && <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{texte}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </motion.section>
  );
}

/** L'interrupteur rond : la bille glisse au ressort. */
function Interrupteur({ actif, onClick, disabled, label }: { actif: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button role="switch" aria-checked={actif} aria-label={label} onClick={onClick} disabled={disabled}
      className="relative flex h-8 w-[52px] flex-shrink-0 items-center rounded-full p-1 transition-colors disabled:opacity-50"
      style={{ background: actif ? "var(--cl-accent)" : "#DCD8E3", justifyContent: actif ? "flex-end" : "flex-start" }}>
      <motion.span layout transition={RESSORT} className="h-6 w-6 rounded-full bg-white" style={{ boxShadow: "0 2px 6px rgba(25,23,27,0.18)" }} />
    </button>
  );
}

/** Copier dans le presse-papiers, avec la coche le temps d'y croire. */
function useCopie() {
  const [copie, setCopie] = useState(false);
  const copier = (texte: string) => {
    navigator.clipboard?.writeText(texte);
    setCopie(true);
    setTimeout(() => setCopie(false), 1800);
  };
  return { copie, copier };
}

const Etiquette = ({ children }: { children: React.ReactNode }) => (
  <span className="mb-1.5 block px-1 text-[12.5px]" style={{ color: "var(--cl-ink-soft)" }}>{children}</span>
);

// ── La page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [open, setOpen] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"shop" | "cj" | "all">("shop");
  const [conn, setConn] = useState<"live" | "import">("live");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Auto-vectorisation OFS : visible UNIQUEMENT pour l'agent OFS désigné.
  const OFS_LIVE_AGENT = process.env.NEXT_PUBLIC_OFS_LIVE_AGENT_ID || "c2c7126b-6964-4248-befe-ce4ff7931a0a";
  const isOfsOwner = agentId === OFS_LIVE_AGENT;
  const [convMode, setConvMode] = useState<string>("whatsapp");
  const [convBusy, setConvBusy] = useState(false);
  const [catSrc, setCatSrc] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState(false);
  const [catMsg, setCatMsg] = useState("");
  const [vecBusy, setVecBusy] = useState(false);
  const [vecLog, setVecLog] = useState<string>("");
  const [vecTotal, setVecTotal] = useState(0);

  // ── Secteur & médias de prospection ──
  const [sector, setSector] = useState<string>("");
  const [bizName, setBizName] = useState<string>("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaMsg, setMediaMsg] = useState<string>("");
  const profile = sectorProfile(sector);

  const loadAgent = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/${agentId}`, { headers: { ...authHeaders() } });
      if (!r.ok) return;
      const d = await r.json();
      const a = d.agent || {};
      setSector(a.business_context?.sector || a.sector || "");
      setBizName(a.business_context?.business_name || a.name || "");
      setMedia(Array.isArray(a.media) ? a.media : []);
      // null = jamais configuré : pour l'agent OFS désigné cela équivaut au grand catalogue
      setCatSrc(a.catalog_source ?? null);
      setConvMode(a.conversion_mode || "whatsapp");
    } catch { /* ignore */ }
  }, [agentId]);
  useEffect(() => { loadAgent(); }, [loadAgent]);

  // Mode de conversion : conclure dans WhatsApp, ou renvoyer vers la boutique
  async function saveConvMode(mode: string) {
    setConvBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ conversion_mode: mode }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Erreur");
      setConvMode(mode);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setConvBusy(false); }
  }

  // Bascule grand catalogue OFS <-> catalogue natif Camille
  async function toggleCatalog(toOfs: boolean) {
    setCatBusy(true); setCatMsg("");
    try {
      const r = await fetch(`/api/agents/${agentId}/integrations/ofs-bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ source: toOfs ? "ofs_cj" : "camille" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setCatSrc(d.source);
      setCatMsg(toOfs ? "Grand catalogue OFS actif." : "Catalogue natif Camille actif.");
    } catch (e) {
      setCatMsg((e as Error).message);
    } finally { setCatBusy(false); }
  }

  function addMedia(kind: string) { setMedia((m) => [...m, { kind, url: "", caption: "" }]); }
  function updMedia(i: number, patch: Partial<MediaItem>) { setMedia((m) => m.map((x, k) => (k === i ? { ...x, ...patch } : x))); }
  function delMedia(i: number) { setMedia((m) => m.filter((_, k) => k !== i)); }

  async function saveMedia() {
    setMediaBusy(true); setMediaMsg("");
    try {
      const clean = media.filter((x) => x.url.trim());
      const r = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ media: clean }),
      });
      setMediaMsg(r.ok ? "✅ Médias enregistrés." : "❌ Échec de l'enregistrement.");
      if (r.ok) setMedia(clean);
    } catch (e) { setMediaMsg("❌ " + String(e)); } finally { setMediaBusy(false); }
  }

  const MODE_LABEL: Record<SectorMode, string> = { catalogue: "Catalogue produits", services: "Prestations de services", media: "Prospection par médias" };

  async function runVec(onlyNew: boolean) {
    setVecBusy(true); setVecLog(onlyNew ? "Vectorisation des nouveautés…\n" : "Backfill complet du catalogue OFS…\n");
    let after = "", total = 0, guard = 0;
    try {
      for (;;) {
        const qs = onlyNew ? `only_new=1&limit=200` : `limit=200&after=${encodeURIComponent(after)}`;
        const r = await fetch(`/api/admin/backfill-ofs-clip?${qs}`, { method: "POST", headers: { ...authHeaders() } });
        const d = await r.json();
        if (!r.ok) { setVecLog((s) => s + `❌ ${d.error || "erreur"}\n`); break; }
        total += d.indexed || 0; setVecTotal((t) => t + (d.indexed || 0));
        setVecLog((s) => s + `lot: +${d.indexed} indexés · ${d.already} déjà · ${d.noImage} sans image · ${d.failed} échecs\n`);
        after = d.nextAfter || after;
        if (onlyNew ? (d.indexed === 0 && d.scanned < 200) : d.done) { setVecLog((s) => s + `✅ Terminé — ${total} nouveaux vecteurs.\n`); break; }
        if (++guard > 2000) { setVecLog((s) => s + `⏹️ Arrêt de sécurité.\n`); break; }
      }
    } catch (e) { setVecLog((s) => s + `❌ ${String(e)}\n`); } finally { setVecBusy(false); }
  }

  async function bindOfs() {
    setBusy(true); setMsg(null);
    const source = mode === "cj" ? "ofs_cj" : "ofs_shop";
    try {
      const r = await fetch(`/api/agents/${agentId}/integrations/ofs-bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email, password, source }),
      });
      const d = await r.json();
      if (!r.ok) setMsg({ ok: false, text: d.error || "Échec de la connexion." });
      else setMsg({ ok: true, text: `✅ Connecté en LIVE${d.vendor ? " — boutique " + d.vendor.shop_name : " (catalogue plateforme CJ)"}. Ton bot répond maintenant en direct depuis OFS.` });
    } catch (e) { setMsg({ ok: false, text: String(e) }); } finally { setBusy(false); }
  }

  async function importOfs() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/agents/${agentId}/import/ofs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email, password, mode }),
      });
      const d = await r.json();
      if (!r.ok) setMsg({ ok: false, text: d.error || "Échec de l'import." });
      else setMsg({ ok: true, text: `✅ ${d.imported}/${d.total ?? d.imported} produits importés${d.vendor ? " (boutique " + d.vendor.shop_name + ")" : ""}. ${d.hint || ""}` });
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally { setBusy(false); }
  }

  // null = non configuré ; pour l'agent OFS désigné le grand catalogue était actif par défaut
  const montreCatalogue = isOfsOwner || catSrc === "ofs_cj" || catSrc === "ofs_shop";
  const bigOn = catSrc === "ofs_cj" || catSrc === "ofs_shop" || (catSrc === null && isOfsOwner);

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />

      <p className="max-w-2xl text-[14px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
        Connecte une plateforme pour importer ou lier ton catalogue. Voici ce qui est compatible :
      </p>

      {/* ── Les plateformes ─────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:gap-4">
        {PLATFORMS.map((p, i) => {
          const ouvert = p.key === "ofs" && open === "ofs";
          return (
            <motion.div key={p.key} {...apparait(i)} className="ui-carte flex min-w-0 flex-col rounded-[26px] p-5"
              style={ouvert ? { borderColor: "var(--cl-accent)", boxShadow: "0 16px 36px rgba(124,90,248,0.14)" } : undefined}>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${p.accent}1F`, color: p.accent }}>{p.icon}</span>
                <Badge status={p.status} />
              </div>
              <p className="mt-4 text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>{p.name}</p>
              <p className="mt-1 flex-1 text-[12.5px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>{p.desc}</p>

              <div className="mt-4">
                {p.key === "ofs" && p.status === "active" && (
                  <Bouton variante={ouvert ? "doux" : "encre"} icone={Plug} className="w-full" aria-expanded={ouvert}
                    onClick={() => setOpen(open === "ofs" ? null : "ofs")}>
                    {open === "ofs" ? "Fermer" : "Connecter OFS"}
                  </Bouton>
                )}
                {p.key === "mcp" && (
                  <LienBouton href="https://github.com/end2-237/camille/tree/main/camille-mcp" target="_blank" rel="noreferrer" icone={Code2} className="w-full">
                    Voir la configuration MCP
                  </LienBouton>
                )}
                {p.status === "soon" && (
                  <div className="flex h-10 items-center justify-center rounded-full text-[13px]" style={{ background: "#F4F2F7", color: "var(--cl-ink-faint)" }}>
                    Disponible bientôt
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── L'import OFS, déplié sous les plateformes ───────────────────────── */}
      <AnimatePresence initial={false}>
        {open === "ofs" && (
          <motion.div key="ofs" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={RESSORT} className="overflow-hidden">
            <div className="pt-4">
              <Section icone={Plug} titre="Importer depuis OFS">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <Etiquette>Email du compte OFS</Etiquette>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="ui-champ" placeholder="toi@exemple.com" />
                  </label>
                  <label className="block">
                    <Etiquette>Mot de passe OFS</Etiquette>
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="ui-champ" placeholder="••••••••" />
                  </label>
                </div>

                <div className="mt-4">
                  <Etiquette>Quoi importer ?</Etiquette>
                  <Filtres id="ofs-mode" label="Quoi importer ?" valeur={mode} onChange={setMode}
                    options={[
                      { cle: "shop", libelle: "Ma boutique" },
                      { cle: "cj", libelle: "Catalogue plateforme (CJ)" },
                      { cle: "all", libelle: "Tout (super-admin)" },
                    ]} />
                  <p className="mt-2 px-1 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                    « Catalogue plateforme (CJ) » et « Tout » nécessitent un compte super-admin OFS.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Bouton variante="encre" onClick={importOfs} occupe={busy} disabled={busy || !email || !password}>
                    {busy ? "Import en cours…" : "Importer le catalogue"}
                  </Bouton>
                  <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                    Tes identifiants OFS servent uniquement à lire ton catalogue (connexion directe à OFS) et ne sont pas stockés.
                  </span>
                </div>
              </Section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Les messages d'import et de mode de conversion partagent ce bandeau :
          il reste visible même quand le panneau OFS est replié. */}
      <AnimatePresence>
        {msg && (
          <motion.div key="msg" exit={{ opacity: 0 }} className="mt-4">
            <Bandeau ton={msg.ok ? "vert" : "rouge"}>{msg.text}</Bandeau>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        {/* ── Colonne principale ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <ApiKeysSection agentId={agentId} />

          {/* ── Médias de prospection (cran 3 : flyers, galeries, fiches services) ── */}
          <Section icone={Paperclip} titre="Médias de prospection WhatsApp" rang={3}
            texte={<>
              {profile.mode === "catalogue"
                ? "Ajoute des flyers/promos ; ton catalogue produits reste la source principale."
                : "Ton activité repose sur des prestations : ajoute ici flyers, galerie de réalisations et fiches de services que le bot enverra."}
              {" "}Colle l&apos;URL d&apos;une image (hébergée) + une légende.
            </>}>
            <div className="space-y-3">
              {profile.media.map((mk) => {
                const items = media.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === mk.key);
                return (
                  <div key={mk.key} className="rounded-[22px] p-4" style={{ background: "#FAF9FC" }}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{mk.label}</p>
                        <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{mk.hint}</p>
                      </div>
                      <Bouton variante="clair" icone={Plus} onClick={() => addMedia(mk.key)}>Ajouter</Bouton>
                    </div>
                    {items.length === 0 && <p className="mt-2 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Aucun élément.</p>}
                    {items.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <AnimatePresence initial={false}>
                          {items.map(({ x, i }) => (
                            <motion.div key={i} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={RESSORT}
                              className="flex flex-wrap items-center gap-2">
                              <input value={x.url} onChange={(e) => updMedia(i, { url: e.target.value })} placeholder="https://…/image.jpg"
                                className="ui-champ min-w-0 flex-[2_1_180px]" style={{ background: "#fff", width: "auto" }} />
                              <input value={x.caption || ""} onChange={(e) => updMedia(i, { caption: e.target.value })} placeholder="Légende (optionnel)"
                                className="ui-champ min-w-0 flex-[1_1_120px]" style={{ background: "#fff", width: "auto" }} />
                              {mk.multiple === false && items.length > 1 && <Pastille ton="rouge">1 seul autorisé</Pastille>}
                              <BoutonRond icone={Trash2} label="Supprimer" onClick={() => delMedia(i)} style={{ color: "#A63D28" }} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Bouton variante="encre" onClick={saveMedia} occupe={mediaBusy} disabled={mediaBusy}>
                {mediaBusy ? "Enregistrement…" : "Enregistrer les médias"}
              </Bouton>
              {mediaMsg && <span className="text-[13px]" style={{ color: mediaMsg.startsWith("✅") ? "#1E7A3A" : "#A63D28" }}>{mediaMsg}</span>}
            </div>
          </Section>
        </div>

        {/* ── Colonne des réglages, collée en haut ───────────────────────────── */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
          {/* ── Secteur & comportement (cran 2 : auto selon le secteur) ── */}
          <Section icone={Compass} titre="Secteur & comportement" rang={2}>
            <div className="flex flex-wrap items-center gap-2">
              <Pastille ton="violet">{profile.label}</Pastille>
              <Pastille ton="gris">Mode : {MODE_LABEL[profile.mode]}</Pastille>
              {profile.auto
                ? <Pastille ton="vert"><Check className="h-3 w-3" /> Comportement auto activé</Pastille>
                : <Pastille ton="ambre">Réglages recommandés</Pastille>}
            </div>
            <div className="mt-3 rounded-[20px] px-4 py-3" style={{ background: "#FAF9FC" }}>
              <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Message d&apos;accueil actuel</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink)" }}>
                « {profile.welcome.replace(/\{b\}/g, bizName || "votre boutique")} »
              </p>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
              Le secteur se règle dans les paramètres de l&apos;agent. {profile.auto ? "Ce secteur est validé : le bot fonctionne sans réglage supplémentaire." : "Configure tes médias ci-dessous pour enrichir la prospection."}
            </p>
          </Section>

          {/* ── Mode de conversion ── */}
          <Section icone={Target} titre="Mode de conversion" rang={3}
            texte="Où la vente se conclut. En mode WhatsApp, l'agent enregistre la commande dans la conversation et vous notifie ; le lien produit devient informatif.">
            <div className="grid gap-2" role="radiogroup" aria-label="Mode de conversion">
              {[
                { id: "whatsapp", t: "Conclure dans WhatsApp", d: "Panier + commande enregistrée. Recommandé si vous livrez et encaissez à la livraison." },
                { id: "boutique", t: "Renvoyer vers ma boutique", d: "Le lien produit reste l'action principale. Pour une boutique avec paiement en ligne." },
              ].map((o) => {
                const on = convMode === o.id;
                return (
                  <motion.button key={o.id} role="radio" aria-checked={on} onClick={() => saveConvMode(o.id)} disabled={convBusy}
                    whileTap={{ scale: 0.98 }} transition={RESSORT}
                    className="flex items-start gap-3 rounded-[22px] p-4 text-left transition-colors disabled:opacity-50"
                    style={{ background: on ? "#F7F4FF" : "#FAF9FC", boxShadow: on ? "inset 0 0 0 2px var(--cl-accent)" : "inset 0 0 0 1px var(--cl-line-soft)" }}>
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: on ? "var(--cl-accent)" : "#fff", boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--cl-line)", color: "#fff" }}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{o.t}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>{o.d}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </Section>

          {montreCatalogue && (
            <Section icone={Library} titre="Source du catalogue" rang={4}
              texte="Choisis ce que l'agent utilise pour répondre : le grand catalogue OFS (des milliers de produits) ou uniquement ton catalogue Camille natif.">
              <div className="flex items-center justify-between gap-3 rounded-[22px] p-4" style={{ background: "#FAF9FC" }}>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>
                    {bigOn ? "Grand catalogue OFS" : "Catalogue natif Camille"}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>
                    {bigOn ? "L'agent répond depuis le catalogue OFS en direct." : "L'agent répond uniquement depuis tes produits Camille."}
                  </p>
                </div>
                <Interrupteur actif={bigOn} onClick={() => toggleCatalog(!bigOn)} disabled={catBusy}
                  label="Activer ou désactiver le grand catalogue" />
              </div>
              {catMsg && <p className="mt-2 px-1 text-[12.5px]" style={{ color: "var(--cl-ink-soft)" }}>{catMsg}</p>}
            </Section>
          )}

          {isOfsOwner && (
            <Section icone={Images} titre="Recherche par image — vectorisation OFS" rang={5}
              texte="Indexe les images du catalogue OFS (CLIP) pour la recherche visuelle. « Nouveautés » ne traite que les produits pas encore indexés — rapide, à relancer après un ajout. « Tout réindexer » repart de zéro.">
              <div className="flex flex-wrap items-center gap-2">
                <Bouton variante="encre" onClick={() => runVec(true)} occupe={vecBusy} disabled={vecBusy}>
                  {vecBusy ? "En cours…" : "Vectoriser les nouveautés"}
                </Bouton>
                <Bouton variante="clair" onClick={() => runVec(false)} disabled={vecBusy}>Tout réindexer</Bouton>
                {vecTotal > 0 && <Pastille ton="violet">{vecTotal} vecteurs créés</Pastille>}
              </div>
              {vecLog && (
                <pre className="mt-3 max-h-52 overflow-auto rounded-[18px] p-4 text-[11.5px] leading-relaxed"
                  style={{ background: "#FAF9FC", color: "var(--cl-ink-soft)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{vecLog}</pre>
              )}
              <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
                Requiert <Code>OFS_SUPABASE_SERVICE_KEY</Code> et <Code>CLIP_SERVICE_URL</Code> côté serveur. Idéalement, planifie « nouveautés » toutes les 15 min.
              </p>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-full px-1.5 py-0.5 text-[11.5px]" style={{ background: "#F1EFF4", color: "var(--cl-ink)", overflowWrap: "anywhere" }}>{children}</code>
);

// ─────────────────────────────────────────────────────────────────────────────
// Cles d'API : le site du marchand devient un consommateur de l'API Camille.
// ─────────────────────────────────────────────────────────────────────────────
function ApiKeysSection({ agentId }: { agentId: string }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [fresh, setFresh] = useState<{ key: string; kind: string } | null>(null);
  const [origins, setOrigins] = useState("");
  const [creating, setCreating] = useState(false);
  const [exemples, setExemples] = useState(false);
  const { copie, copier } = useCopie();

  const load = useCallback(() => {
    fetch(`/api/agents/${agentId}/api-keys`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((d) => { setKeys(d.keys || []); setErr(d.error || ""); })
      .catch((e) => setErr(e.message));
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  async function create(kind: "public" | "secret") {
    setCreating(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          kind,
          label: kind === "public" ? "Site web — lecture" : "Site web — commandes",
          origins: origins.split(/[\s,]+/).map((o) => o.trim()).filter(Boolean),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Création impossible");
      setFresh({ key: d.key, kind });
      load();
    } catch (e) { setErr((e as Error).message); }
    finally { setCreating(false); }
  }

  async function revoke(id: string) {
    await fetch(`/api/agents/${agentId}/api-keys`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Section icone={KeyRound} titre="API — brancher le site du client" rang={2}
      texte={<>
        Le site appelle Camille comme n&apos;importe quelle API. Le catalogue reste saisi
        une seule fois, et les commandes du site arrivent au même endroit que celles
        de WhatsApp — avec le même accusé de réception au client.
      </>}>

      {err && <div className="mb-4"><Bandeau ton="rouge">{err}</Bandeau></div>}

      {/* La clé neuve : affichée une seule fois, jamais relue ensuite. */}
      <AnimatePresence>
        {fresh && (
          <motion.div key="fresh" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={RESSORT}
            className="mb-4 rounded-[22px] p-4" style={{ background: "#FDF1DC", color: "#9A6510" }}>
            <p className="text-[13.5px] font-semibold">
              Copie cette clé maintenant — elle ne sera plus jamais affichée.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded-[18px] bg-white px-4 py-2.5 font-mono text-[12.5px] leading-relaxed" style={{ color: "var(--cl-ink)", overflowWrap: "anywhere" }}>
                {fresh.key}
              </code>
              <BoutonRond icone={copie ? Check : Copy} label={copie ? "Copié" : "Copier la clé"} onClick={() => copier(fresh.key)} />
            </div>
            {fresh.kind === "secret" && (
              <p className="mt-2 text-[12.5px]">
                Clé secrète : à n&apos;utiliser que côté serveur. Jamais dans du code envoyé au navigateur.
              </p>
            )}
            <div className="mt-3">
              <Bouton variante="clair" icone={Check} onClick={() => setFresh(null)}>J&apos;ai copié</Bouton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <label className="block">
        <Etiquette>Domaines autorisés (un par ligne ou séparés par des virgules) — laisser vide pour tout autoriser</Etiquette>
        <textarea className="ui-champ" rows={2} value={origins}
          onChange={(e) => setOrigins(e.target.value)}
          placeholder="https://boutique-client.com" />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <Bouton variante="vert" icone={KeyRound} onClick={() => create("public")} disabled={creating}>
          Clé de lecture (catalogue)
        </Bouton>
        <Bouton variante="encre" icone={Lock} onClick={() => create("secret")} disabled={creating}>
          Clé secrète (commandes)
        </Bouton>
      </div>

      {keys.length > 0 && (
        <motion.div layout className="mt-5 space-y-2">
          {keys.map((k, i) => (
            <motion.div key={k.id} layout {...apparait(i)}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] px-4 py-3"
              style={{ background: "#FAF9FC", opacity: k.revoked_at ? 0.5 : 1 }}>
              <code className="rounded-full bg-white px-3 py-1 font-mono text-[12.5px]" style={{ color: "var(--cl-ink)", boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}>
                {k.key_prefix}…
              </code>
              <Pastille ton={k.kind === "secret" ? "violet" : "vert"}>
                {k.kind === "secret" ? "Secrète" : "Lecture"}
              </Pastille>
              <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                {k.label} · {k.calls_count} appel(s)
              </span>
              {k.revoked_at
                ? <Pastille ton="rouge">révoquée</Pastille>
                : <Bouton variante="danger" onClick={() => revoke(k.id)}>Révoquer</Bouton>}
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <LienBouton href="/docs" target="_blank" rel="noreferrer" variante="doux" icone={BookOpen} className="max-w-full">
          <span className="truncate">Documentation complète et testeur en direct</span>
        </LienBouton>
        <Bouton variante="doux" icone={Code2} aria-expanded={exemples} onClick={() => setExemples((v) => !v)}>
          Exemples de code
          <motion.span animate={{ rotate: exemples ? 180 : 0 }} transition={RESSORT} className="flex">
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </Bouton>
      </div>

      <AnimatePresence initial={false}>
        {exemples && (
          <motion.div key="exemples" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={RESSORT} className="overflow-hidden">
            <pre className="mt-3 overflow-auto rounded-[22px] p-4 text-[11.5px] leading-relaxed"
              style={{ background: "#FAF9FC", color: "var(--cl-ink-soft)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
{`// 1. Afficher le catalogue sur le site (cle de lecture, navigateur OK)
const r = await fetch("${base}/api/public/v1/catalog?limit=24", {
  headers: { "X-Camille-Key": "cam_pk_…" },
});
const { products } = await r.json();

// 2. Envoyer le panier a Camille (cle SECRETE, cote serveur uniquement)
await fetch("${base}/api/public/v1/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Camille-Key": "cam_sk_…" },
  body: JSON.stringify({
    items: [{ id: "<id produit Camille>", qty: 2 }],
    customer: { name: "Eman Soga", phone: "237699887766" },
    delivery: { address: "Bonaberi, face marche" },
  }),
});
// -> le client recoit son accuse sur WhatsApp,
//    la commande apparait dans l'app, le vendeur est notifie.

// 3. Mesurer le trafic du site (une balise a coller avant </body>)
// <script src="${base}/api/public/v1/track" data-key="cam_pk_..." defer></script>
// -> visiteurs, pages vues et taux de conversion dans l'onglet "Trafic du site".`}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
