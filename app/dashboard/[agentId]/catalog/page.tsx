"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, Link2, Check, X, ExternalLink, Search, Upload, ImageIcon, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { JOURS, ProductCard, type Product } from "@/components/catalog/ProductCard";
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

  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/catalog/${agentId}` : "";

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

  const filtered = q.trim()
    ? products.filter((p) => (p.name + " " + (p.category ?? "")).toLowerCase().includes(q.toLowerCase()))
    : products;

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
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--cl-ink)" }}>
            Catalogue
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>
            {products.length} produit{products.length > 1 ? "s" : ""} · exploitable par API et via un lien unique
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { navigator.clipboard.writeText(publicLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium"
            style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink)", background: "#fff" }}
          >
            {copied ? <Check className="h-4 w-4" style={{ color: "var(--cl-green)" }} /> : <Link2 className="h-4 w-4" />}
            {copied ? "Lien copié" : "Lien du catalogue"}
          </button>
          <a
            href={publicLink} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium"
            style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink-soft)", background: "#fff" }}
          >
            <ExternalLink className="h-4 w-4" /> Aperçu
          </a>
          <button
            onClick={() => setEditing({ ...EMPTY })}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: "#16141A" }}
          >
            <Plus className="h-4 w-4" /> Ajouter un produit
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="mt-6 flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid var(--cl-line)", background: "#fff", maxWidth: 320 }}>
        <Search className="h-4 w-4" style={{ color: "var(--cl-ink-faint)" }} />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit…"
          className="w-full bg-transparent text-[13px] outline-none"
          style={{ color: "var(--cl-ink)" }}
        />
      </div>

      {/* Grille */}
      {loading ? (
        <p className="mt-10 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-xl px-6 py-16 text-center" style={{ border: "1px dashed var(--cl-line)" }}>
          <p className="text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>Aucun produit</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--cl-ink-soft)" }}>
            Ajoutez votre premier produit pour construire le catalogue de votre agent.
          </p>
          <button
            onClick={() => setEditing({ ...EMPTY })}
            className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: "#16141A" }}
          >
            <Plus className="h-4 w-4" /> Ajouter un produit
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              footer={
                <div className="space-y-2">
                  {restauration && (
                    <button
                      onClick={() => basculerMenuDuJour(p)}
                      aria-pressed={!!p.daily_menu}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                      style={{
                        border: `1px solid ${p.daily_menu ? "#E8A6B4" : "var(--cl-line)"}`,
                        background: p.daily_menu ? "#FFF3F6" : "#fff",
                        color: p.daily_menu ? "#8E2A47" : "var(--cl-ink-soft)",
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <UtensilsCrossed className="h-3.5 w-3.5" /> Au menu du jour
                      </span>
                      <span
                        className="relative inline-flex h-[18px] w-[32px] flex-shrink-0 items-center rounded-full transition"
                        style={{ background: p.daily_menu ? "#E8A6B4" : "var(--cl-line)" }}
                      >
                        <span
                          className="absolute h-[14px] w-[14px] rounded-full bg-white transition-all"
                          style={{ left: p.daily_menu ? 16 : 2 }}
                        />
                      </span>
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing({
                      ...p,
                      tagsStr: (p.tags ?? []).join(", "),
                      variants: (p.variants ?? []).map((v) => ({
                        name: v.name,
                        options: (v.options ?? []).map((o) => (typeof o === "string" ? { value: o, image: null } : { value: o.value, image: o.image ?? null })),
                      })),
                    })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white"
                    style={{ background: "#16141A" }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ border: "1px solid var(--cl-line)", color: "#C2504B" }}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* Formulaire modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: "rgba(25,23,27,0.45)" }} onClick={() => setEditing(null)}>
          <div
            className="w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl"
            style={{ background: "#fff", maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--cl-line)" }}>
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--cl-ink)" }}>
                {editing.id ? "Modifier le produit" : "Nouveau produit"}
              </h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5" style={{ color: "var(--cl-ink-faint)" }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 p-5">
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
                    className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
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
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium"
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
                    <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg" style={{ border: "1px solid var(--cl-line)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button type="button"
                        onClick={() => setEditing({ ...editing, images: (editing.images ?? []).filter((_, j) => j !== i) })}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: "rgba(25,23,27,0.7)" }} aria-label="Retirer">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg" style={{ border: "1px dashed var(--cl-line)", color: "var(--cl-ink-faint)" }}>
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
                      <div key={gi} className="rounded-lg p-2.5" style={{ border: "1px solid var(--cl-line)" }}>
                        <div className="flex items-center gap-2">
                          <input className="cl-input" style={{ maxWidth: 160 }} value={v.name ?? ""} placeholder="Nom (Couleur, Taille…)"
                            onChange={(e) => setGroup({ name: e.target.value })} />
                          <button type="button" onClick={() => setEditing({ ...editing, variants: (editing.variants ?? []).filter((_, j) => j !== gi) })}
                            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg" style={{ border: "1px solid var(--cl-line)", color: "#C2504B" }} aria-label="Retirer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {opts.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <label className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg" style={{ border: "1px solid var(--cl-line)", background: "var(--cl-bg-soft)" }}>
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
                                className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: "var(--cl-ink-faint)" }} aria-label="Retirer option">
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
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium"
                    style={{ border: "1px dashed var(--cl-line)", color: "var(--cl-ink-soft)" }}>
                    <Plus className="h-3.5 w-3.5" /> Ajouter une variation
                  </button>
                </div>
              </Field>

              <Field label="Tags (séparés par des virgules)">
                <input className="cl-input" value={editing.tagsStr ?? ""} onChange={(e) => setEditing({ ...editing, tagsStr: e.target.value })} placeholder="Apple, Électronique, Display" />
              </Field>
              <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cl-ink)" }}>
                <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                Produit actif (visible dans le catalogue et par l'agent)
              </label>
              {restauration && (
                <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--cl-ink)" }}>
                  <input
                    type="checkbox"
                    checked={editing.daily_menu ?? false}
                    onChange={(e) => setEditing({ ...editing, daily_menu: e.target.checked })}
                    className="mt-[3px]"
                  />
                  <span>
                    Au menu du jour
                    <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                      Mis en avant sur votre site et annoncé comme plat du jour. À décocher quand il quitte la carte du jour.
                    </span>
                  </span>
                </label>
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
                          className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold"
                          style={{
                            border: `1px solid ${coche ? "#7C5AF8" : "var(--cl-line)"}`,
                            background: coche ? "#F1ECFF" : "#fff",
                            color: coche ? "#4B32B5" : "var(--cl-ink-soft)",
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

            <div className="flex items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: "var(--cl-line)" }}>
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-[13px] font-medium" style={{ border: "1px solid var(--cl-line)", color: "var(--cl-ink)" }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving} className="rounded-lg px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-60" style={{ background: "#16141A" }}>
                {saving ? "Enregistrement…" : editing.id ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.cl-input) {
          width: 100%;
          border: 1px solid var(--cl-line);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          color: var(--cl-ink);
          background: #fff;
          outline: none;
        }
        :global(.cl-input:focus) { border-color: var(--cl-accent); box-shadow: 0 0 0 3px rgba(124,90,248,0.12); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--cl-ink-soft)" }}>{label}</label>
      {children}
    </div>
  );
}
