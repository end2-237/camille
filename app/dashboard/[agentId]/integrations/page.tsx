"use client";

// Page Intégrations : plateformes compatibles + import de catalogue.
// - Montre TOUTES les plateformes (OFS actif, Shopify/WooCommerce bientôt, MCP dispo).
// - Pour OFS : connexion compte → import boutique / catalogue plateforme (CJ) / tout.

import { useState } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";
import { Store, ShoppingBag, Boxes, Plug, Check, Clock, Sparkles } from "lucide-react";

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
    </div>
  );
}
