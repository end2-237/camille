"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le choix d'un média dans un bloc du parcours : on le VOIT (image, vidéo,
// vocal lisibles sur place), on connaît son POIDS (WhatsApp refuse au-delà de
// 16 Mo pour une vidéo ou un vocal), et on le prend où il est : la
// médiathèque de l'agent, les médias d'accueil réglés sur l'agent, ou une
// adresse collée.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { FileText, Images, Link as LinkIcon, Sparkles } from "lucide-react";
import { authHeaders } from "@/lib/auth-client";
import { MEDIA_AGENT } from "@/lib/parcours-regles";

export type MediasAccueil = { audio_accueil?: string; video_accueil?: string };

type Props = {
  type: "image" | "video" | "vocal" | "document";
  url: string;
  onChange: (url: string) => void;
  agentId: string;
  accueil: MediasAccueil;
};

const MAX_WHATSAPP = { image: 5, video: 16, vocal: 16, document: 100 } as const;
const tailles = new Map<string, number | null>();

/** Le poids du fichier, lu sans le télécharger (en-tête HTTP), ou null si le serveur ne le dit pas. */
async function poids(url: string): Promise<number | null> {
  if (tailles.has(url)) return tailles.get(url)!;
  let n: number | null = null;
  try {
    const r = await fetch(url, { method: "HEAD" });
    n = Number(r.headers.get("content-length")) || null;
    if (!n) {
      const g = await fetch(url, { headers: { Range: "bytes=0-0" } });
      n = Number((g.headers.get("content-range") || "").split("/")[1]) || null;
    }
  } catch { n = null; }
  tailles.set(url, n);
  return n;
}

const mo = (o: number) => `${(o / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

export default function ChampMedia({ type, url, onChange, agentId, accueil }: Props) {
  const [mode, setMode] = useState<"lien" | "mediatheque" | null>(null);
  const [images, setImages] = useState<{ id: string; url: string; caption: string; kind: string }[] | null>(null);
  const [taille, setTaille] = useState<number | null>(null);

  const accueilCle = url.match(MEDIA_AGENT)?.[0];
  const reelle = accueilCle ? (accueilCle === "{audio_accueil}" ? accueil.audio_accueil : accueil.video_accueil) || "" : url;

  useEffect(() => {
    setTaille(null);
    if (!/^https:\/\//.test(reelle)) return;
    let vivant = true;
    poids(reelle).then((n) => { if (vivant) setTaille(n); });
    return () => { vivant = false; };
  }, [reelle]);

  useEffect(() => {
    if (mode !== "mediatheque" || images) return;
    fetch(`/api/agents/${agentId}/visuals`, { headers: { ...authHeaders() } })
      .then((r) => r.json()).then((d) => setImages(d.media || [])).catch(() => setImages([]));
  }, [mode, images, agentId]);

  const max = MAX_WHATSAPP[type] * 1048576;
  const tropLourd = taille !== null && taille > max;
  const accueilPossible = type === "video" ? "{video_accueil}" : type === "vocal" ? "{audio_accueil}" : null;

  return (
    <div className="grid gap-2">
      <span className="text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
        {type === "image" ? "Image" : type === "video" ? "Vidéo" : type === "vocal" ? "Vocal" : "Document"}
      </span>

      {/* L'aperçu : ce que le client verra. */}
      <div className="overflow-hidden rounded-[16px]" style={{ background: "#F4F2F7" }}>
        {!reelle ? (
          <p className="p-4 text-center text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
            {accueilCle ? "Aucun média d'accueil réglé sur cet agent : ce bloc sera sauté." : "Aucun média choisi."}
          </p>
        ) : type === "image" ? (
          <img src={reelle} alt="" className="max-h-[220px] w-full object-contain" />
        ) : type === "video" ? (
          <video src={reelle} controls preload="metadata" className="max-h-[240px] w-full bg-black" />
        ) : type === "vocal" ? (
          <audio src={reelle} controls preload="metadata" className="w-full p-2" />
        ) : (
          <a href={reelle} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-[13px]" style={{ color: "var(--cl-ink)" }}>
            <FileText className="h-6 w-6" color="#E0632B" /> {reelle.split("/").pop()}
          </a>
        )}
      </div>

      {reelle && (
        <p className="text-[12px]" style={{ color: tropLourd ? "#A63D28" : "var(--cl-ink-faint)" }}>
          {accueilCle && <>Média d&apos;accueil de l&apos;agent · </>}
          {taille === null ? "Poids inconnu" : mo(taille)}
          {tropLourd && (type === "video"
            ? ` — au-delà de ${MAX_WHATSAPP.video} Mo, WhatsApp refuse la vidéo : Camille l'enverra comme document (à télécharger). Compressez-la pour qu'elle se lise directement.`
            : ` — au-delà de ${MAX_WHATSAPP[type]} Mo, WhatsApp refuse ce fichier.`)}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {type === "image" && (
          <button className="pc-puce" data-actif={mode === "mediatheque" || undefined} onClick={() => setMode(mode === "mediatheque" ? null : "mediatheque")}>
            <Images className="h-3.5 w-3.5" /> Mes médias
          </button>
        )}
        {accueilPossible && (
          <button className="pc-puce" data-actif={url === accueilPossible || undefined} onClick={() => { onChange(accueilPossible); setMode(null); }}>
            <Sparkles className="h-3.5 w-3.5" /> {type === "video" ? "Vidéo" : "Vocal"} d&apos;accueil de l&apos;agent
          </button>
        )}
        <button className="pc-puce" data-actif={mode === "lien" || undefined} onClick={() => setMode(mode === "lien" ? null : "lien")}>
          <LinkIcon className="h-3.5 w-3.5" /> Adresse
        </button>
      </div>

      {mode === "lien" && (
        <input className="ui-champ" placeholder="https://…" value={accueilCle ? "" : url} onChange={(e) => onChange(e.target.value.trim())} />
      )}
      {mode === "mediatheque" && (
        <div className="grid max-h-[220px] grid-cols-3 gap-1.5 overflow-y-auto rounded-[14px] p-1.5" style={{ background: "#F7F5FA" }}>
          {images === null && <p className="col-span-3 p-3 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Chargement…</p>}
          {images?.length === 0 && <p className="col-span-3 p-3 text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Aucune image : ajoutez-en dans Catalogue › Médias.</p>}
          {images?.map((m) => (
            <button key={m.id} title={m.caption || m.kind} onClick={() => { onChange(m.url); setMode(null); }}
              className="aspect-square overflow-hidden rounded-[10px]" style={{ outline: m.url === url ? "2px solid #19171B" : undefined }}>
              <img src={m.url} alt={m.caption} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <style jsx global>{`
        .pc-puce { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; background: #F4F2F7; padding: 5px 10px; font-size: 12px; color: var(--cl-ink); }
        .pc-puce[data-actif] { background: #19171B; color: #fff; }
      `}</style>
    </div>
  );
}
