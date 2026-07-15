"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, Link2, Check, X, ExternalLink, Search, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ProductCard, type Product } from "@/components/catalog/ProductCard";

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

  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/catalog/${agentId}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/products`, { credentials: "include" });
      const d = await r.json();
      setProducts(d.products ?? []);
    } catch { toast.error("Erreur de chargement du catalogue"); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

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
      active: editing.active ?? true,
      tags: (editing.tagsStr ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      const url = editing.id
        ? `/api/agents/${agentId}/products/${editing.id}`
        : `/api/agents/${agentId}/products`;
      const r = await fetch(url, {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      toast.success(editing.id ? "Produit mis à jour" : "Produit ajouté");
      setEditing(null);
      load();
    } catch { toast.error("Échec de l'enregistrement"); }
    finally { setSaving(false); }
  }

  async function uploadImage(f: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/agents/${agentId}/products/upload`, { method: "POST", credentials: "include", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload échoué");
      setEditing((e) => (e ? { ...e, image_url: d.url } : e));
      toast.success("Image téléversée");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload échoué"); }
    finally { setUploading(false); }
  }

  async function remove(p: Product) {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    try {
      await fetch(`/api/agents/${agentId}/products/${p.id}`, { method: "DELETE", credentials: "include" });
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing({ ...p, tagsStr: (p.tags ?? []).join(", ") })}
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
              <Field label="Tags (séparés par des virgules)">
                <input className="cl-input" value={editing.tagsStr ?? ""} onChange={(e) => setEditing({ ...editing, tagsStr: e.target.value })} placeholder="Apple, Électronique, Display" />
              </Field>
              <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cl-ink)" }}>
                <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                Produit actif (visible dans le catalogue et par l'agent)
              </label>
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
