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
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ImagePlus, Images, Info, Loader2, Trash2, Upload } from "lucide-react";
import { Bouton, BoutonRond, Filtres, Pastille, Squelettes, StylesUI, Tuile, Vide, apparait } from "@/components/dashboard/ui";
import { RESSORT } from "@/components/dashboard/coquille/Entete";

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
  const [vue, setVue] = useState<string>("tous");

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

  const meta = kindOf(kind);
  const visibles = vue === "tous" ? media : media.filter((m) => m.kind === vue);
  const compte = (k: string) => media.filter((m) => m.kind === k).length;
  const aLogo = compte("logo") > 0;

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* ── Le dépôt ──────────────────────────────────────────────────────── */}
        <motion.section {...apparait(0)} className="ui-carte self-start rounded-[30px] p-5 sm:p-6 xl:sticky xl:top-[96px]">
          <p className="text-[18px] font-medium" style={{ color: "var(--cl-ink)" }}>Ajouter des visuels</p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>
            Envoyés une fois, réutilisés partout : site, conversation WhatsApp, bon de commande. JPG, PNG ou WEBP, 5 Mo maximum.
          </p>

          {/* La nature, en boutons radio arrondis */}
          <p className="mt-5 text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>Nature</p>
          <div role="radiogroup" aria-label="Nature du visuel" className="mt-2 flex flex-wrap gap-1.5">
            {KINDS.map((k) => {
              const actif = kind === k.key;
              return (
                <button key={k.key} role="radio" aria-checked={actif} onClick={() => setKind(k.key)}
                  className="relative rounded-full px-3.5 py-2 text-[13px] transition-colors"
                  style={{ color: actif ? "#fff" : "var(--cl-ink-soft)", background: actif ? "transparent" : "#F4F2F7" }}>
                  {actif && <motion.span layoutId="media-nature" transition={RESSORT} className="absolute inset-0 rounded-full" style={{ background: "var(--cl-ink)" }} />}
                  <span className="relative">{k.label}</span>
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={kind} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="mt-3 flex items-start gap-2 rounded-[18px] px-3.5 py-3 text-[12.5px] leading-snug" style={{ background: "#F4F0FF", color: "#4B32B5" }}>
              <Info className="mt-[2px] h-3.5 w-3.5 flex-shrink-0" />
              <span>{meta.where}{meta.unique && " Un seul visuel de cette nature : le nouveau remplace l'ancien."}</span>
            </motion.p>
          </AnimatePresence>

          <label className="mt-4 block">
            <span className="text-[13px] font-medium" style={{ color: "var(--cl-ink)" }}>
              Légende <span className="font-normal" style={{ color: "var(--cl-ink-faint)" }}>{meta.needsCaption ? "· nom exact du rayon" : "· facultative"}</span>
            </span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} list="rayons"
              placeholder={meta.needsCaption ? "Ex. Déjeuners" : "Ex. Notre salle"} className="ui-champ mt-1.5" />
            <datalist id="rayons">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>

          {/* La zone de dépôt : on y glisse, ou on clique */}
          <button type="button"
            onClick={() => fileInput.current?.click()} disabled={busy}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
            className="media-depot mt-4 flex w-full flex-col items-center justify-center rounded-[26px] px-4 py-7 text-center disabled:cursor-wait"
            data-glisse={dragging ? "1" : undefined}>
            <motion.span animate={{ y: dragging ? -4 : 0, scale: dragging ? 1.08 : 1 }} transition={RESSORT}
              className="flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: "var(--cl-ink)" }}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </motion.span>
            <span className="mt-3 text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>
              {busy ? "Envoi en cours…" : dragging ? "Lâchez pour envoyer" : "Déposez vos images ici"}
            </span>
            <span className="mt-0.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>ou cliquez pour les choisir</span>
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden
            onChange={(e) => e.target.files && upload(e.target.files)} />

          {kind === "category" && missingCategoryVisuals.length > 0 && (
            <div className="mt-4">
              <p className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>Rayons encore sans visuel (sinon, la photo du premier article est reprise) :</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missingCategoryVisuals.map((c) => (
                  <button key={c} onClick={() => setCaption(c)} className="rounded-full px-3 py-1.5 text-[12.5px]"
                    style={caption === c ? { background: "var(--cl-ink)", color: "#fff" } : { background: "#FDF1DC", color: "#8A5A00" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.section>

        {/* ── La bibliothèque ───────────────────────────────────────────────── */}
        <section className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tuile rang={1} icone={Images} titre="Visuels" valeur={media.length} sous="dans la bibliothèque" />
            <Tuile rang={2} icone={ImagePlus} titre="Logo" valeur={aLogo ? "Oui" : "Non"} fort={!aLogo}
              sous={aLogo ? "sur les bons de commande" : "à ajouter en premier"} onClick={() => setKind("logo")} />
            <Tuile rang={3} icone={Info} titre="Rayons sans visuel" valeur={missingCategoryVisuals.length}
              sous={categories.length ? `sur ${categories.length} rayons` : "aucun rayon au catalogue"} onClick={() => setKind("category")} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Filtres id="medias" label="Filtrer la bibliothèque" valeur={vue} onChange={setVue}
              options={[{ cle: "tous", libelle: "Tous", compte: media.length },
                ...KINDS.filter((k) => compte(k.key) > 0).map((k) => ({ cle: k.key, libelle: k.label, compte: compte(k.key) }))]} />
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Squelettes n={3} hauteur={240} /></div>
            ) : media.length === 0 ? (
              <Vide doodle="sitting-reading" titre="Aucun visuel pour l'instant."
                texte="Commencez par le logo : c'est lui qui apparaît sur les bons de commande et le profil WhatsApp."
                action={<Bouton variante="encre" icone={Upload} onClick={() => { setKind("logo"); fileInput.current?.click(); }}>Envoyer le logo</Bouton>} />
            ) : (
              <motion.div layout className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {visibles.map((item, i) => {
                    const index = media.findIndex((m) => m.id === item.id);
                    return (
                      <motion.article key={item.id} layout {...apparait(i)} exit={{ opacity: 0, scale: 0.95 }}
                        className="ui-carte group overflow-hidden rounded-[26px]">
                        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "#F4F2F7" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.url} alt={item.caption || item.kind} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                          <span className="absolute left-3 top-3"><Pastille ton="violet">{kindOf(item.kind).label}</Pastille></span>
                          <div className="absolute right-3 top-3 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <BoutonRond icone={ArrowLeft} label="Déplacer avant" onClick={() => move(item.id, -1)} disabled={index === 0} className="h-9 w-9" />
                            <BoutonRond icone={ArrowRight} label="Déplacer après" onClick={() => move(item.id, 1)} disabled={index === media.length - 1} className="h-9 w-9" />
                            <BoutonRond icone={Trash2} label="Supprimer" onClick={() => remove(item)} className="h-9 w-9 !text-[#A63D28]" />
                          </div>
                        </div>
                        <div className="space-y-2 p-3.5">
                          <input value={item.caption} onChange={(e) => patch(item.id, { caption: e.target.value })} list="rayons"
                            placeholder={item.kind === "category" ? "Nom du rayon" : "Légende"} className="ui-champ !h-10 !text-[13.5px]" />
                          <label className="relative block">
                            <span className="sr-only">Nature</span>
                            <select value={item.kind} onChange={(e) => patch(item.id, { kind: e.target.value })}
                              className="ui-champ !h-10 cursor-pointer appearance-none !text-[13px]">
                              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
                          </label>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>
      </div>

      {/* Les modifications en attente : une barre flottante, impossible à rater */}
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={RESSORT}
            className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-5 pr-2 shadow-2xl sm:bottom-7"
            style={{ background: "var(--cl-ink)", color: "#fff" }}>
            <span className="whitespace-nowrap text-[13.5px]">Modifications non enregistrées</span>
            <Bouton variante="clair" icone={Check} occupe={busy} disabled={busy} onClick={save}>Enregistrer</Bouton>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .media-depot { border: 2px dashed #D9D2EE; background: #FAF9FC; transition: border-color .2s ease, background-color .2s ease; }
        .media-depot:hover, .media-depot[data-glisse] { border-color: var(--cl-accent); background: #F4F0FF; }
      `}</style>
    </div>
  );
}
