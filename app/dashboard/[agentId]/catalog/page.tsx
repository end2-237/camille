"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, Link2, Check, X, ExternalLink, Search, Upload, ImageIcon, UtensilsCrossed, Package, PackageX, Layers, Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Bouton, BoutonRond, Filtres, LienBouton, Pastille, Squelettes, StylesUI, Tuile, Vide, apparait } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";
import { toast } from "sonner";
import { JOURS, optImage, optValue, type OptionGroup, type Product } from "@/components/catalog/ProductCard";
import { authHeaders } from "@/lib/auth-client";
import { sertDesRepas } from "@/lib/sectorProfiles";

type Draft = Omit<Partial<Product>, "price" | "price_max" | "stock" | "min_order"> & {
  price?: string | number | null;
  price_max?: string | number | null;
  stock?: string | number | null;
  min_order?: string | number | null;
  tagsStr?: string;
};

const EMPTY: Draft = { name: "", description: "", currency: "XAF", min_order: 1, active: true, tagsStr: "" };

export default function CatalogPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState("");
  const [editing, setEditing]   = useState<Draft | null>(null);
  const [saving, setSaving]     = useState(false);
  const [copied, setCopied]     = useState(false);
  const [uploading, setUploading] = useState(false);
  // Le menu du jour ne concerne que la restauration : ailleurs, l'interrupteur
  // n'apparaît pas du tout.
  const [restauration, setRestauration] = useState(false);

  // Construit après le montage : le serveur ne connaît pas l'adresse du site
  // (sinon le lien diffère entre le rendu serveur et le navigateur).
  const [publicLink, setPublicLink] = useState("");
  useEffect(() => { setPublicLink(`${window.location.origin}/catalog/${agentId}`); }, [agentId]);
  const [rayon, setRayon] = useState("tous");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/products`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setProducts(d.products ?? []);
    } catch { toast.error("Erreur de chargement du catalogue"); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/agents/${agentId}`, { headers: { ...authHeaders() } });
        const d = await r.json();
        setRestauration(sertDesRepas(d?.agent?.business_context?.sector));
      } catch {
        /* secteur inconnu : on n'affiche pas l'interrupteur, c'est le bon défaut */
      }
    })();
  }, [agentId]);

  /** L'interrupteur du menu du jour : un clic, pas un formulaire à rouvrir. */
  async function basculerMenuDuJour(p: Product) {
    const suivant = !p.daily_menu;
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, daily_menu: suivant } : x)));
    try {
      const r = await fetch(`/api/agents/${agentId}/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ daily_menu: suivant }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Échec de l'enregistrement");
      toast.success(suivant ? `« ${p.name} » est au menu du jour` : `« ${p.name} » retiré du menu du jour`);
    } catch (e) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, daily_menu: !suivant } : x)));
      toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement");
    }
  }

  const rayons = [...new Set(products.map((p) => (p.category ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const filtered = products
    .filter((p) => rayon === "tous" || (p.category ?? "").trim() === rayon)
    .filter((p) => !q.trim() || (p.name + " " + (p.category ?? "")).toLowerCase().includes(q.toLowerCase()));
  const actifs = products.filter((p) => p.active !== false).length;
  const ruptures = products.filter((p) => p.stock != null && Number(p.stock) <= 0).length;

  const modifier = (p: Product) => setEditing({
    ...p,
    tagsStr: (p.tags ?? []).join(", "),
    variants: (p.variants ?? []).map((v) => ({
      name: v.name,
      options: (v.options ?? []).map((o) => (typeof o === "string" ? { value: o, image: null } : { value: o.value, image: o.image ?? null })),
    })),
  });

  async function save() {
    if (!editing?.name?.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    const payload = {
      name: editing.name,
      description: editing.description ?? "",
      price: editing.price === "" || editing.price == null ? null : Number(editing.price),
      price_max: editing.price_max === "" || editing.price_max == null ? null : Number(editing.price_max),
      currency: editing.currency ?? "XAF",
      category: editing.category ?? null,
      stock: editing.stock === "" || editing.stock == null ? null : Number(editing.stock),
      min_order: editing.min_order ?? 1,
      image_url: editing.image_url ?? null,
      images: (editing.images ?? []).filter(Boolean),
      product_url: (editing.product_url ?? "").trim() || null,
      active: editing.active ?? true,
      daily_menu: restauration ? editing.daily_menu ?? false : undefined,
      available_days: restauration
        ? (editing.available_days ?? []).filter((j) => j >= 1 && j <= 6).sort()
        : undefined,
      // Options du plat : seulement en restauration. Un groupe sans nom ou sans
      // choix est écarté ; un prix vide vaut 0 (pas de supplément).
      options: restauration
        ? (editing.options ?? [])
            .map((g) => ({
              name: (g.name ?? "").trim(),
              required: g.required !== false,
              choices: (g.choices ?? [])
                .map((c) => ({ label: (c.label ?? "").trim(), price: Number(c.price) || 0 }))
                .filter((c) => c.label),
            }))
            .filter((g) => g.name && g.choices.length)
        : undefined,
      tags: (editing.tagsStr ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      variants: (editing.variants ?? [])
        .map((v) => ({
          name: (v.name ?? "").trim(),
          options: (v.options ?? [])
            .map((o) => (typeof o === "string" ? { value: o.trim(), image: null } : { value: (o.value ?? "").trim(), image: o.image || null }))
            .filter((o) => o.value),
        }))
        .filter((v) => v.name && v.options.length),
    };
    try {
      const url = editing.id
        ? `/api/agents/${agentId}/products/${editing.id}`
        : `/api/agents/${agentId}/products`;
      const r = await fetch(url, {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      toast.success(editing.id ? "Produit mis à jour" : "Produit ajouté");
      setEditing(null);
      load();
    } catch { toast.error("Échec de l'enregistrement"); }
    finally { setSaving(false); }
  }

  // Upload d'une image liée à une option de variation
  async function uploadVariantImage(f: File, gi: number, oi: number) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/agents/${agentId}/products/upload`, { method: "POST", headers: { ...authHeaders() }, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload échoué");
      setEditing((e) => {
        if (!e) return e;
        const vs = [...(e.variants ?? [])];
        const opts = [...((vs[gi]?.options ?? []) as { value: string; image?: string | null }[])];
        opts[oi] = { ...(opts[oi] as { value: string }), image: d.url };
        vs[gi] = { ...vs[gi], options: opts };
        return { ...e, variants: vs };
      });
      toast.success("Image de variation ajoutée");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload échoué"); }
    finally { setUploading(false); }
  }

  async function uploadImage(f: File, extra = false) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/agents/${agentId}/products/upload`, { method: "POST", headers: { ...authHeaders() }, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload échoué");
      setEditing((e) => e ? (extra ? { ...e, images: [...(e.images ?? []), d.url] } : { ...e, image_url: d.url }) : e);
      toast.success("Image téléversée");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload échoué"); }
    finally { setUploading(false); }
  }

  async function remove(p: Product) {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    try {
      await fetch(`/api/agents/${agentId}/products/${p.id}`, { method: "DELETE", headers: { ...authHeaders() } });
      toast.success("Produit supprimé");
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch { toast.error("Échec de la suppression"); }
  }

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Tuile rang={0} icone={Package} titre="Produits" valeur={products.length} sous={`${actifs} visible${actifs > 1 ? "s" : ""} par l'agent`} />
        <Tuile rang={1} icone={Layers} titre="Rayons" valeur={rayons.length} sous={rayons.slice(0, 2).join(", ") || "aucun rayon"} />
        <Tuile rang={2} icone={PackageX} titre="En rupture" valeur={ruptures} fort={ruptures > 0} sous={ruptures ? "à réapprovisionner" : "tout est en stock"} />
        <Tuile rang={3} icone={EyeOff} titre="Masqués" valeur={products.length - actifs} sous="invisibles pour les clients" />
      </div>

      {/* La barre d'outils */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[300px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit…" className="ui-champ" style={{ paddingLeft: 42 }} />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Bouton variante="clair" icone={copied ? Check : Link2}
            onClick={() => { navigator.clipboard.writeText(publicLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? "Lien copié" : "Lien du catalogue"}
          </Bouton>
          <LienBouton variante="clair" icone={ExternalLink} href={publicLink || undefined} target="_blank" rel="noopener noreferrer">Aperçu</LienBouton>
          <Bouton variante="encre" icone={Plus} onClick={() => setEditing({ ...EMPTY })}>Ajouter un produit</Bouton>
        </div>
      </div>

      {rayons.length > 1 && (
        <div className="mt-4">
          <Filtres id="rayons" label="Filtrer par rayon" valeur={rayon} onChange={setRayon}
            options={[{ cle: "tous", libelle: "Tous", compte: products.length },
              ...rayons.map((r) => ({ cle: r, libelle: r, compte: products.filter((p) => (p.category ?? "").trim() === r).length }))]} />
        </div>
      )}

      {/* La grille */}
      <div className="mt-5">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"><Squelettes n={4} hauteur={300} /></div>
        ) : filtered.length === 0 ? (
          <Vide doodle="unboxing" titre={products.length ? "Aucun produit ne correspond." : "Votre catalogue est vide."}
            texte={products.length ? "Essayez un autre mot ou un autre rayon." : "Ajoutez votre premier produit : l'agent pourra le présenter, l'envoyer en fiche WhatsApp et le vendre."}
            action={!products.length ? <Bouton variante="encre" icone={Plus} onClick={() => setEditing({ ...EMPTY })}>Ajouter un produit</Bouton> : undefined} />
        ) : (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence initial={false}>
              {filtered.map((p, i) => (
                <CarteProduit key={p.id} p={p} rang={i} restauration={restauration}
                  onModifier={() => modifier(p)} onSupprimer={() => remove(p)} onMenuDuJour={() => basculerMenuDuJour(p)} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Formulaire modal */}
      {/* Rendu à la racine du document : dans la feuille du tableau de bord,
          le panneau passerait sous la barre de navigation. */}
      {publicLink && createPortal(
      <AnimatePresence>
      {editing && (
        <motion.div key="voile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-end sm:items-stretch sm:p-3" style={{ background: "rgba(25,23,27,0.38)" }} onClick={() => setEditing(null)}>
          <motion.div
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={RESSORT}
            className="cat-panneau flex w-full flex-col overflow-hidden rounded-t-[30px] sm:max-w-[560px] sm:rounded-[30px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
              <div>
                <p className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Catalogue</p>
                <h2 className="text-[22px] font-medium tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>
                  {editing.id ? "Modifier le produit" : "Nouveau produit"}
                </h2>
              </div>
              <BoutonRond icone={X} label="Fermer" onClick={() => setEditing(null)} />
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-2">
              <Field label="Nom du produit *">
                <input className="cl-input" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex : Macbook Pro M1 14''" />
              </Field>
              <Field label="Description">
                <textarea className="cl-input" rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Caractéristiques, détails utiles…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix"><input className="cl-input" type="number" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} placeholder="180000" /></Field>
                <Field label="Prix max (option)"><input className="cl-input" type="number" value={editing.price_max ?? ""} onChange={(e) => setEditing({ ...editing, price_max: e.target.value })} placeholder="220000" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Devise"><input className="cl-input" value={editing.currency ?? "XAF"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} /></Field>
                <Field label="Catégorie"><input className="cl-input" value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Électronique" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stock (vide = non suivi)"><input className="cl-input" type="number" value={editing.stock ?? ""} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} placeholder="12" /></Field>
                <Field label="Commande min."><input className="cl-input" type="number" value={editing.min_order ?? 1} onChange={(e) => setEditing({ ...editing, min_order: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Image du produit">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-[20px]"
                    style={{ border: "1px solid var(--cl-line)", background: "var(--cl-bg-soft)" }}
                  >
                    {editing.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editing.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5" style={{ color: "var(--cl-ink-faint)" }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <label
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
                      style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink)" }}
                    >
                      <Upload className="h-4 w-4" />
                      {uploading ? "Téléversement…" : "Téléverser une image"}
                      <input
                        type="file" accept="image/*" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ""; }}
                      />
                    </label>
                    {editing.image_url && (
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, image_url: "" })}
                        className="ml-2 text-[12px] underline"
                        style={{ color: "var(--cl-ink-faint)" }}
                      >
                        Retirer
                      </button>
                    )}
                    <input
                      className="cl-input mt-2"
                      value={editing.image_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                      placeholder="…ou coller une URL d'image"
                    />
                  </div>
                </div>
              </Field>
              <Field label="Lien du produit (page d'achat — optionnel)">
                <input className="cl-input" value={editing.product_url ?? ""} onChange={(e) => setEditing({ ...editing, product_url: e.target.value })} placeholder="https://votre-site.com/produit — vide = simple présentation" />
              </Field>
              {/* Images supplémentaires */}
              <Field label="Images supplémentaires (galerie)">
                <div className="flex flex-wrap items-center gap-2">
                  {(editing.images ?? []).map((url, i) => (
                    <div key={i} className="relative h-16 w-16 overflow-hidden rounded-[16px]" style={{ border: "1px solid var(--cl-line)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button type="button"
                        onClick={() => setEditing({ ...editing, images: (editing.images ?? []).filter((_, j) => j !== i) })}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: "rgba(25,23,27,0.7)" }} aria-label="Retirer">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-[16px]" style={{ border: "1px dashed var(--cl-line)", color: "var(--cl-ink-faint)" }}>
                    {uploading ? <span className="text-[9px]">…</span> : <Plus className="h-4 w-4" />}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, true); e.currentTarget.value = ""; }} />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>
                  Photos additionnelles (angles, détails) — envoyées en album sur demande.
                </p>
              </Field>

              {/* Variantes */}
              <Field label="Variations (couleur, taille…) — image liée par option">
                <div className="space-y-3">
                  {(editing.variants ?? []).map((v, gi) => {
                    const opts = (v.options ?? []) as { value: string; image?: string | null }[];
                    const setGroup = (patch: Partial<{ name: string; options: { value: string; image?: string | null }[] }>) => {
                      const vs = [...(editing.variants ?? [])];
                      vs[gi] = { ...vs[gi], ...patch };
                      setEditing({ ...editing, variants: vs });
                    };
                    return (
                      <div key={gi} className="rounded-[20px] p-3" style={{ background: "#FAF9FC" }}>
                        <div className="flex items-center gap-2">
                          <input className="cl-input" style={{ maxWidth: 160 }} value={v.name ?? ""} placeholder="Nom (Couleur, Taille…)"
                            onChange={(e) => setGroup({ name: e.target.value })} />
                          <button type="button" onClick={() => setEditing({ ...editing, variants: (editing.variants ?? []).filter((_, j) => j !== gi) })}
                            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: "#C2504B" }} aria-label="Retirer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {opts.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <label className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full" style={{ border: "1px solid var(--cl-line)", background: "var(--cl-bg-soft)" }}>
                                {o.image
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={o.image} alt="" className="h-full w-full object-cover" />
                                  : <ImageIcon className="h-3.5 w-3.5" style={{ color: "var(--cl-ink-faint)" }} />}
                                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVariantImage(f, gi, oi); e.currentTarget.value = ""; }} />
                              </label>
                              <input className="cl-input flex-1" value={o.value ?? ""} placeholder="Ex : Noir"
                                onChange={(e) => { const os = [...opts]; os[oi] = { ...os[oi], value: e.target.value }; setGroup({ options: os }); }} />
                              <button type="button" onClick={() => setGroup({ options: opts.filter((_, j) => j !== oi) })}
                                className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: "var(--cl-ink-faint)" }} aria-label="Retirer option">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => setGroup({ options: [...opts, { value: "", image: null }] })}
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: "var(--cl-accent-deep)" }}>
                            <Plus className="h-3 w-3" /> Ajouter une option
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button type="button"
                    onClick={() => setEditing({ ...editing, variants: [...(editing.variants ?? []), { name: "", options: [] }] })}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium"
                    style={{ background: "#F4F0FF", color: "var(--cl-accent-deep)" }}>
                    <Plus className="h-3.5 w-3.5" /> Ajouter une variation
                  </button>
                </div>
              </Field>

              {restauration && (
                <Field label="Options du plat (accompagnement, sauce, piment…)">
                  <div className="space-y-3">
                    {(editing.options ?? []).map((g, gi) => {
                      const choices = g.choices ?? [];
                      const setGroupe = (patch: Partial<OptionGroup>) => {
                        const gs = [...(editing.options ?? [])];
                        gs[gi] = { ...gs[gi], ...patch };
                        setEditing({ ...editing, options: gs });
                      };
                      return (
                        <div key={gi} className="rounded-[20px] p-3" style={{ background: "#FAF9FC" }}>
                          <div className="flex items-center gap-2">
                            <input className="cl-input" style={{ maxWidth: 170 }} value={g.name ?? ""} placeholder="Ex : Accompagnement"
                              onChange={(e) => setGroupe({ name: e.target.value })} />
                            <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--cl-ink-soft)" }}>
                              <input type="checkbox" checked={g.required !== false}
                                onChange={(e) => setGroupe({ required: e.target.checked })} />
                              Obligatoire
                            </label>
                            <button type="button" onClick={() => setEditing({ ...editing, options: (editing.options ?? []).filter((_, j) => j !== gi) })}
                              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: "#C2504B" }} aria-label="Retirer le groupe">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {choices.map((c, ci) => (
                              <div key={ci} className="flex items-center gap-2">
                                <input className="cl-input flex-1" value={c.label ?? ""} placeholder="Ex : Plantain"
                                  onChange={(e) => { const cs = [...choices]; cs[ci] = { ...cs[ci], label: e.target.value }; setGroupe({ choices: cs }); }} />
                                <input className="cl-input" style={{ maxWidth: 110 }} type="number" min={0} value={c.price ?? ""} placeholder="+ prix (0)"
                                  onChange={(e) => { const cs = [...choices]; cs[ci] = { ...cs[ci], price: e.target.value }; setGroupe({ choices: cs }); }} />
                                <button type="button" onClick={() => setGroupe({ choices: choices.filter((_, j) => j !== ci) })}
                                  className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: "var(--cl-ink-faint)" }} aria-label="Retirer le choix">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                            {choices.length < 10 && (
                              <button type="button" onClick={() => setGroupe({ choices: [...choices, { label: "", price: "" }] })}
                                className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: "var(--cl-accent-deep)" }}>
                                <Plus className="h-3 w-3" /> Ajouter un choix
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {(editing.options ?? []).length < 5 && (
                      <button type="button"
                        onClick={() => setEditing({ ...editing, options: [...(editing.options ?? []), { name: "", required: true, choices: [] }] })}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium"
                        style={{ background: "#F4F0FF", color: "var(--cl-accent-deep)" }}>
                        <Plus className="h-3.5 w-3.5" /> Ajouter un groupe d&apos;options
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--cl-ink-faint)" }}>
                    Demandées au client sur WhatsApp après son panier. Le prix est un supplément (laisser vide = 0).
                    « Obligatoire » décoché : le client peut répondre « Sans ».
                  </p>
                </Field>
              )}

              <Field label="Tags (séparés par des virgules)">
                <input className="cl-input" value={editing.tagsStr ?? ""} onChange={(e) => setEditing({ ...editing, tagsStr: e.target.value })} placeholder="Apple, Électronique, Display" />
              </Field>
              <Interrupteur actif={editing.active ?? true} onChange={(v) => setEditing({ ...editing, active: v })}
                titre="Produit visible" texte="Dans le catalogue et pour l'agent. Décochez pour le masquer sans le supprimer." />
              {restauration && (
                <Interrupteur actif={editing.daily_menu ?? false} onChange={(v) => setEditing({ ...editing, daily_menu: v })}
                  titre="Au menu du jour" texte="Mis en avant sur votre site et annoncé comme plat du jour." />
              )}
              {restauration && (
                <Field label="Jours où ce plat est servi">
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((j) => {
                      const actifs = editing.available_days ?? [];
                      const coche = actifs.includes(j);
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              available_days: coche ? actifs.filter((x) => x !== j) : [...actifs, j].sort(),
                            })
                          }
                          aria-pressed={coche}
                          className="rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                          style={{
                            background: coche ? "var(--cl-ink)" : "#F4F2F7",
                            color: coche ? "#fff" : "var(--cl-ink-soft)",
                          }}
                        >
                          {JOURS[j]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                    Le site annonce alors la prochaine date au client — « disponible jeudi » — au lieu de
                    le laisser deviner. Aucun jour coché : le plat reste commandable sur demande.
                  </p>
                </Field>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--cl-line-soft)" }}>
              <Bouton variante="clair" onClick={() => setEditing(null)}>Annuler</Bouton>
              <Bouton variante="encre" icone={Check} occupe={saving} disabled={saving} onClick={save}>
                {saving ? "Enregistrement…" : editing.id ? "Enregistrer" : "Ajouter au catalogue"}
              </Bouton>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>,
      document.body)}

      <style jsx>{`
        :global(.cl-input) {
          width: 100%; height: 44px; border: 1px solid transparent; border-radius: 999px; padding: 0 16px;
          font-size: 14px; color: var(--cl-ink); background: #F7F6FA; outline: none;
          transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
        }
        :global(textarea.cl-input) { height: auto; border-radius: 20px; padding: 12px 16px; line-height: 1.5; }
        :global(.cl-input:focus) { background: #fff; border-color: var(--cl-accent); box-shadow: 0 0 0 4px rgba(124,90,248,0.12); }
        :global(.cat-panneau) { background: #fff; max-height: 94dvh; box-shadow: -20px 0 60px rgba(25,23,27,0.18); }
        @media (min-width: 640px) { :global(.cat-panneau) { max-height: none; height: 100%; } }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block px-1 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>{label}</label>
      {children}
    </div>
  );
}

/** Un interrupteur arrondi, avec son explication. */
function Interrupteur({ actif, onChange, titre, texte }: { actif: boolean; onChange: (v: boolean) => void; titre: string; texte?: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={() => onChange(!actif)}
      className="flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left" style={{ background: actif ? "#F4F0FF" : "#F7F6FA" }}>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{titre}</span>
        {texte && <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: "var(--cl-ink-faint)" }}>{texte}</span>}
      </span>
      <span className="relative h-7 w-12 flex-shrink-0 rounded-full transition-colors" style={{ background: actif ? "var(--cl-accent)" : "#DCD6E6" }}>
        <motion.span animate={{ x: actif ? 20 : 0 }} transition={RESSORT} className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

const prixDe = (p: Product) => {
  const cur = (p.currency || "XAF") === "XAF" ? "FCFA" : p.currency;
  const a = p.price != null ? Number(p.price) : null;
  const b = p.price_max != null ? Number(p.price_max) : null;
  if (a == null) return "Prix sur demande";
  const n = (x: number) => x.toLocaleString("fr-FR");
  return b != null && b > a ? `${n(a)} – ${n(b)} ${cur}` : `${n(a)} ${cur}`;
};

/** Un produit, dans l'identité du tableau de bord. */
function CarteProduit({ p, rang, restauration, onModifier, onSupprimer, onMenuDuJour }: {
  p: Product; rang: number; restauration: boolean;
  onModifier: () => void; onSupprimer: () => void; onMenuDuJour: () => void;
}) {
  const masque = p.active === false;
  const rupture = p.stock != null && Number(p.stock) <= 0;
  const variantes = Array.isArray(p.variants) ? p.variants : [];
  const photos = 1 + (Array.isArray(p.images) ? p.images.length : 0);
  return (
    <motion.article layout {...apparait(rang)} exit={{ opacity: 0, scale: 0.96 }}
      className="ui-carte group flex flex-col overflow-hidden rounded-[28px]" style={masque ? { opacity: 0.7 } : undefined}>
      <div className="relative m-2 mb-0 aspect-square overflow-hidden rounded-[22px]" style={{ background: "#F4F2F7" }}>
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]" />
        ) : (
          <div className="flex h-full items-center justify-center"><ImageIcon className="h-8 w-8" style={{ color: "#C9C4D2" }} /></div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {p.category && <Pastille ton="gris" className="bg-white/90">{p.category}</Pastille>}
          {masque && <Pastille ton="ambre"><EyeOff className="h-3 w-3" /> Masqué</Pastille>}
          {rupture && <Pastille ton="rouge" point>Rupture</Pastille>}
        </div>
        {p.image_url && photos > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] text-white backdrop-blur">{photos} photos</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug" style={{ color: "var(--cl-ink)" }}>{p.name}</h3>
        <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em]" style={{ color: "var(--cl-ink)" }}>{prixDe(p)}</p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
          {p.stock != null ? `${p.stock} en stock` : "Stock non suivi"} · min. {p.min_order ?? 1}
        </p>

        {variantes.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {variantes.slice(0, 2).map((v) => (
              <div key={v.name} className="flex flex-wrap items-center gap-1.5">
                {(v.options ?? []).slice(0, 5).map((o, i) => {
                  const img = optImage(o);
                  return (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2.5 text-[11.5px]" style={{ background: "#F4F2F7", color: "var(--cl-ink-soft)" }}>
                      {img
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={img} alt="" className="h-5 w-5 rounded-full object-cover" />
                        : <span className="h-5 w-1" />}
                      {optValue(o)}
                    </span>
                  );
                })}
                {(v.options ?? []).length > 5 && <span className="text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>+{(v.options ?? []).length - 5}</span>}
              </div>
            ))}
          </div>
        )}

        {restauration && (
          <button onClick={onMenuDuJour} aria-pressed={!!p.daily_menu}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13px] font-medium"
            style={{ background: p.daily_menu ? "#FFF0F4" : "#F7F6FA", color: p.daily_menu ? "#8E2A47" : "var(--cl-ink-soft)" }}>
            <span className="inline-flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5" /> Menu du jour</span>
            <span className="relative h-6 w-10 rounded-full transition-colors" style={{ background: p.daily_menu ? "#E26D8C" : "#DCD6E6" }}>
              <motion.span animate={{ x: p.daily_menu ? 16 : 0 }} transition={RESSORT} className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white" />
            </span>
          </button>
        )}
        {restauration && Array.isArray(p.available_days) && p.available_days.length > 0 && (
          <p className="mt-2 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Servi : {p.available_days.map((j) => JOURS[j]).join(", ")}</p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Bouton variante="encre" icone={Pencil} className="flex-1" onClick={onModifier}>Modifier</Bouton>
          <BoutonRond icone={Trash2} label="Supprimer" onClick={onSupprimer} className="!text-[#A63D28]" />
        </div>
      </div>
    </motion.article>
  );
}
