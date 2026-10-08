"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Save, RefreshCw, Bot, ShoppingBag, CreditCard, MapPin, MessageSquare, Lock, FileText, LocateFixed, Check,
  Gauge, Signpost, Truck, UtensilsCrossed, ImagePlus, X, Globe, Palette, Building2, Scale, Eye, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { getMaxLevel } from "@/lib/plans";
import BonPreview, { MODELES } from "@/components/BonPreview";
import { Bouton, Filtres, Pastille, Squelettes, StylesUI, apparait } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

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
  { v: 1, label: "Niveau 1 — Support",   court: "Support",   desc: "Répond, informe, redirige. Pas de catalogue.",         icon: Bot },
  { v: 2, label: "Niveau 2 — Catalogue", court: "Catalogue", desc: "Présente les produits, prix, photos, albums.",          icon: ShoppingBag },
  { v: 3, label: "Niveau 3 — Closing",   court: "Closing",   desc: "Vente + paiement Monetbil (bientôt).",                  icon: CreditCard },
];

const HORS_PERIMETRE = [
  { v: "site" as const,  t: "Rediriger vers le site", d: "« Rendez-vous sur notre site »" },
  { v: "human" as const, t: "Passer à un humain",     d: "« Je transmets à un conseiller »" },
];

const FILETS = [
  { cle: "horizontales", libelle: "Lignes horizontales" },
  { cle: "toutes",       libelle: "Toutes les bordures" },
  { cle: "aucune",       libelle: "Aucune bordure" },
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
    return (
      <div className="py-6 lg:py-8">
        <StylesUI />
        <p className="sr-only">Chargement…</p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Squelettes n={4} hauteur={180} />
          <div className="hidden lg:block"><Squelettes n={1} hauteur={320} /></div>
        </div>
      </div>
    );
  }

  const maxLevel = getMaxLevel(cfg.plan);
  const niveauActuel = LEVELS.find((l) => l.v === cfg.level);
  const zones = parseZones(cfg.delivery_zones_text ?? "");
  const positionRelevee = cfg.latitude != null && cfg.longitude != null;
  const accent = /^#[0-9a-fA-F]{6}$/.test(cfg.doc.color.trim()) ? cfg.doc.color.trim() : "#DD5509";

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />
      <style jsx global>{`
        .cfg-bloc { border: 1px solid var(--cl-line-soft); background: #fff; }
        .cfg-option { transition: box-shadow .25s ease, background-color .25s ease, transform .25s cubic-bezier(.34,1.56,.64,1); }
        .cfg-option:hover:not(:disabled) { transform: translateY(-2px); }
        .cfg-pastille-teinte { transition: transform .2s cubic-bezier(.34,1.56,.64,1); }
        .cfg-pastille-teinte:hover { transform: scale(1.1); }
        @media (prefers-reduced-motion: reduce) {
          .cfg-option, .cfg-option:hover:not(:disabled), .cfg-pastille-teinte, .cfg-pastille-teinte:hover { transition: none; transform: none; }
        }
      `}</style>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* ── Niveau ─────────────────────────────────────────────────────── */}
          <Bloc rang={0} icone={Gauge} titre="Niveau d'automatisation"
            texte="Ce que l'agent a le droit de faire seul, de la simple information jusqu'à la vente.">
            <div role="radiogroup" aria-label="Niveau d'automatisation" className="grid gap-3 sm:grid-cols-3">
              {LEVELS.map((l) => {
                const active = cfg.level === l.v;
                const locked = l.v > maxLevel;
                return (
                  <button
                    key={l.v}
                    role="radio" aria-checked={active}
                    disabled={locked}
                    onClick={() => !locked && setCfg({ ...cfg, level: l.v })}
                    className="cfg-option relative flex flex-col items-start gap-2 rounded-[22px] p-4 text-left disabled:cursor-not-allowed"
                    style={{
                      background: active ? "var(--cl-accent-soft)" : "#F7F6FA",
                      boxShadow: active ? "inset 0 0 0 2px var(--cl-accent)" : "none",
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full"
                        style={{ background: active ? "var(--cl-accent)" : "#fff", color: active ? "#fff" : "var(--cl-accent-deep)" }}>
                        <l.icon className="h-4 w-4" />
                      </span>
                      {locked ? (
                        <Pastille ton="gris"><Lock className="h-3 w-3" /> Plan requis</Pastille>
                      ) : (
                        <PointRadio actif={active} groupe="cfg-niveau" />
                      )}
                    </div>
                    <span className="mt-1 text-[14px] font-medium tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>{l.label}</span>
                    <span className="text-[12.5px] leading-snug" style={{ color: "var(--cl-ink-faint)" }}>{l.desc}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
              Plan actuel : <Pastille ton="violet">{cfg.plan}</Pastille> débloque jusqu&apos;au niveau {maxLevel}.
              {maxLevel < 3 && <span>Passez à un plan supérieur pour les niveaux avancés.</span>}
            </p>
          </Bloc>

          {/* ── Accueil ────────────────────────────────────────────────────── */}
          <Bloc rang={1} icone={MessageSquare} titre="Message d'accueil"
            texte="Le premier mot que reçoit un nouveau contact.">
            <LigneBascule
              titre="Accueillir automatiquement les nouveaux contacts"
              actif={cfg.welcome_enabled}
              onChange={(v) => setCfg({ ...cfg, welcome_enabled: v })}
            />
            <AnimatePresence initial={false}>
              {cfg.welcome_enabled && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={RESSORT} className="overflow-hidden">
                  <label className="mt-4 grid gap-1.5">
                    <Etiquette>Message personnalisé <Facultatif /></Etiquette>
                    <textarea
                      className="ui-champ" rows={2}
                      value={cfg.welcome_message ?? ""}
                      onChange={(e) => setCfg({ ...cfg, welcome_message: e.target.value })}
                      placeholder="Laisse vide pour le message par défaut, ou personnalise : « Bonjour et bienvenue chez… »"
                    />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </Bloc>

          {/* ── Hors-scope ─────────────────────────────────────────────────── */}
          <Bloc rang={2} icone={Signpost} titre="Hors de son périmètre"
            texte="Ce que fait l'agent quand une demande dépasse ce qu'il sait faire.">
            <div role="radiogroup" aria-label="Hors de son périmètre" className="grid gap-3 sm:grid-cols-2">
              {HORS_PERIMETRE.map((o) => {
                const active = cfg.out_of_scope_behavior === o.v;
                return (
                  <button key={o.v} role="radio" aria-checked={active}
                    onClick={() => setCfg({ ...cfg, out_of_scope_behavior: o.v })}
                    className="cfg-option flex items-start gap-3 rounded-[20px] p-4 text-left"
                    style={{ background: active ? "var(--cl-accent-soft)" : "#F7F6FA", boxShadow: active ? "inset 0 0 0 2px var(--cl-accent)" : "none" }}>
                    <PointRadio actif={active} groupe="cfg-hors" />
                    <span>
                      <span className="block text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{o.t}</span>
                      <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>{o.d}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Bloc>

          {/* ── Site + géo ─────────────────────────────────────────────────── */}
          <Bloc rang={3} icone={MapPin} titre="Site & localisation"
            texte="Coordonnées de la boutique : c'est ce que l'agent envoie au client qui demande où te trouver, et l'adresse du bon de commande.">
            <label className="grid gap-1.5">
              <Etiquette>Site web</Etiquette>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
                <input className="ui-champ" style={{ paddingLeft: 42 }} value={cfg.website_url ?? ""}
                  onChange={(e) => setCfg({ ...cfg, website_url: e.target.value })} placeholder="https://votre-site.com" />
              </div>
            </label>

            <div className="mt-5 rounded-[22px] p-4 sm:p-5" style={{ background: "#FAF9FC" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>Position de la boutique</p>
                  <AnimatePresence mode="wait" initial={false}>
                    {positionRelevee ? (
                      <motion.p key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={RESSORT}
                        className="mt-1 inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "#1E7A3A" }}>
                        <Check className="h-3.5 w-3.5" />
                        Position enregistrée · {cfg.latitude}, {cfg.longitude}
                      </motion.p>
                    ) : (
                      <motion.p key="vide" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={RESSORT}
                        className="mt-1 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                        Relève-la depuis la boutique, ou saisis les coordonnées.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <Bouton type="button" variante="encre" onClick={detecterPosition} disabled={locating}
                  icone={LocateFixed} className={locating ? "[&>svg]:animate-pulse" : ""}>
                  {locating ? "Relevé en cours…" : "Je suis dans ma boutique"}
                </Bouton>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="grid min-w-0 gap-1.5">
                  <Etiquette>Latitude</Etiquette>
                  <input className="ui-champ" style={{ background: "#fff" }} type="number" step="0.000001" value={cfg.latitude ?? ""}
                    onChange={(e) => setCfg({ ...cfg, latitude: e.target.value === "" ? null : Number(e.target.value) })} placeholder="4.0511" />
                </label>
                <label className="grid min-w-0 gap-1.5">
                  <Etiquette>Longitude</Etiquette>
                  <input className="ui-champ" style={{ background: "#fff" }} type="number" step="0.000001" value={cfg.longitude ?? ""}
                    onChange={(e) => setCfg({ ...cfg, longitude: e.target.value === "" ? null : Number(e.target.value) })} placeholder="9.7679" />
                </label>
              </div>
            </div>
          </Bloc>

          {/* ── Livraison ──────────────────────────────────────────────────── */}
          <Bloc rang={4} icone={Truck} titre="Livraison"
            texte="Les frais que l'agent ajoute au bon de commande selon le quartier du client.">
            <LigneBascule
              titre="Facturer des frais de livraison"
              actif={cfg.delivery_enabled !== false}
              onChange={(v) => setCfg({ ...cfg, delivery_enabled: v })}
            />

            <div className="mt-5 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <label className="grid content-start gap-1.5">
                <Etiquette>Frais par défaut (XAF)</Etiquette>
                <input className="ui-champ" type="number" min="0" step="50"
                  value={cfg.delivery_fee ?? 1000}
                  onChange={(e) => setCfg({ ...cfg, delivery_fee: e.target.value === "" ? 0 : Number(e.target.value) })} />
              </label>

              <label className="grid min-w-0 gap-1.5">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <Etiquette>Tarifs par quartier — une ligne par zone</Etiquette>
                  {zones.length > 0 && <Pastille ton="violet">{zones.length} zone{zones.length > 1 ? "s" : ""} reconnue{zones.length > 1 ? "s" : ""}</Pastille>}
                </span>
                <textarea className="ui-champ font-mono text-[13px]" rows={5}
                  value={cfg.delivery_zones_text ?? ""}
                  onChange={(e) => setCfg({ ...cfg, delivery_zones_text: e.target.value })}
                  placeholder={"Bonaberi = 2000\nAkwa = 500\nBonamoussadi = 1500"} />
                <Aide>
                  Le quartier est cherché dans l&apos;adresse du client. Sans correspondance,
                  les frais par défaut s&apos;appliquent. Aucun frais sur place ou à emporter.
                </Aide>
              </label>
            </div>
          </Bloc>

          {/* ── Mon bon de commande — mêmes champs que l'écran mobile.
              Le document partait au nom d'une seule entreprise pour tout le monde :
              chaque vendeur envoyait à SES clients un bon portant le nom et le RCCM
              d'un tiers. ─────────────────────────────────────────────────── */}
          <Bloc rang={5} icone={FileText} titre="Mon bon de commande"
            texte="Ces informations s'impriment en haut et en bas de chaque bon de commande envoyé à tes clients. Les champs laissés vides sont simplement omis.">

            <SousTitre icone={Building2}>Entreprise</SousTitre>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l'entreprise" value={cfg.doc.name} onChange={(v) => setDoc("name", v)} placeholder="Ex. Chez Mama Ngo" />
              <Field label="Accroche" facultatif value={cfg.doc.tagline} onChange={(v) => setDoc("tagline", v)} placeholder="Ex. Restaurant traditionnel" />
              <Field label="Adresse" value={cfg.doc.address} onChange={(v) => setDoc("address", v)} placeholder="Ex. Bonamoussadi, Douala" />
              <Field label="Téléphone" value={cfg.doc.phone} onChange={(v) => setDoc("phone", v)} placeholder="Ex. (+237) 6 99 00 00 00" />
              <Field label="Courriel" facultatif value={cfg.doc.email} onChange={(v) => setDoc("email", v)} type="email" placeholder="contact@exemple.cm" />
            </div>

            <SousTitre icone={Scale} className="mt-7">Mentions légales</SousTitre>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="RCCM" facultatif value={cfg.doc.rccm} onChange={(v) => setDoc("rccm", v)} placeholder="RC/DLA/2020/B/1234" />
              <Field label="NIU" facultatif value={cfg.doc.niu} onChange={(v) => setDoc("niu", v)} placeholder="M0123456789012A" />
            </div>

            <SousTitre icone={Palette} className="mt-7">Apparence</SousTitre>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Logo */}
              <div className="rounded-[22px] p-4" style={{ background: "#FAF9FC" }}>
                <Etiquette>Logo <Facultatif /></Etiquette>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <AnimatePresence mode="wait" initial={false}>
                    {cfg.doc.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- média hébergé par camille-core, hors domaines Next
                      <motion.img key={cfg.doc.logo_url}
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={RESSORT}
                        src={cfg.doc.logo_url}
                        alt="Logo du bon de commande"
                        className="h-16 w-16 rounded-[18px] bg-white object-contain p-1"
                        style={{ boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}
                      />
                    ) : (
                      <motion.div key="vide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-white"
                        style={{ color: "var(--cl-ink-faint)", boxShadow: "inset 0 0 0 1px var(--cl-line-soft)" }}>
                        <FileText size={20} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex flex-wrap items-center gap-2">
                    <BoutonFichier occupe={logoUploading} libelle={cfg.doc.logo_url ? "Remplacer" : "Choisir une image"} onFichier={uploadLogo} />
                    {cfg.doc.logo_url && !logoUploading && (
                      <BoutonRetirer onClick={() => setDoc("logo_url", "")} />
                    )}
                  </div>
                </div>
              </div>

              {/* Couleur */}
              <div className="rounded-[22px] p-4" style={{ background: "#FAF9FC" }}>
                <Etiquette>Couleur du document</Etiquette>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  {TEINTES.map((t) => {
                    const choisie = cfg.doc.color.toLowerCase() === t.toLowerCase();
                    return (
                      <button
                        key={t} type="button"
                        aria-label={`Couleur ${t}`} aria-pressed={choisie}
                        onClick={() => setDoc("color", choisie ? "" : t)}
                        className="cfg-pastille-teinte flex h-9 w-9 items-center justify-center rounded-full"
                        style={{ background: t, boxShadow: choisie ? `0 0 0 3px #fff, 0 0 0 5px ${t}` : "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
                      >
                        <AnimatePresence>
                          {choisie && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={RESSORT}>
                              <Check className="h-4 w-4" style={{ color: "#fff" }} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
                </div>
                <div className="relative mt-3 w-[150px]">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
                    style={{ background: accent, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }} />
                  <input
                    className="ui-champ font-mono"
                    style={{ background: "#fff", paddingLeft: 38 }}
                    aria-label="Code couleur"
                    value={cfg.doc.color}
                    onChange={(e) => setDoc("color", e.target.value)}
                    placeholder="#DD5509"
                  />
                </div>
              </div>
            </div>

            <SousTitre icone={Sparkles} className="mt-7">Modèle du tableau</SousTitre>
            <div role="radiogroup" aria-label="Modèle du tableau" className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(MODELES) as (keyof typeof MODELES)[]).map((id) => {
                const m = MODELES[id];
                const choisi = (cfg.doc.template || "classique") === id;
                // Vignette : trois lignes qui montrent l'allure de l'en-tête et des
                // filets. Choisir sur un nom seul revient à choisir au hasard.
                const enteteVignette =
                  m.entete === "sombre"   ? { background: "#1F2328" }
                  : m.entete === "souligne" ? { borderBottom: `2px solid ${accent}` }
                  : { background: accent };
                return (
                  <button
                    key={id} type="button" role="radio" aria-checked={choisi}
                    onClick={() => { setDoc("template", id); setDoc("lines", ""); setDoc("zebra", m.zebra); }}
                    className="cfg-option rounded-[22px] p-3 text-left"
                    style={{
                      background: choisi ? "var(--cl-accent-soft)" : "#F7F6FA",
                      boxShadow: choisi ? "inset 0 0 0 2px var(--cl-accent)" : "none",
                    }}
                  >
                    <div className="mb-2.5 overflow-hidden rounded-[12px]" style={{ background: "#fff", boxShadow: "0 1px 2px rgba(25,23,27,0.06)" }}>
                      <div style={{ height: 9, ...enteteVignette }} />
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{
                          height: 8,
                          background: m.zebra && i % 2 === 1 ? "#FBF6F2" : "#fff",
                          borderBottom: m.lines !== "aucune" ? "1px solid #E6E6E6" : undefined,
                        }} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{m.nom}</span>
                      <PointRadio actif={choisi} groupe="cfg-modele" />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid min-w-0 gap-1.5">
                <Etiquette>Filets du tableau</Etiquette>
                <Filtres
                  id="cfg-filets" label="Filets du tableau"
                  valeur={cfg.doc.lines || MODELES[(cfg.doc.template || "classique") as keyof typeof MODELES].lines}
                  onChange={(v) => setDoc("lines", v)}
                  options={FILETS}
                />
              </div>
              <LigneBascule
                titre="Lignes alternées"
                aide={cfg.doc.zebra ? "Une ligne sur deux colorée" : "Fond uni"}
                actif={cfg.doc.zebra}
                onChange={() => setDoc("zebra", !cfg.doc.zebra)}
              />
            </div>

            <SousTitre icone={ImagePlus} className="mt-7">Bandeau de bas de page</SousTitre>
            <div className="rounded-[22px] p-4" style={{ background: "#FAF9FC" }}>
              <Aide>
                Une image large et peu haute, placée juste avant le pied de page. Format
                conseillé : environ 1000 × 150 pixels.
              </Aide>
              <AnimatePresence initial={false}>
                {cfg.doc.banner_url && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={RESSORT} className="overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- média hébergé par camille-core, hors domaines Next */}
                    <img src={cfg.doc.banner_url} alt="Bandeau de bas de page"
                      className="mt-3 h-16 w-full rounded-[14px] bg-white object-cover" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <BoutonFichier occupe={bannerUploading} libelle={cfg.doc.banner_url ? "Remplacer" : "Choisir une image"} onFichier={uploadBanner} />
                {cfg.doc.banner_url && !bannerUploading && (
                  <BoutonRetirer onClick={() => setDoc("banner_url", "")} />
                )}
              </div>
            </div>

            <SousTitre icone={Eye} className="mt-7">Aperçu</SousTitre>
            <Aide>Articles et client fictifs. Ce qui est vide ici le sera aussi sur le document.</Aide>
            <div className="mt-3 overflow-x-auto rounded-[22px] p-4" style={{ background: "#F7F6FA" }}>
              <div style={{ minWidth: 420 }}>
                <BonPreview d={cfg.doc} />
              </div>
            </div>

            <p className="mt-3"><Aide>La position du local se relève dans « Site &amp; localisation » ci-dessus.</Aide></p>
          </Bloc>

          {/* ── Carte du menu — restauration uniquement ─────────────────────── */}
          {isResto && (
            <Bloc rang={6} icone={UtensilsCrossed} titre="Carte du menu"
              texte="Envoyée au client juste après les premiers plats, quand il demande le menu.">
              <div className="flex flex-wrap items-center gap-2">
                <BoutonFichier occupe={uploading} libelle={cfg.menu_image_url ? "Remplacer l'image" : "Choisir une image"} onFichier={uploadMenu} />
                {cfg.menu_image_url && (
                  <BoutonRetirer onClick={() => setCfg({ ...cfg, menu_image_url: "" })} />
                )}
              </div>
              <label className="mt-4 grid gap-1.5">
                <Etiquette>…ou coller une URL</Etiquette>
                <input className="ui-champ" value={cfg.menu_image_url ?? ""}
                  onChange={(e) => setCfg({ ...cfg, menu_image_url: e.target.value })}
                  placeholder="https://…/carte.jpg" />
              </label>
              {cfg.menu_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.menu_image_url} alt="Carte du menu" className="mt-4 w-full rounded-[22px]"
                  style={{ maxHeight: 260, objectFit: "cover" }} />
              ) : null}
            </Bloc>
          )}
        </div>

        {/* ── À côté : le résumé et les actions, toujours sous la main ─────── */}
        <aside className="min-w-0 lg:sticky lg:top-[96px] lg:self-start">
          <motion.div {...apparait(1)} className="cfg-bloc rounded-[28px] p-5">
            <p className="text-[16px] font-medium tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>En un coup d&apos;œil</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              <Resume libelle="Niveau">
                <Pastille ton="violet">{niveauActuel ? niveauActuel.court : `Niveau ${cfg.level}`}</Pastille>
              </Resume>
              <Resume libelle="Accueil">
                <Pastille ton={cfg.welcome_enabled ? "vert" : "gris"} point>{cfg.welcome_enabled ? "Activé" : "Désactivé"}</Pastille>
              </Resume>
              <Resume libelle="Hors périmètre">
                <Pastille ton="gris">{cfg.out_of_scope_behavior === "human" ? "Humain" : "Site web"}</Pastille>
              </Resume>
              <Resume libelle="Position">
                <Pastille ton={positionRelevee ? "vert" : "ambre"} point>{positionRelevee ? "Relevée" : "À relever"}</Pastille>
              </Resume>
              <Resume libelle="Livraison">
                <Pastille ton={cfg.delivery_enabled !== false ? "bleu" : "gris"}>
                  {cfg.delivery_enabled !== false
                    ? `${Number(cfg.delivery_fee ?? 0).toLocaleString("fr-FR")} XAF${zones.length ? ` · ${zones.length} zone${zones.length > 1 ? "s" : ""}` : ""}`
                    : "Gratuite"}
                </Pastille>
              </Resume>
              <Resume libelle="Bon de commande">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: accent }} />
                  <span className="truncate" style={{ color: "var(--cl-ink)" }}>{cfg.doc.name || "Sans nom"}</span>
                </span>
              </Resume>
            </ul>

            <div className="mt-5 grid gap-2">
              <Bouton variante="encre" icone={Save} occupe={saving} onClick={save} disabled={saving} className="w-full">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Bouton>
              <Bouton variante="doux" icone={RefreshCw} onClick={regenerate} disabled={regen} className={"w-full " + (regen ? "[&>svg]:animate-spin" : "")}>
                {regen ? "Régénération…" : "Régénérer le prompt IA"}
              </Bouton>
            </div>
            <p className="mt-3 px-1 text-[12px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
              Régénère le cerveau de l&apos;agent selon le niveau et la config ci-contre.
              Les envois d&apos;images sont posés dans le formulaire : pense à enregistrer.
            </p>
          </motion.div>
        </aside>
      </div>
    </div>
  );
}

// ── Les petites pièces propres à cette page ─────────────────────────────────

/** Une carte de réglages : pastille d'icône, titre, explication, contenu. */
function Bloc({ icone: Icone, titre, texte, rang = 0, children }: {
  icone: React.ElementType; titre: string; texte?: string; rang?: number; children: React.ReactNode;
}) {
  return (
    <motion.section {...apparait(rang)} className="cfg-bloc rounded-[28px] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent-deep)" }}>
          <Icone className="h-4 w-4" />
        </span>
        <div className="min-w-0 pt-1">
          <h2 className="text-[17px] font-medium leading-tight tracking-[-0.015em]" style={{ color: "var(--cl-ink)" }}>{titre}</h2>
          {texte && <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{texte}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function SousTitre({ icone: Icone, children, className = "" }: { icone: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <p className={"mb-3 flex items-center gap-2 text-[14px] font-medium tracking-[-0.01em] " + className} style={{ color: "var(--cl-ink)" }}>
      <Icone className="h-4 w-4" style={{ color: "var(--cl-accent-deep)" }} />
      {children}
    </p>
  );
}

function Etiquette({ children }: { children: React.ReactNode }) {
  return <span className="px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>{children}</span>;
}

function Facultatif() {
  return <span className="font-normal" style={{ color: "var(--cl-ink-faint)" }}>· facultatif</span>;
}

function Aide({ children }: { children: React.ReactNode }) {
  return <span className="block px-1 text-[12px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{children}</span>;
}

/** Le petit rond d'un bouton radio, le point intérieur glisse d'une option à l'autre. */
function PointRadio({ actif, groupe }: { actif: boolean; groupe: string }) {
  return (
    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
      style={{ boxShadow: `inset 0 0 0 2px ${actif ? "var(--cl-accent)" : "#CFC9DA"}`, background: "#fff" }}>
      {actif && <motion.span layoutId={groupe} transition={RESSORT} className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cl-accent)" }} />}
    </span>
  );
}

/** Un réglage oui/non : toute la ligne est l'interrupteur, le bouton glisse. */
function LigneBascule({ titre, aide, actif, onChange }: {
  titre: string; aide?: string; actif: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={() => onChange(!actif)}
      className="flex w-full items-center justify-between gap-4 rounded-[20px] px-4 py-3.5 text-left"
      style={{ background: "#FAF9FC" }}>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{titre}</span>
        {aide && <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>{aide}</span>}
      </span>
      <span className="relative flex h-7 w-12 flex-shrink-0 items-center rounded-full p-1 transition-colors duration-200"
        style={{ background: actif ? "var(--cl-accent)" : "#DCD7E4" }}>
        <motion.span animate={{ x: actif ? 20 : 0 }} transition={RESSORT}
          className="h-5 w-5 rounded-full bg-white" style={{ boxShadow: "0 1px 3px rgba(25,23,27,0.2)" }} />
      </span>
    </button>
  );
}

/** Un bouton qui ouvre le choix d'une image ; la valeur est remise à zéro pour pouvoir renvoyer le même fichier. */
function BoutonFichier({ libelle, occupe, onFichier }: { libelle: string; occupe: boolean; onFichier: (f: File) => void }) {
  return (
    <label className={"ui-bouton inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium " + (occupe ? "cursor-wait opacity-60" : "cursor-pointer")}
      style={{ background: "#fff", color: "var(--cl-ink)", boxShadow: "inset 0 0 0 1px var(--cl-line)" }}>
      <ImagePlus className={"h-4 w-4 " + (occupe ? "animate-pulse" : "")} />
      {occupe ? "Envoi…" : libelle}
      <input type="file" accept="image/*" className="hidden" disabled={occupe}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFichier(f); e.target.value = ""; }} />
    </label>
  );
}

function BoutonRetirer({ onClick }: { onClick: () => void }) {
  return (
    <Bouton type="button" variante="danger" icone={X} onClick={onClick}>Retirer</Bouton>
  );
}

function Resume({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex-shrink-0" style={{ color: "var(--cl-ink-faint)" }}>{libelle}</span>
      <span className="flex min-w-0 justify-end">{children}</span>
    </li>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", facultatif }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; facultatif?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <Etiquette>{label} {facultatif && <Facultatif />}</Etiquette>
      <input className="ui-champ" type={type} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
