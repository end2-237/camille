// ─────────────────────────────────────────────────────────────────────────────
// Rendre une vidéo acceptable par WhatsApp : l'analyser (ffprobe), la
// recompresser au besoin (ffmpeg), la déposer sur camille-core.
//
// Trois usages :
//   - au DÉPÔT (vidéo d'accueil, vidéo d'un parcours) : on stocke une vidéo
//     déjà conforme ;
//   - dans l'ÉDITEUR : « passe / ne passe pas » et le bouton « Compresser » ;
//   - à l'ENVOI, en filet de sécurité : une adresse trop lourde est allégée une
//     fois, la version légère est gardée sur core sous un nom tiré de
//     l'adresse d'origine, et les envois suivants la reprennent sans
//     recompresser — même après un redémarrage.
//
// Sécurité (le conteneur a été visé cette semaine) : ffmpeg tourne sans root
// (utilisateur node), sans shell (execFile), sur un fichier local seulement
// (-protocol_whitelist file : un fichier piégé ne peut rien aller chercher
// ailleurs), avec une durée limitée, et une compression à la fois.
// ─────────────────────────────────────────────────────────────────────────────
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type InfoVideo, type Verdict, VIDEO_MAX_OCTETS, argumentsFfmpeg, debitSansContrainte, debitVideo,
  formatAdmis, verdictVideo,
} from "./video-regles";

/** Au-delà, on ne télécharge même pas : aucune vidéo de cette taille n'a sa place dans un parcours. */
export const VIDEO_SOURCE_MAX = 300 * 1024 * 1024;
const DUREE_FFMPEG = 6 * 60_000;

const coreUrl = () => (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");

function lancer(cmd: string, args: string[], delai: number): Promise<string> {
  return new Promise((ok, ko) => {
    execFile(cmd, args, { timeout: delai, killSignal: "SIGKILL", maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) ko(new Error(`${cmd} : ${(stderr || err.message).toString().trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`));
      else ok(stdout.toString());
    });
  });
}

// Une compression à la fois : deux vidéos en parallèle mettraient le serveur
// à genoux pour tous les autres commerçants.
let file: Promise<unknown> = Promise.resolve();
function unParUn<T>(f: () => Promise<T>): Promise<T> {
  const r = file.then(f, f);
  file = r.catch(() => undefined);
  return r;
}

/** ffmpeg est-il installé ? (absent en développement local sans ffmpeg) */
let present: boolean | null = null;
export async function ffmpegDisponible(): Promise<boolean> {
  if (present === null) present = await lancer("ffprobe", ["-version"], 5000).then(() => true, () => false);
  return present;
}

/** Ce que contient un fichier vidéo local. */
export async function analyser(chemin: string): Promise<InfoVideo> {
  const sortie = await lancer("ffprobe", [
    "-v", "error", "-protocol_whitelist", "file", "-print_format", "json", "-show_format", "-show_streams", chemin,
  ], 30_000);
  const j = JSON.parse(sortie) as {
    format?: { format_name?: string; duration?: string; size?: string };
    streams?: { codec_type?: string; codec_name?: string; pix_fmt?: string; width?: number; height?: number; duration?: string }[];
  };
  const flux = j.streams || [];
  const v = flux.find((s) => s.codec_type === "video" && s.codec_name !== "mjpeg" && s.codec_name !== "png");
  const a = flux.filter((s) => s.codec_type === "audio");
  return {
    taille: Number(j.format?.size) || 0,
    duree: Number(j.format?.duration) || Number(v?.duration) || 0,
    format: j.format?.format_name || "",
    codecVideo: v?.codec_name || null,
    codecAudio: a[0]?.codec_name || null,
    pistesAudio: a.length,
    pixels: v?.pix_fmt || null,
    largeur: v?.width || 0,
    hauteur: v?.height || 0,
  };
}

export type Preparation = {
  octets: Buffer;
  avant: InfoVideo;
  apres: InfoVideo;
  compressee: boolean;
  verdict: Verdict;      // celui de la version finale
};

/**
 * La vidéo prête pour WhatsApp : telle quelle si elle passe déjà, sinon
 * recompressée (H.264 / AAC / MP4, sous 16 Mo). Lève une erreur claire si
 * c'est impossible (pas une vidéo, format refusé, vidéo trop longue).
 */
export async function preparerVideo(source: Buffer): Promise<Preparation> {
  if (!(await ffmpegDisponible())) throw new Error("La compression vidéo n'est pas installée sur ce serveur (ffmpeg absent).");
  const dossier = await mkdtemp(join(tmpdir(), "camille-video-"));
  try {
    const entree = join(dossier, "entree");
    await writeFile(entree, source);
    const avant = await analyser(entree).catch(() => { throw new Error("Ce fichier n'est pas une vidéo lisible."); });
    if (!formatAdmis(avant.format)) throw new Error(`Format vidéo non pris en charge (${avant.format || "inconnu"}).`);
    const v0 = verdictVideo(avant);
    if (v0.passe) return { octets: source, avant, apres: avant, compressee: false, verdict: v0 };
    if (!v0.reparable) {
      throw new Error(avant.codecVideo
        ? `Vidéo trop longue (${Math.round(avant.duree / 60)} min) pour tenir dans 16 Mo en restant regardable : raccourcissez-la.`
        : "Ce fichier ne contient pas d'image vidéo.");
    }

    // Trop lourde : débit calculé pour ~14 Mo. Juste mal encodée (HEVC, MOV,
    // 10 bits…) mais légère : on garde à peu près son débit actuel.
    let kbps = avant.taille > VIDEO_MAX_OCTETS ? debitVideo(avant.duree)! : debitSansContrainte(avant);
    const sortie = join(dossier, "sortie.mp4");
    for (let essai = 0; essai < 2; essai++) {
      await unParUn(() => lancer("ffmpeg", [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-protocol_whitelist", "file",
        "-threads", "2", "-i", entree, ...argumentsFfmpeg(kbps, avant.pistesAudio > 0), "-threads", "2", sortie,
      ], DUREE_FFMPEG));
      const apres = await analyser(sortie);
      const verdict = verdictVideo(apres);
      if (verdict.passe) {
        return { octets: await readFile(sortie), avant, apres, compressee: true, verdict };
      }
      // Débit variable un peu au-dessus de la cible : un second passage à 80 %.
      kbps = Math.floor(kbps * 0.8);
    }
    throw new Error("La vidéo reste trop lourde après compression : raccourcissez-la.");
  } finally {
    await rm(dossier, { recursive: true, force: true }).catch(() => {});
  }
}

/** Analyse seule (pour « passe / ne passe pas »), sans rien modifier. */
export async function analyserOctets(source: Buffer): Promise<{ info: InfoVideo; verdict: Verdict }> {
  if (!(await ffmpegDisponible())) throw new Error("L'analyse vidéo n'est pas installée sur ce serveur (ffmpeg absent).");
  const dossier = await mkdtemp(join(tmpdir(), "camille-video-"));
  try {
    const entree = join(dossier, "entree");
    await writeFile(entree, source);
    const info = await analyser(entree).catch(() => { throw new Error("Ce fichier n'est pas une vidéo lisible."); });
    if (!formatAdmis(info.format)) throw new Error(`Format vidéo non pris en charge (${info.format || "inconnu"}).`);
    return { info, verdict: verdictVideo(info) };
  } finally {
    await rm(dossier, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Télécharge une vidéo distante (https seulement, taille plafonnée). Les
 * adresses internes (localhost, IP nues, noms sans domaine) sont refusées :
 * le serveur ne doit pas servir à fouiller son propre réseau.
 */
export async function telechargerVideo(url: string): Promise<Buffer> {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error("Adresse invalide."); }
  const hote = u.hostname;
  if (u.protocol !== "https:" || !hote.includes(".") || /^[\d.]+$/.test(hote) || hote.includes(":") || /(^|\.)(localhost|internal|local)$/.test(hote)) {
    throw new Error("Seules les adresses https publiques sont acceptées.");
  }
  const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!r.ok || !r.body) throw new Error(`Vidéo injoignable (HTTP ${r.status}).`);
  const annonce = Number(r.headers.get("content-length")) || 0;
  if (annonce > VIDEO_SOURCE_MAX) throw new Error(`Vidéo trop volumineuse (${Math.round(annonce / 1048576)} Mo, max ${VIDEO_SOURCE_MAX / 1048576}).`);
  const morceaux: Buffer[] = [];
  let total = 0;
  const lecteur = r.body.getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > VIDEO_SOURCE_MAX) { await lecteur.cancel().catch(() => {}); throw new Error("Vidéo trop volumineuse."); }
    morceaux.push(Buffer.from(value));
  }
  return Buffer.concat(morceaux);
}

/** Dépose des octets sur camille-core ; l'adresse publique. */
export async function deposerSurCore(nom: string, octets: Buffer, mime = "video/mp4"): Promise<string> {
  const res = await fetch(`${coreUrl()}/api/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": process.env.CAMILLE_CORE_API_KEY ?? "" },
    body: JSON.stringify({ name: nom, data: octets.toString("base64"), mimeType: mime }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Camille Core : ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error("Camille Core n'a pas rendu d'adresse.");
  return url;
}

// ── Le filet de sécurité à l'envoi ──────────────────────────────────────────

const LEGERES = new Map<string, string | null>();
const EN_COURS = new Map<string, Promise<string | null>>();
const tailles = new Map<string, number | null>();

async function poids(url: string): Promise<number | null> {
  if (tailles.has(url)) return tailles.get(url)!;
  const n = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) })
    .then((r) => (r.ok ? Number(r.headers.get("content-length")) || null : null), () => null);
  tailles.set(url, n);
  setTimeout(() => tailles.delete(url), 3600_000).unref?.();
  return n;
}

/**
 * L'adresse à envoyer à WhatsApp pour cette vidéo : elle-même si elle tient
 * dans 16 Mo, sinon sa version légère (créée une seule fois). null si
 * l'allègement est impossible : l'appelant se replie sur le document.
 */
export async function versionWhatsApp(url: string): Promise<string | null> {
  if (LEGERES.has(url)) return LEGERES.get(url)!;
  const n = await poids(url);
  if (n !== null && n <= VIDEO_MAX_OCTETS) return url;

  const deja = EN_COURS.get(url);
  if (deja) return deja;
  const travail = (async () => {
    const nom = `wa_${createHash("sha1").update(url).digest("hex").slice(0, 20)}.mp4`;
    // Déjà allégée lors d'une vie précédente du serveur ?
    const existante = `${coreUrl()}/media/${nom}`;
    const p = await poids(existante);
    if (p && p <= VIDEO_MAX_OCTETS) return existante;
    try {
      const t0 = Date.now();
      const prep = await preparerVideo(await telechargerVideo(url));
      const legere = prep.compressee ? await deposerSurCore(nom, prep.octets) : url;
      console.log(`[video] ${url.split("/").pop()} : ${Math.round(prep.avant.taille / 1048576)} → ${Math.round(prep.apres.taille / 1048576)} Mo en ${Math.round((Date.now() - t0) / 1000)} s`);
      return legere;
    } catch (e) {
      console.error(`[video] allègement impossible pour ${url} :`, (e as Error).message);
      return null;
    }
  })();
  EN_COURS.set(url, travail);
  try {
    const r = await travail;
    LEGERES.set(url, r);
    // Un échec n'est pas définitif (core en panne, réseau…) : on réessaiera dans une heure.
    if (r === null) setTimeout(() => LEGERES.delete(url), 3600_000).unref?.();
    return r;
  } finally {
    EN_COURS.delete(url);
  }
}

/** Prépare en arrière-plan les vidéos d'un parcours qu'on vient de publier : le premier client n'attend pas. */
export function prechaufferVideos(urls: string[]): void {
  for (const u of new Set(urls)) {
    if (/^https:\/\//.test(u)) versionWhatsApp(u).catch(() => {});
  }
}
