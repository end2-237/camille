"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Médias — la bibliothèque de visuels d'un agent.
//
// Jusqu'ici, une image ne pouvait entrer que par une URL collée à la main :
// il fallait donc l'héberger ailleurs d'abord. On envoie maintenant le fichier
// directement, on lui donne une nature, et chaque surface s'en sert.
//
// Rien de propre à un métier : ce sont des visuels typés. Un marchand sans
// rayons n'utilise pas la nature « rayon », c'est tout.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ImageIcon, Info, Loader2, Trash2, Upload } from "lucide-react";

type MediaItem = { id: string; kind: string; url: string; caption: string };

/** Les natures, et surtout : où chacune se voit. */
const KINDS: { key: string; label: string; where: string; unique?: boolean; needsCaption?: boolean }[] = [
  { key: "logo", label: "Logo", where: "En-tête du site, bon de commande, profil WhatsApp.", unique: true },
  { key: "banner", label: "Bandeau", where: "Large image d'accueil du site.", unique: true },
  {
    key: "category",
    label: "Visuel de rayon",
    where: "Vignette d'un rayon du catalogue. La légende doit porter le nom exact du rayon.",
    needsCaption: true,
  },
  { key: "gallery", label: "Galerie", where: "Photos d'ambiance : salle, équipe, coulisses." },
  { key: "menu", label: "Carte / menu", where: "La carte en image, envoyée dans la conversation." },
  { key: "services", label: "Services", where: "Fiche de prestations montrée aux clients." },
  { key: "flyers", label: "Flyers", where: "Affiches et promotions à diffuser." },
];

const kindOf = (key: string) => KINDS.find((k) => k.key === key) ?? KINDS[3];

export default function MediasPage() {
  const { agentId } = useParams<{ agentId: string }>();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [kind, setKind] = useState("gallery");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/visuals`, { headers: { ...authHeaders() } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Chargement impossible");
      setMedia(d.media ?? []);
      setDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Les rayons du catalogue servent de suggestions de légende : taper le nom à
  // la main, c'est se tromper d'un accent et perdre le rattachement.
  const loadCategories = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/${agentId}/products?limit=200`, { headers: { ...authHeaders() } });
      const d = await r.json();
      const list: string[] = Array.isArray(d.products)
        ? [...new Set(d.products.map((p: { category?: string }) => (p.category ?? "").trim()).filter(Boolean))] as string[]
        : [];
      setCategories(list);
    } catch {
      /* les suggestions sont un confort, pas une condition */
    }
  }, [agentId]);

  useEffect(() => {
    load();
    loadCategories();
  }, [load, loadCategories]);

  const missingCategoryVisuals = useMemo(() => {
    const done = new Set(
      media.filter((m) => m.kind === "category").map((m) => m.caption.trim().toLowerCase()),
    );
    return categories.filter((c) => !done.has(c.toLowerCase()));
  }, [categories, media]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;

    const meta = kindOf(kind);
    if (meta.needsCaption && !caption.trim()) {
      toast.error("Donne d'abord le nom du rayon en légende.");
      return;
    }

    setBusy(true);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        fd.append("caption", caption.trim());
        const r = await fetch(`/api/agents/${agentId}/visuals`, {
          method: "POST",
          headers: { ...authHeaders() },
          body: fd,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Envoi impossible");
        setMedia(d.media ?? []);
      }
      toast.success(list.length > 1 ? `${list.length} visuels ajoutés` : "Visuel ajouté");
      setCaption("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(item: MediaItem) {
    if (!confirm(`Supprimer ce visuel ${kindOf(item.kind).label.toLowerCase()} ?`)) return;
    try {
      const r = await fetch(`/api/agents/${agentId}/visuals?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Suppression impossible");
      setMedia(d.media ?? []);
      toast.success("Visuel supprimé");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/visuals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ media }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
      setMedia(d.media ?? []);
      setDirty(false);
      toast.success("Médiathèque enregistrée");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function patch(id: string, change: Partial<MediaItem>) {
    setMedia((m) => m.map((x) => (x.id === id ? { ...x, ...change } : x)));
    setDirty(true);
  }

  function move(id: string, dir: -1 | 1) {
    setMedia((m) => {
      const i = m.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= m.length) return m;
      const copy = [...m];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setDirty(true);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Médias</h1>
          <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-[var(--cl-sub)]">
            Les images de ton commerce, envoyées une fois et réutilisées partout : site,
            conversation WhatsApp, bon de commande. JPG, PNG ou WEBP, 5 Mo maximum.
          </p>
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#101012] px-5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Enregistrer les modifications
          </button>
        )}
      </header>

      {/* Dépôt */}
      <section className="mt-6 rounded-2xl border border-[var(--cl-line)] bg-white p-5">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                kind === k.key ? "bg-[#101012] text-white" : "bg-[#F4F4F5] text-[var(--cl-sub)] hover:bg-[#EAEAEB]"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--cl-sub)]">
          <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          {kindOf(kind).where}
          {kindOf(kind).unique && " Un seul visuel de cette nature : le nouveau remplace l'ancien."}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--cl-sub)]">
              Légende {kindOf(kind).needsCaption ? "(nom exact du rayon)" : "(facultative)"}
            </span>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              list="rayons"
              placeholder={kindOf(kind).needsCaption ? "Ex. Déjeuners" : "Ex. Notre salle"}
              className="mt-1 h-10 w-full rounded-lg border border-[var(--cl-line)] px-3 text-[14px] outline-none focus:border-[#101012]"
            />
            <datalist id="rayons">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#101012] px-5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Choisir des images
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files);
          }}
          className={`mt-4 flex h-24 items-center justify-center rounded-xl border border-dashed text-[13px] transition ${
            dragging ? "border-[#101012] bg-[#F4F4F5]" : "border-[var(--cl-line)] text-[var(--cl-sub)]"
          }`}
        >
          Dépose tes images ici
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />

        {kind === "category" && missingCategoryVisuals.length > 0 && (
          <p className="mt-3 text-[12.5px] leading-snug text-[var(--cl-sub)]">
            Rayons encore sans visuel : {missingCategoryVisuals.join(", ")}. Sans image, le site
            reprend la photo du premier article du rayon.
          </p>
        )}
      </section>

      {/* Bibliothèque */}
      <section className="mt-8">
        <h2 className="text-[15px] font-bold">
          Bibliothèque {media.length > 0 && <span className="text-[var(--cl-sub)]">({media.length})</span>}
        </h2>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--cl-sub)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : media.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-[var(--cl-line)] p-10 text-center">
            <ImageIcon className="h-6 w-6 text-[var(--cl-sub)]" />
            <p className="mt-3 text-[14px] font-semibold">Aucun visuel pour l’instant</p>
            <p className="mt-1 text-[13px] text-[var(--cl-sub)]">
              Commence par le logo : c’est lui qui apparaît sur les bons de commande.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item, index) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--cl-line)] bg-white">
                <div className="relative h-40 bg-[#F4F4F5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.caption || item.kind} className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold">
                    {kindOf(item.kind).label}
                  </span>
                </div>

                <div className="p-3">
                  <input
                    value={item.caption}
                    onChange={(e) => patch(item.id, { caption: e.target.value })}
                    list="rayons"
                    placeholder={item.kind === "category" ? "Nom du rayon" : "Légende"}
                    className="h-9 w-full rounded-lg border border-[var(--cl-line)] px-2.5 text-[13px] outline-none focus:border-[#101012]"
                  />

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <select
                      value={item.kind}
                      onChange={(e) => patch(item.id, { kind: e.target.value })}
                      className="h-8 rounded-lg border border-[var(--cl-line)] px-2 text-[12px] outline-none"
                    >
                      {KINDS.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => move(item.id, -1)}
                        disabled={index === 0}
                        aria-label="Déplacer avant"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cl-line)] disabled:opacity-40"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => move(item.id, 1)}
                        disabled={index === media.length - 1}
                        aria-label="Déplacer après"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cl-line)] disabled:opacity-40"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(item)}
                        aria-label="Supprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cl-line)] text-[#c0392b]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
