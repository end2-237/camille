"use client";

// Page Intégrations : plateformes compatibles + import de catalogue.
// - Montre TOUTES les plateformes (OFS actif, Shopify/WooCommerce bientôt, MCP dispo).
// - Pour OFS : connexion compte → import boutique / catalogue plateforme (CJ) / tout.

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";
import { sectorProfile, type SectorMode } from "@/lib/sectorProfiles";
import { Store, ShoppingBag, Boxes, Plug, Check, Clock, Sparkles } from "lucide-react";

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
  const map = {
    active: { t: "Disponible", c: "#0e9d63", bg: "rgba(14,157,99,.1)", i: <Check className="w-3 h-3" /> },
    beta: { t: "Bêta", c: "#c77d0a", bg: "rgba(199,125,10,.1)", i: <Sparkles className="w-3 h-3" /> },
    soon: { t: "Bientôt", c: "#8a8790", bg: "rgba(138,135,144,.12)", i: <Clock className="w-3 h-3" /> },
  }[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: map.c, background: map.bg }}>
      {map.i}{map.t}
    </span>
  );
}

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

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold" style={{ color: "var(--cl-ink)" }}>Intégrations</h1>
        <p className="text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>
          Connecte une plateforme pour importer ou lier ton catalogue. Voici ce qui est compatible :
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PLATFORMS.map((p) => (
          <div key={p.key} className="rounded-xl p-4" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: p.accent }}>{p.icon}</span>
                <div>
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>{p.name}</div>
                  <Badge status={p.status} />
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[12px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>{p.desc}</p>

            {p.key === "ofs" && p.status === "active" && (
              <button onClick={() => setOpen(open === "ofs" ? null : "ofs")} className="mt-3 w-full rounded-lg py-2 text-[12.5px] font-semibold text-white" style={{ background: p.accent }}>
                {open === "ofs" ? "Fermer" : "Connecter OFS"}
              </button>
            )}
            {p.key === "mcp" && (
              <a href="https://github.com/end2-237/camille/tree/main/camille-mcp" target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center rounded-lg py-2 text-[12.5px] font-semibold" style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink)" }}>
                Voir la configuration MCP
              </a>
            )}
            {p.status === "soon" && (
              <div className="mt-3 rounded-lg py-2 text-center text-[12px]" style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink-faint)" }}>Disponible bientôt</div>
            )}
          </div>
        ))}
      </div>

      {open === "ofs" && (
        <div className="mt-5 rounded-xl p-4 sm:p-5" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
          <div className="mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4" style={{ color: "#0e9d63" }} />
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Importer depuis OFS</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px]" style={{ color: "var(--cl-ink-soft)" }}>
              Email du compte OFS
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 w-full rounded-lg px-3 py-2 text-[13px]" style={{ border: "1px solid var(--cl-line)" }} placeholder="toi@exemple.com" />
            </label>
            <label className="text-[12px]" style={{ color: "var(--cl-ink-soft)" }}>
              Mot de passe OFS
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-1 w-full rounded-lg px-3 py-2 text-[13px]" style={{ border: "1px solid var(--cl-line)" }} placeholder="••••••••" />
            </label>
          </div>
          <div className="mt-3">
            <div className="mb-1.5 text-[12px]" style={{ color: "var(--cl-ink-soft)" }}>Quoi importer ?</div>
            <div className="flex flex-wrap gap-2">
              {([
                { v: "shop", l: "Ma boutique" },
                { v: "cj", l: "Catalogue plateforme (CJ)" },
                { v: "all", l: "Tout (super-admin)" },
              ] as const).map((o) => (
                <button key={o.v} onClick={() => setMode(o.v)} className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                  style={mode === o.v ? { background: "#0e9d63", color: "#fff" } : { border: "1px solid var(--cl-line)", color: "var(--cl-ink-soft)" }}>
                  {o.l}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>
              « Catalogue plateforme (CJ) » et « Tout » nécessitent un compte super-admin OFS.
            </p>
          </div>
          <button onClick={importOfs} disabled={busy || !email || !password} className="mt-4 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: "#0e9d63" }}>
            {busy ? "Import en cours…" : "Importer le catalogue"}
          </button>
          {msg && (
            <div className="mt-3 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: msg.ok ? "rgba(14,157,99,.08)" : "rgba(214,69,69,.08)", color: msg.ok ? "#0b7a4b" : "#c0392b" }}>
              {msg.text}
            </div>
          )}
          <p className="mt-3 text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>
            🔒 Tes identifiants OFS servent uniquement à lire ton catalogue (connexion directe à OFS) et ne sont pas stockés.
          </p>
        </div>
      )}

      {/* ── Secteur & comportement (cran 2 : auto selon le secteur) ── */}
      <div className="mt-5 rounded-xl p-4 sm:p-5" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: "#0e9d63" }}>🧭</span>
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Secteur & comportement</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="rounded-full px-2.5 py-1 font-medium" style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink)" }}>{profile.label}</span>
          <span className="rounded-full px-2.5 py-1" style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink-soft)" }}>Mode : {MODE_LABEL[profile.mode]}</span>
          {profile.auto
            ? <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold" style={{ background: "rgba(14,157,99,.1)", color: "#0b7a4b" }}><Check className="h-3 w-3" /> Comportement auto activé</span>
            : <span className="rounded-full px-2.5 py-1" style={{ background: "rgba(199,125,10,.1)", color: "#a56b0a" }}>Réglages recommandés</span>}
        </div>
        <p className="mt-2 text-[12px]" style={{ color: "var(--cl-ink-soft)" }}>
          Message d'accueil actuel : <span style={{ color: "var(--cl-ink)" }}>« {profile.welcome.replace(/\{b\}/g, bizName || "votre boutique")} »</span>
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>
          Le secteur se règle dans les paramètres de l'agent. {profile.auto ? "Ce secteur est validé : le bot fonctionne sans réglage supplémentaire." : "Configure tes médias ci-dessous pour enrichir la prospection."}
        </p>
      </div>

      {/* ── Médias de prospection (cran 3 : flyers, galeries, fiches services) ── */}
      <div className="mt-5 rounded-xl p-4 sm:p-5" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: "#2563eb" }}>📎</span>
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Médias de prospection WhatsApp</h2>
        </div>
        <p className="text-[12px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>
          {profile.mode === "catalogue"
            ? "Ajoute des flyers/promos ; ton catalogue produits reste la source principale."
            : "Ton activité repose sur des prestations : ajoute ici flyers, galerie de réalisations et fiches de services que le bot enverra."}
          {" "}Colle l'URL d'une image (hébergée) + une légende.
        </p>

        <div className="mt-3 space-y-4">
          {profile.media.map((mk) => {
            const items = media.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === mk.key);
            return (
              <div key={mk.key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div>
                    <span className="text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>{mk.label}</span>
                    <span className="ml-2 text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>{mk.hint}</span>
                  </div>
                  <button onClick={() => addMedia(mk.key)} className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold" style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink)" }}>+ Ajouter</button>
                </div>
                {items.length === 0 && <div className="text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>Aucun élément.</div>}
                <div className="space-y-2">
                  {items.map(({ x, i }) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input value={x.url} onChange={(e) => updMedia(i, { url: e.target.value })} placeholder="https://…/image.jpg" className="min-w-[180px] flex-1 rounded-lg px-2.5 py-1.5 text-[12px]" style={{ border: "1px solid var(--cl-line)" }} />
                      <input value={x.caption || ""} onChange={(e) => updMedia(i, { caption: e.target.value })} placeholder="Légende (optionnel)" className="min-w-[120px] flex-1 rounded-lg px-2.5 py-1.5 text-[12px]" style={{ border: "1px solid var(--cl-line)" }} />
                      {mk.multiple === false && items.length > 1 && <span className="text-[10px]" style={{ color: "#c0392b" }}>1 seul autorisé</span>}
                      <button onClick={() => delMedia(i)} className="rounded-lg px-2 py-1 text-[11px]" style={{ border: "1px solid var(--cl-line)", color: "#c0392b" }}>Suppr.</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveMedia} disabled={mediaBusy} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: "#2563eb" }}>
            {mediaBusy ? "Enregistrement…" : "Enregistrer les médias"}
          </button>
          {mediaMsg && <span className="text-[12px]" style={{ color: mediaMsg.startsWith("✅") ? "#0b7a4b" : "#c0392b" }}>{mediaMsg}</span>}
        </div>
      </div>

      <div className="mt-5 rounded-xl p-4 sm:p-5" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: "#101012" }}>🎯</span>
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Mode de conversion</h2>
        </div>
        <p className="mb-3 text-[12px]" style={{ color: "var(--cl-sub)" }}>
          Où la vente se conclut. En mode WhatsApp, l&apos;agent enregistre la commande dans la conversation
          et vous notifie ; le lien produit devient informatif.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { id: "whatsapp", t: "Conclure dans WhatsApp", d: "Panier + commande enregistrée. Recommandé si vous livrez et encaissez à la livraison." },
            { id: "boutique", t: "Renvoyer vers ma boutique", d: "Le lien produit reste l'action principale. Pour une boutique avec paiement en ligne." },
          ].map((o) => {
            const on = convMode === o.id;
            return (
              <button key={o.id} onClick={() => saveConvMode(o.id)} disabled={convBusy}
                className="rounded-lg p-3 text-left transition disabled:opacity-50"
                style={{ border: on ? "2px solid #0e9d63" : "1px solid var(--cl-line)", background: on ? "#F2FBF7" : "#fff" }}>
                <div className="text-[13px] font-semibold" style={{ color: "var(--cl-ink)" }}>
                  {on ? "✓ " : ""}{o.t}
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: "var(--cl-sub)" }}>{o.d}</div>
              </button>
            );
          })}
        </div>
      </div>

      {(isOfsOwner || catSrc === "ofs_cj" || catSrc === "ofs_shop") && (() => {
        // null = non configuré ; pour l'agent OFS désigné le grand catalogue était actif par défaut
        const bigOn = catSrc === "ofs_cj" || catSrc === "ofs_shop" || (catSrc === null && isOfsOwner);
        return (
          <div className="mt-5 rounded-xl p-4 sm:p-5" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
            <div className="mb-1 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: "#0e9d63" }}>🗂️</span>
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Source du catalogue</h2>
            </div>
            <p className="mb-3 text-[12px]" style={{ color: "var(--cl-sub)" }}>
              Choisis ce que l&apos;agent utilise pour répondre : le grand catalogue OFS (des milliers de produits)
              ou uniquement ton catalogue Camille natif.
            </p>

            <div className="flex items-center justify-between rounded-lg p-3" style={{ background: "#f7f7f8", border: "1px solid var(--cl-line)" }}>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--cl-ink)" }}>
                  {bigOn ? "Grand catalogue OFS" : "Catalogue natif Camille"}
                </div>
                <div className="text-[11px]" style={{ color: "var(--cl-sub)" }}>
                  {bigOn ? "L'agent répond depuis le catalogue OFS en direct." : "L'agent répond uniquement depuis tes produits Camille."}
                </div>
              </div>
              <button
                onClick={() => toggleCatalog(!bigOn)}
                disabled={catBusy}
                aria-label="Activer ou désactiver le grand catalogue"
                className="relative h-7 w-12 rounded-full transition-colors disabled:opacity-50"
                style={{ background: bigOn ? "#0e9d63" : "#cbd5e1" }}
              >
                <span
                  className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
                  style={{ left: bigOn ? 26 : 4 }}
                />
              </button>
            </div>
            {catMsg && <div className="mt-2 text-[12px]" style={{ color: "var(--cl-sub)" }}>{catMsg}</div>}
          </div>
        );
      })()}

      {isOfsOwner && (
        <div className="mt-5 rounded-xl p-4 sm:p-5" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: "#6d28d9" }}>🖼️</span>
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>Recherche par image — vectorisation OFS</h2>
          </div>
          <p className="text-[12px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>
            Indexe les images du catalogue OFS (CLIP) pour la recherche visuelle. « Nouveautés » ne traite que les produits
            pas encore indexés — rapide, à relancer après un ajout. « Tout réindexer » repart de zéro.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => runVec(true)} disabled={vecBusy} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: "#6d28d9" }}>
              {vecBusy ? "En cours…" : "Vectoriser les nouveautés"}
            </button>
            <button onClick={() => runVec(false)} disabled={vecBusy} className="rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-50" style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink)" }}>
              Tout réindexer
            </button>
            {vecTotal > 0 && <span className="self-center text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>{vecTotal} vecteurs créés</span>}
          </div>
          {vecLog && (
            <pre className="mt-3 max-h-52 overflow-auto rounded-lg p-3 text-[11px] leading-relaxed" style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink-soft)", whiteSpace: "pre-wrap" }}>{vecLog}</pre>
          )}
          <p className="mt-2 text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>
            Requiert <code>OFS_SUPABASE_SERVICE_KEY</code> et <code>CLIP_SERVICE_URL</code> côté serveur. Idéalement, planifie « nouveautés » toutes les 15 min.
          </p>
        </div>
      )}

      <ApiKeysSection agentId={agentId} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cles d'API : le site du marchand devient un consommateur de l'API Camille.
// ─────────────────────────────────────────────────────────────────────────────
function ApiKeysSection({ agentId }: { agentId: string }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [fresh, setFresh] = useState<{ key: string; kind: string } | null>(null);
  const [origins, setOrigins] = useState("");
  const [creating, setCreating] = useState(false);

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
    <div className="mt-6 rounded-xl p-4" style={{ border: "1px solid var(--cl-line)", background: "#fff" }}>
      <h2 className="text-[14px] font-semibold" style={{ color: "var(--cl-ink)" }}>API — brancher le site du client</h2>
      <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--cl-ink-soft)" }}>
        Le site appelle Camille comme n&apos;importe quelle API. Le catalogue reste saisi
        une seule fois, et les commandes du site arrivent au même endroit que celles
        de WhatsApp — avec le même accusé de réception au client.
      </p>

      {err && (
        <div className="mt-3 rounded-lg p-3 text-[12.5px]" style={{ background: "#FDECEC", color: "#c0392b" }}>{err}</div>
      )}

      {fresh && (
        <div className="mt-3 rounded-lg p-3" style={{ background: "#FDF7E7", border: "1px solid #F3D5A5" }}>
          <div className="text-[12.5px] font-semibold" style={{ color: "#8A5A00" }}>
            Copie cette clé maintenant — elle ne sera plus jamais affichée.
          </div>
          <code className="mt-2 block break-all rounded p-2 text-[12px]" style={{ background: "#fff" }}>{fresh.key}</code>
          {fresh.kind === "secret" && (
            <div className="mt-2 text-[11.5px]" style={{ color: "#8A5A00" }}>
              Clé secrète : à n&apos;utiliser que côté serveur. Jamais dans du code envoyé au navigateur.
            </div>
          )}
          <button onClick={() => setFresh(null)} className="mt-2 text-[12px] underline" style={{ color: "var(--cl-ink-soft)" }}>
            J&apos;ai copié
          </button>
        </div>
      )}

      <label className="mt-4 block text-[11.5px] font-medium" style={{ color: "var(--cl-ink-soft)" }}>
        Domaines autorisés (un par ligne ou séparés par des virgules) — laisser vide pour tout autoriser
      </label>
      <textarea className="input-midnight mt-1" rows={2} value={origins}
        onChange={(e) => setOrigins(e.target.value)}
        placeholder="https://boutique-client.com" />

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => create("public")} disabled={creating}
          className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50" style={{ background: "#0e9d63" }}>
          Clé de lecture (catalogue)
        </button>
        <button onClick={() => create("secret")} disabled={creating}
          className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50" style={{ background: "#101012" }}>
          Clé secrète (commandes)
        </button>
      </div>

      {keys.length > 0 && (
        <div className="mt-4 space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-lg p-2.5"
              style={{ background: "var(--cl-bg-soft)", opacity: k.revoked_at ? 0.5 : 1 }}>
              <code className="text-[12px]" style={{ color: "var(--cl-ink)" }}>{k.key_prefix}…</code>
              <span className="rounded px-2 py-0.5 text-[10.5px] font-semibold"
                style={{ background: k.kind === "secret" ? "#101012" : "#E4F8EC", color: k.kind === "secret" ? "#fff" : "#0e6b45" }}>
                {k.kind === "secret" ? "SECRÈTE" : "LECTURE"}
              </span>
              <span className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                {k.label} · {k.calls_count} appel(s)
              </span>
              <div className="flex-1" />
              {k.revoked_at
                ? <span className="text-[11.5px]" style={{ color: "#c0392b" }}>révoquée</span>
                : <button onClick={() => revoke(k.id)} className="text-[11.5px] underline" style={{ color: "#c0392b" }}>Révoquer</button>}
            </div>
          ))}
        </div>
      )}

      <a href="/docs" target="_blank" rel="noreferrer"
        className="mt-4 inline-block text-[12.5px] font-semibold underline" style={{ color: "var(--cl-ink)" }}>
        Documentation complète et testeur en direct →
      </a>

      <details className="mt-4">
        <summary className="cursor-pointer text-[12.5px] font-semibold" style={{ color: "var(--cl-ink)" }}>
          Exemples de code
        </summary>
        <pre className="mt-2 overflow-auto rounded-lg p-3 text-[11px] leading-relaxed"
          style={{ background: "var(--cl-bg-soft)", color: "var(--cl-ink-soft)", whiteSpace: "pre-wrap" }}>
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
//    la commande apparait dans l'app, le vendeur est notifie.`}
        </pre>
      </details>
    </div>
  );
}
