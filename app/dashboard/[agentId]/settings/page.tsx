"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Save, RefreshCw, Bot, ShoppingBag, CreditCard, MapPin, MessageSquare, Lock, FileText, LocateFixed, Check } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { getMaxLevel } from "@/lib/plans";
import BonPreview, { MODELES } from "@/components/BonPreview";

/**
 * Identité imprimée en tête et en pied de chaque bon de commande.
 * Les mêmes champs que l'écran mobile : un vendeur qui règle son document
 * depuis son téléphone doit retrouver exactement ce réglage sur son ordinateur.
 */
interface DocSettings {
  name: string; tagline: string; address: string; phone: string;
  email: string; rccm: string; niu: string; logo_url: string; color: string;
  /** Habillage : modèle, filets du tableau, alternance des lignes, bandeau. */
  template: string; lines: string; zebra: boolean; banner_url: string;
}

const DOC_VIDE: DocSettings = {
  name: "", tagline: "", address: "", phone: "",
  email: "", rccm: "", niu: "", logo_url: "", color: "",
  template: "classique", lines: "", zebra: true, banner_url: "",
};

/** Raccourcis de teinte. N'importe quel code hexadécimal reste saisissable. */
const TEINTES = ["#DD5509", "#101012", "#1D4ED8", "#047857", "#B91C1C", "#7C3AED"];

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
  doc: DocSettings;
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [locating, setLocating] = useState(false);

  /** Modifie un seul champ du bon de commande. */
  const setDoc = (k: keyof DocSettings, v: string | boolean) =>
    setCfg((p) => (p ? { ...p, doc: { ...p.doc, [k]: v } } : p));

  // La carte du menu est propre à la restauration.
  const isResto = /resto|restaurant|food|cuisine|snack|fast|pizz|traiteur|patisser|boulanger|glacier/i
    .test(String(cfg?.sector ?? ""));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agents/${agentId}`, { headers: { ...authHeaders() } });
      const d = await r.json();
      const ag = d.agent ?? d;
      const bc = ag.business_context ?? {};
      const ds = (ag.doc_settings ?? {}) as Partial<DocSettings>;
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
        // Préremplissage : ce que le vendeur a déjà renseigné pour son agent
        // vaut mieux qu'un formulaire vide qu'il faudrait ressaisir.
        doc: {
          ...DOC_VIDE,
          ...ds,
          name:    ds.name    || bc.business_name   || "",
          address: ds.address || bc.location        || "",
          phone:   ds.phone   || bc.whatsapp_number || "",
          email:   ds.email   || bc.owner_email     || "",
        },
      });
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  // On reutilise la route d'upload des images produit : meme stockage, meme
  // controle de taille et de format. Pas de second chemin a maintenir.
  async function uploadAgentImage(file: File, kind: "menu" | "logo" | "banner"): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const r = await fetch(`/api/agents/${agentId}/products/upload`, {
      method: "POST",
      headers: { ...authHeaders() },
      body: fd,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || "Envoi impossible");
    return d.url as string;
  }

  async function uploadMenu(file: File) {
    setUploading(true);
    try {
      const url = await uploadAgentImage(file, "menu");
      setCfg((p) => (p ? { ...p, menu_image_url: url } : p));
      toast.success("Carte envoyée — pense à enregistrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setUploading(false); }
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      // Posé dans le formulaire seulement : c'est « Enregistrer » qui valide,
      // comme pour les autres champs du bon de commande.
      setDoc("logo_url", await uploadAgentImage(file, "logo"));
      toast.success("Logo envoyé — pense à enregistrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLogoUploading(false); }
  }

  async function uploadBanner(file: File) {
    setBannerUploading(true);
    try {
      setDoc("banner_url", await uploadAgentImage(file, "banner"));
      toast.success("Bandeau envoyé — pense à enregistrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBannerUploading(false); }
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
          // Les champs vides ne sont pas enregistrés. Pour l'habillage, une clé
          // absente retombe sur le modèle choisi ; pour l'identité, elle ne
          // retombe sur rien — un champ vide reste vide sur le document, il
          // n'emprunte pas les mentions légales de la plateforme.
          doc_settings: Object.fromEntries(
            Object.entries(cfg.doc).filter(([, v]) => String(v ?? "").trim() !== "")
          ),
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Échec"); }
      toast.success("Configuration enregistrée");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement"); }
    finally { setSaving(false); }
  }

  /**
   * Relève la position depuis le navigateur, comme le bouton « Je suis dans ma
   * boutique » du mobile. Pas de géocodage inverse ici : le navigateur n'en
   * fournit pas, et l'adresse lisible se saisit juste au-dessus. Ce sont les
   * coordonnées qui guident le client jusqu'à la porte.
   */
  function detecterPosition() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Ce navigateur ne sait pas relever la position.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCfg((p) => (p ? {
          ...p,
          latitude:  Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        } : p));
        setLocating(false);
        toast.success("Position relevée — pense à enregistrer");
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Autorisation refusée. Tu peux saisir les coordonnées à la main."
            : "Position introuvable. Réessaie depuis la boutique."
        );
      },
      // Haute précision : on relève une devanture, pas une ville.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={detecterPosition} disabled={locating} className="btn-ghost disabled:opacity-60">
            <LocateFixed className={"h-3.5 w-3.5 " + (locating ? "animate-pulse" : "")} />
            {locating ? "Relevé en cours…" : "Je suis dans ma boutique"}
          </button>
          {cfg.latitude != null && cfg.longitude != null && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: "#1E7B32" }}>
              <Check className="h-3.5 w-3.5" />
              Position enregistrée · {cfg.latitude}, {cfg.longitude}
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
          Coordonnées de la boutique : c&apos;est ce que l&apos;agent envoie au client
          qui demande où te trouver, et l&apos;adresse du bon de commande.
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

      {/* Mon bon de commande — mêmes champs que l'écran mobile.
          Le document partait au nom d'une seule entreprise pour tout le monde :
          chaque vendeur envoyait à SES clients un bon portant le nom et le RCCM
          d'un tiers. */}
      <Section title="Mon bon de commande" icon={FileText}>
        <p className="mb-3 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Ces informations s&apos;impriment en haut et en bas de chaque bon de commande
          envoyé à tes clients. Les champs laissés vides sont simplement omis.
        </p>

        <SubTitle>Entreprise</SubTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de l'entreprise" value={cfg.doc.name} onChange={(v) => setDoc("name", v)} placeholder="Ex. Chez Mama Ngo" />
          <Field label="Accroche (facultatif)" value={cfg.doc.tagline} onChange={(v) => setDoc("tagline", v)} placeholder="Ex. Restaurant traditionnel" />
          <Field label="Adresse" value={cfg.doc.address} onChange={(v) => setDoc("address", v)} placeholder="Ex. Bonamoussadi, Douala" />
          <Field label="Téléphone" value={cfg.doc.phone} onChange={(v) => setDoc("phone", v)} placeholder="Ex. (+237) 6 99 00 00 00" />
          <Field label="Courriel (facultatif)" value={cfg.doc.email} onChange={(v) => setDoc("email", v)} type="email" placeholder="contact@exemple.cm" />
        </div>

        <SubTitle className="mt-4">Mentions légales</SubTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="RCCM (facultatif)" value={cfg.doc.rccm} onChange={(v) => setDoc("rccm", v)} placeholder="RC/DLA/2020/B/1234" />
          <Field label="NIU (facultatif)" value={cfg.doc.niu} onChange={(v) => setDoc("niu", v)} placeholder="M0123456789012A" />
        </div>

        <SubTitle className="mt-4">Apparence</SubTitle>
        <label className="mb-1.5 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          Logo (facultatif)
        </label>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {cfg.doc.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- média hébergé par camille-core, hors domaines Next
            <img
              src={cfg.doc.logo_url}
              alt="Logo du bon de commande"
              className="h-14 w-14 rounded-lg object-contain"
              style={{ background: "var(--surface-raised)" }}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg"
              style={{ background: "var(--surface-raised)", color: "var(--text-disabled)" }}>
              <FileText size={18} />
            </div>
          )}

          <label className="btn-ghost cursor-pointer">
            {logoUploading ? "Envoi…" : cfg.doc.logo_url ? "Remplacer" : "Choisir une image"}
            <input type="file" accept="image/*" className="hidden" disabled={logoUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
          </label>

          {cfg.doc.logo_url && !logoUploading && (
            <button type="button" className="text-[12px] underline"
              style={{ color: "var(--text-disabled)" }}
              onClick={() => setDoc("logo_url", "")}>
              Retirer
            </button>
          )}
        </div>

        <label className="mb-1.5 mt-3 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          Couleur du document
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          {TEINTES.map((t) => {
            const choisie = cfg.doc.color.toLowerCase() === t.toLowerCase();
            return (
              <button
                key={t} type="button"
                aria-label={`Couleur ${t}`}
                onClick={() => setDoc("color", choisie ? "" : t)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-all"
                style={{ background: t, border: choisie ? "3px solid var(--text-primary)" : "1px solid var(--border-default)" }}
              >
                {choisie && <Check className="h-3.5 w-3.5" style={{ color: "#fff" }} />}
              </button>
            );
          })}
          <input
            className="input-midnight ml-1 w-[130px]"
            value={cfg.doc.color}
            onChange={(e) => setDoc("color", e.target.value)}
            placeholder="#DD5509"
          />
        </div>
        <SubTitle className="mt-4">Modèle du tableau</SubTitle>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(Object.keys(MODELES) as (keyof typeof MODELES)[]).map((id) => {
            const m = MODELES[id];
            const choisi = (cfg.doc.template || "classique") === id;
            const accent = /^#[0-9a-fA-F]{6}$/.test(cfg.doc.color.trim()) ? cfg.doc.color.trim() : "#DD5509";
            // Vignette : trois lignes qui montrent l'allure de l'en-tête et des
            // filets. Choisir sur un nom seul revient à choisir au hasard.
            const enteteVignette =
              m.entete === "sombre"   ? { background: "#1F2328" }
              : m.entete === "souligne" ? { borderBottom: `2px solid ${accent}` }
              : { background: accent };
            return (
              <button
                key={id} type="button"
                onClick={() => { setDoc("template", id); setDoc("lines", ""); setDoc("zebra", m.zebra); }}
                className="rounded-lg p-2.5 text-left transition-all"
                style={{
                  background: "var(--surface-raised)",
                  border: choisi ? "2px solid var(--text-primary)" : "1px solid var(--border-default)",
                }}
              >
                <div className="mb-1.5 overflow-hidden rounded" style={{ background: "#fff" }}>
                  <div style={{ height: 7, ...enteteVignette }} />
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      height: 6,
                      background: m.zebra && i % 2 === 1 ? "#FBF6F2" : "#fff",
                      borderBottom: m.lines !== "aucune" ? "1px solid #E6E6E6" : undefined,
                    }} />
                  ))}
                </div>
                <div className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{m.nom}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Filets du tableau
            </label>
            <select
              className="input-midnight w-full"
              value={cfg.doc.lines || MODELES[(cfg.doc.template || "classique") as keyof typeof MODELES].lines}
              onChange={(e) => setDoc("lines", e.target.value)}
            >
              <option value="horizontales">Lignes horizontales</option>
              <option value="toutes">Toutes les bordures</option>
              <option value="aucune">Aucune bordure</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Lignes alternées
            </label>
            <button
              type="button"
              onClick={() => setDoc("zebra", !cfg.doc.zebra)}
              className="btn-ghost w-full justify-start"
            >
              {cfg.doc.zebra ? "Une ligne sur deux colorée" : "Fond uni"}
            </button>
          </div>
        </div>

        <SubTitle className="mt-4">Bandeau de bas de page</SubTitle>
        <p className="mb-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
          Une image large et peu haute, placée juste avant le pied de page. Format
          conseillé : environ 1000 × 150 pixels.
        </p>
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <label className="btn-ghost cursor-pointer">
            {bannerUploading ? "Envoi…" : cfg.doc.banner_url ? "Remplacer" : "Choisir une image"}
            <input type="file" accept="image/*" className="hidden" disabled={bannerUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = ""; }} />
          </label>
          {cfg.doc.banner_url && !bannerUploading && (
            <button type="button" className="text-[12px] underline"
              style={{ color: "var(--text-disabled)" }}
              onClick={() => setDoc("banner_url", "")}>
              Retirer
            </button>
          )}
        </div>

        <SubTitle className="mt-5">Aperçu</SubTitle>
        <p className="mb-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
          Articles et client fictifs. Ce qui est vide ici le sera aussi sur le document.
        </p>
        <div className="overflow-x-auto rounded-lg p-3" style={{ background: "var(--surface-raised)" }}>
          <div style={{ minWidth: 420 }}>
            <BonPreview d={cfg.doc} />
          </div>
        </div>

        <p className="mt-2 text-[11px]" style={{ color: "var(--text-disabled)" }}>
          La position du local se relève dans « Site &amp; localisation » ci-dessus.
        </p>
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

function SubTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={"mb-2 text-[11px] font-bold uppercase tracking-wider " + className} style={{ color: "var(--text-disabled)" }}>
      {children}
    </p>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
      <input className="input-midnight" type={type} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
