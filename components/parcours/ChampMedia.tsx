"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le choix d'un média dans un bloc du parcours : on le VOIT (image, vidéo,
// vocal lisibles sur place), on connaît son POIDS (WhatsApp refuse au-delà de
// 16 Mo pour une vidéo ou un vocal), et on le prend où il est : la
// médiathèque de l'agent, les médias d'accueil réglés sur l'agent, ou une
// adresse collée.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Images, Link as LinkIcon, Minimize2, Sparkles, Upload, XCircle } from "lucide-react";
import { authHeaders } from "@/lib/auth-client";
import { MEDIA_AGENT } from "@/lib/parcours-regles";

export type MediasAccueil = { audio_accueil?: string; video_accueil?: string };

type Props = {
  type: "image" | "video" | "vocal" | "document";
  url: string;
  onChange: (url: string) => void;
  agentId: string;
  accueil: MediasAccueil;
  /** La vidéo d'accueil de l'agent vient d'être remplacée par sa version compressée. */
  onAccueil?: (m: MediasAccueil) => void;
};

/** Ce que le serveur a lu dans la vidéo (ffprobe) et son verdict pour Meta. */
type Verif = { passe: boolean; raisons: string[]; reparable?: boolean; avant?: { resume: string; taille: number } };

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

export default function ChampMedia({ type, url, onChange, agentId, accueil, onAccueil }: Props) {
  const [mode, setMode] = useState<"lien" | "mediatheque" | null>(null);
  const [images, setImages] = useState<{ id: string; url: string; caption: string; kind: string }[] | null>(null);
  const [taille, setTaille] = useState<number | null>(null);
  const [verif, setVerif] = useState<Verif | "analyse" | { erreur: string } | null>(null);
  const [travail, setTravail] = useState<string | null>(null);   // « Compression… », « Envoi… »
  const [bilan, setBilan] = useState<string | null>(null);       // « 19 Mo → 11 Mo »
  const fichierRef = useRef<HTMLInputElement>(null);

  const accueilCle = url.match(MEDIA_AGENT)?.[0];
  const reelle = accueilCle ? (accueilCle === "{audio_accueil}" ? accueil.audio_accueil : accueil.video_accueil) || "" : url;

  useEffect(() => {
    setTaille(null);
    if (!/^https:\/\//.test(reelle)) return;
    let vivant = true;
    poids(reelle).then((n) => { if (vivant) setTaille(n); });
    return () => { vivant = false; };
  }, [reelle]);

  // Pour une vidéo, le serveur lit le fichier (poids, codecs, couleurs) et
  // dit s'il passera chez Meta tel quel.
  useEffect(() => {
    setVerif(null);
    if (type !== "video" || !/^https:\/\//.test(reelle)) return;
    let vivant = true;
    const minuteur = setTimeout(async () => {
      setVerif("analyse");
      try {
        const r = await fetch(`/api/agents/${agentId}/media/whatsapp`, {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ action: "verifier", url: reelle }),
        });
        const j = await r.json();
        if (vivant) setVerif(r.ok ? j : { erreur: j.error || "Analyse impossible" });
      } catch { if (vivant) setVerif({ erreur: "Analyse impossible" }); }
    }, 600);
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [reelle, type, agentId]);

  const appliquer = (j: { url: string; compressee?: boolean; avant?: { taille: number }; apres?: { taille: number } }) => {
    if (j.compressee && j.avant && j.apres) setBilan(`${mo(j.avant.taille)} → ${mo(j.apres.taille)}, prête pour WhatsApp`);
    else setBilan("Déjà conforme : rien à changer");
    if (accueilCle) onAccueil?.({ ...accueil, video_accueil: j.url });
    else onChange(j.url);
  };

  async function compresser() {
    setTravail("Compression en cours… (jusqu'à une minute)"); setBilan(null);
    try {
      const r = await fetch(`/api/agents/${agentId}/media/whatsapp`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(accueilCle ? { action: "compresser", accueil: true } : { action: "compresser", url }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Compression impossible");
      appliquer(j);
    } catch (e) { setBilan(`✗ ${(e as Error).message}`); }
    finally { setTravail(null); }
  }

  async function deposer(f: File) {
    setTravail(`Envoi de ${f.name} et préparation pour WhatsApp…`); setBilan(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/agents/${agentId}/media/whatsapp`, { method: "POST", headers: { ...authHeaders() }, body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Dépôt impossible");
      setMode(null);
      onChange(j.url);
      setBilan(j.compressee ? `${mo(j.avant.taille)} → ${mo(j.apres.taille)}, prête pour WhatsApp` : "Vidéo déposée, déjà conforme");
    } catch (e) { setBilan(`✗ ${(e as Error).message}`); }
    finally { setTravail(null); }
  }

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

      {/* Vidéo : le verdict du serveur, plus précis que le seul poids. */}
      {reelle && type === "video" && verif && verif !== "analyse" && !("erreur" in verif) && (
        <div className="grid gap-1.5 rounded-[12px] p-2.5 text-[12px]"
          style={{ background: verif.passe ? "#EAF6EE" : "#FBEDE8", color: verif.passe ? "#1F6B3A" : "#A63D28" }}>
          <p className="flex items-start gap-1.5 font-medium">
            {verif.passe ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0" /> : <XCircle className="mt-px h-4 w-4 shrink-0" />}
            {verif.passe ? "Passe sur WhatsApp telle quelle" : "Ne passera pas telle quelle chez Meta"}
          </p>
          {verif.avant && <p style={{ color: "var(--cl-ink-soft)" }}>{accueilCle && <>Média d&apos;accueil de l&apos;agent · </>}{verif.avant.resume}</p>}
          {!verif.passe && <ul className="ml-5 list-disc">{verif.raisons.map((x) => <li key={x}>{x}</li>)}</ul>}
          {!verif.passe && (verif.reparable ? (
            <>
              <p style={{ color: "var(--cl-ink-soft)" }}>
                Camille la compressera de toute façon au premier envoi. Compressez maintenant pour voir le résultat ici.
              </p>
              <button className="pc-puce justify-self-start" data-actif disabled={!!travail} onClick={compresser}>
                <Minimize2 className="h-3.5 w-3.5" /> Compresser pour WhatsApp
              </button>
            </>
          ) : (
            <p style={{ color: "var(--cl-ink-soft)" }}>Trop longue pour tenir dans 16 Mo en restant nette : raccourcissez-la, sinon elle partira comme document à télécharger.</p>
          ))}
        </div>
      )}
      {reelle && type === "video" && verif === "analyse" && (
        <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>Analyse de la vidéo…</p>
      )}
      {travail && <p className="text-[12px] font-medium" style={{ color: "var(--cl-ink)" }}>{travail}</p>}
      {bilan && <p className="text-[12px] font-medium" style={{ color: bilan.startsWith("✗") ? "#A63D28" : "#1F6B3A" }}>{bilan}</p>}

      {reelle && (type !== "video" || (verif !== null && verif !== "analyse" && "erreur" in verif)) && (
        <p className="text-[12px]" style={{ color: tropLourd ? "#A63D28" : "var(--cl-ink-faint)" }}>
          {accueilCle && <>Média d&apos;accueil de l&apos;agent · </>}
          {taille === null ? "Poids inconnu" : mo(taille)}
          {tropLourd && (type === "video"
            ? ` — au-delà de ${MAX_WHATSAPP.video} Mo, WhatsApp refuse la vidéo : Camille la compressera au premier envoi.`
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
        {type === "video" && (
          <button className="pc-puce" disabled={!!travail} onClick={() => fichierRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Déposer une vidéo
          </button>
        )}
        <button className="pc-puce" data-actif={mode === "lien" || undefined} onClick={() => setMode(mode === "lien" ? null : "lien")}>
          <LinkIcon className="h-3.5 w-3.5" /> Adresse
        </button>
      </div>

      <input ref={fichierRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) deposer(f); }} />

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
        .pc-puce:disabled { opacity: .5; cursor: wait; }
      `}</style>
    </div>
  );
}
