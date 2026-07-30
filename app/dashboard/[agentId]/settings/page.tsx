"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Save, RefreshCw, Bot, ShoppingBag, CreditCard, MapPin, MessageSquare, Lock } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { getMaxLevel } from "@/lib/plans";

interface Cfg {
  level: number;
  plan: string;
  out_of_scope_behavior: "site" | "human";
  welcome_enabled: boolean;
  welcome_message: string | null;
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
  sector: string;
  delivery_enabled: boolean;
  delivery_fee: number;
  /** Barème saisi en texte : "Bonaberi = 2000" par ligne. */
  delivery_zones_text: string;
  menu_image_url: string | null;
}

const LEVELS = [
  { v: 1, label: "Niveau 1 — Support",   desc: "Répond, informe, redirige. Pas de catalogue.",         icon: Bot },
  { v: 2, label: "Niveau 2 — Catalogue", desc: "Présente les produits, prix, photos, albums.",          icon: ShoppingBag },
  { v: 3, label: "Niveau 3 — Closing",   desc: "Vente + paiement Monetbil (bientôt).",                  icon: CreditCard },
];

/** "Bonaberi = 2000" par ligne → [{zone, fee}]. Les lignes vides sont ignorées. */
function parseZones(text: string): { zone: string; fee: number }[] {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.+?)\s*[=:]\s*(\d+)/);
      return m ? { zone: m[1].trim(), fee: Number(m[2]) } : null;
    })
    .filter((x): x is { zone: string; fee: number } => !!x && !!x.zone);
}

/** Inverse de parseZones, pour réafficher le barème. */
function zonesToText(zones: unknown): string {
  let arr: { zone?: string; name?: string; fee?: number; price?: number }[] = [];
  try { arr = Array.isArray(zones) ? zones : JSON.parse(String(zones || "[]")); } catch { arr = []; }
  return arr.map((z) => `${z.zone ?? z.name ?? ""} = ${z.fee ?? z.price ?? 0}`).join("\n");
}

export default function AgentSettingsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regen, setRegen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // La carte du menu est propre à la restauration.
  const isResto = /resto|restaurant|food|cuisine|snack|fast|pizz|traiteur|patisser|boulanger|glacier/i
    .test(String(cfg?.sector ?? ""));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agents/${agentId}`, { headers: { ...authHeaders() } });
      const d = await r.json();
      const ag = d.agent ?? d;
      setCfg({
        level: ag.level ?? 1,
        plan: ag.plan ?? "free",
        out_of_scope_behavior: ag.out_of_scope_behavior ?? "site",
        welcome_enabled: ag.welcome_enabled !== false,
        welcome_message: ag.welcome_message ?? "",
        website_url: ag.business_context?.website_url ?? ag.website_url ?? "",
        latitude: ag.latitude ?? null,
        longitude: ag.longitude ?? null,
        sector: ag.business_context?.sector ?? ag.sector ?? "",
        delivery_enabled: ag.delivery_enabled !== false,
        delivery_fee: ag.delivery_fee ?? 1000,
        // Le barème est stocké en JSON mais s'édite en texte : une ligne par
        // quartier est plus rapide à saisir qu'un tableau de champs.
        delivery_zones_text: zonesToText(ag.delivery_zones),
        menu_image_url: ag.menu_image_url ?? "",
      });
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  // On reutilise la route d'upload des images produit : meme stockage, meme
  // controle de taille et de format. Pas de second chemin a maintenir.
  async function uploadMenu(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/agents/${agentId}/products/upload`, {
        method: "POST",
        headers: { ...authHeaders() },
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error || "Envoi impossible");
      setCfg((p) => (p ? { ...p, menu_image_url: d.url } : p));
      toast.success("Carte envoyée — pense à enregistrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setUploading(false); }
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          level: cfg.level,
          out_of_scope_behavior: cfg.out_of_scope_behavior,
          welcome_enabled: cfg.welcome_enabled,
          welcome_message: (cfg.welcome_message ?? "").trim() || null,
          latitude: cfg.latitude === null || cfg.latitude === undefined ? null : Number(cfg.latitude),
          longitude: cfg.longitude === null || cfg.longitude === undefined ? null : Number(cfg.longitude),
          business_context: { website_url: (cfg.website_url ?? "").trim() },
          delivery_enabled: cfg.delivery_enabled !== false,
          delivery_fee: Number(cfg.delivery_fee ?? 1000) || 0,
          delivery_zones: parseZones(cfg.delivery_zones_text ?? ""),
          menu_image_url: (cfg.menu_image_url ?? "").trim() || null,
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Échec"); }
      toast.success("Configuration enregistrée");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement"); }
    finally { setSaving(false); }
  }

  async function regenerate() {
    setRegen(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/regenerate-prompt`, {
        method: "POST", headers: { ...authHeaders() },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Prompt régénéré (niveau ${d.level})`);
    } catch { toast.error("Échec de la régénération"); }
    finally { setRegen(false); }
  }

  if (loading || !cfg) {
    return <div className="p-8 text-[13px]" style={{ color: "var(--text-tertiary)" }}>Chargement…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>
        Configuration de l&apos;agent
      </h1>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Niveau d&apos;automatisation, accueil, comportement et localisation.
      </p>

      {/* Niveau */}
      <Section title="Niveau d'automatisation">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {LEVELS.map((l) => {
            const active = cfg.level === l.v;
            const maxLevel = getMaxLevel(cfg.plan);
            const locked = l.v > maxLevel;
            return (
              <button
                key={l.v}
                disabled={locked}
                onClick={() => !locked && setCfg({ ...cfg, level: l.v })}
                className="relative flex flex-col items-start gap-1.5 rounded-xl p-3.5 text-left transition-all disabled:cursor-not-allowed"
                style={{
                  border: `1.5px solid ${active ? "var(--color-gold)" : "var(--border-default)"}`,
                  background: active ? "var(--surface-gold)" : "var(--bg-elevated)",
                  opacity: locked ? 0.55 : 1,
                }}
              >
                {locked && (
                  <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase" style={{ color: "var(--text-disabled)" }}>
                    <Lock className="h-3 w-3" /> Plan requis
                  </span>
                )}
                <l.icon className="h-4 w-4" style={{ color: active ? "var(--color-gold)" : "var(--text-tertiary)" }} />
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{l.label}</span>
                <span className="text-[11px] leading-snug" style={{ color: "var(--text-tertiary)" }}>{l.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
          Plan actuel : <b style={{ color: "var(--text-secondary)" }}>{cfg.plan}</b> — débloque jusqu&apos;au niveau {getMaxLevel(cfg.plan)}.
          {getMaxLevel(cfg.plan) < 3 && <> Passez à un plan supérieur pour les niveaux avancés.</>}
        </p>
      </Section>

      {/* Accueil */}
      <Section title="Message d'accueil" icon={MessageSquare}>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={cfg.welcome_enabled} onChange={(e) => setCfg({ ...cfg, welcome_enabled: e.target.checked })} />
          Accueillir automatiquement les nouveaux contacts
        </label>
        {cfg.welcome_enabled && (
          <textarea
            className="input-midnight mt-3" rows={2}
            value={cfg.welcome_message ?? ""}
            onChange={(e) => setCfg({ ...cfg, welcome_message: e.target.value })}
            placeholder="Laisse vide pour le message par défaut, ou personnalise : « Bonjour et bienvenue chez… »"
          />
        )}
      </Section>

      {/* Hors-scope */}
      <Section title="Hors de son périmètre">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {[
            { v: "site" as const,  t: "Rediriger vers le site", d: "« Rendez-vous sur notre site »" },
            { v: "human" as const, t: "Passer à un humain",     d: "« Je transmets à un conseiller »" },
          ].map((o) => {
            const active = cfg.out_of_scope_behavior === o.v;
            return (
              <button key={o.v} onClick={() => setCfg({ ...cfg, out_of_scope_behavior: o.v })}
                className="rounded-xl p-3 text-left transition-all"
                style={{ border: `1.5px solid ${active ? "var(--color-gold)" : "var(--border-default)"}`, background: active ? "var(--surface-gold)" : "var(--bg-elevated)" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{o.t}</p>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{o.d}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Site + géo */}
      <Section title="Site & localisation" icon={MapPin}>
        <label className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>Site web</label>
        <input className="input-midnight" value={cfg.website_url ?? ""} onChange={(e) => setCfg({ ...cfg, website_url: e.target.value })} placeholder="https://votre-site.com" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>Latitude</label>
            <input className="input-midnight" type="number" step="0.000001" value={cfg.latitude ?? ""} onChange={(e) => setCfg({ ...cfg, latitude: e.target.value === "" ? null : Number(e.target.value) })} placeholder="4.0511" />
          </div>
          <div>
            <label className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>Longitude</label>
            <input className="input-midnight" type="number" step="0.000001" value={cfg.longitude ?? ""} onChange={(e) => setCfg({ ...cfg, longitude: e.target.value === "" ? null : Number(e.target.value) })} placeholder="9.7679" />
          </div>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
          Coordonnées de la boutique (pour l&apos;envoi de la localisation sur WhatsApp).
        </p>
      </Section>

      {/* Livraison */}
      <Section title="Livraison" icon={MapPin}>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={cfg.delivery_enabled !== false}
            onChange={(e) => setCfg({ ...cfg, delivery_enabled: e.target.checked })} />
          Facturer des frais de livraison
        </label>

        <div className="mt-3">
          <label className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Frais par défaut (XAF)
          </label>
          <input className="input-midnight" type="number" min="0" step="50"
            value={cfg.delivery_fee ?? 1000}
            onChange={(e) => setCfg({ ...cfg, delivery_fee: e.target.value === "" ? 0 : Number(e.target.value) })} />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Tarifs par quartier — une ligne par zone
          </label>
          <textarea className="input-midnight" rows={5}
            value={cfg.delivery_zones_text ?? ""}
            onChange={(e) => setCfg({ ...cfg, delivery_zones_text: e.target.value })}
            placeholder={"Bonaberi = 2000\nAkwa = 500\nBonamoussadi = 1500"} />
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
            Le quartier est cherché dans l&apos;adresse du client. Sans correspondance,
            les frais par défaut s&apos;appliquent. Aucun frais sur place ou à emporter.
          </p>
        </div>
      </Section>

      {/* Carte du menu — restauration uniquement */}
      {isResto && (
        <Section title="Carte du menu" icon={MapPin}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-ghost cursor-pointer">
              {uploading ? "Envoi…" : cfg.menu_image_url ? "Remplacer l'image" : "Choisir une image"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMenu(f); e.target.value = ""; }} />
            </label>
            {cfg.menu_image_url && (
              <button type="button" className="text-[12px] underline"
                style={{ color: "var(--text-disabled)" }}
                onClick={() => setCfg({ ...cfg, menu_image_url: "" })}>
                Retirer
              </button>
            )}
          </div>
          <label className="mb-1 mt-3 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
            …ou coller une URL
          </label>
          <input className="input-midnight" value={cfg.menu_image_url ?? ""}
            onChange={(e) => setCfg({ ...cfg, menu_image_url: e.target.value })}
            placeholder="https://…/carte.jpg" />
          {cfg.menu_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.menu_image_url} alt="Carte du menu" className="mt-3 w-full rounded-lg"
              style={{ maxHeight: 260, objectFit: "cover" }} />
          ) : null}
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
            Envoyée au client juste après les premiers plats, quand il demande le menu.
          </p>
        </Section>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-gold disabled:opacity-60">
          <Save className="h-3.5 w-3.5" /> {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button onClick={regenerate} disabled={regen} className="btn-ghost disabled:opacity-60">
          <RefreshCw className={"h-3.5 w-3.5 " + (regen ? "animate-spin" : "")} /> {regen ? "Régénération…" : "Régénérer le prompt IA"}
        </button>
        <span className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
          Régénère le cerveau de l&apos;agent selon le niveau et la config ci-dessus.
        </span>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />}
        <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}
