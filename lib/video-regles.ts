// ─────────────────────────────────────────────────────────────────────────────
// Ce que WhatsApp accepte comme vidéo, et comment y faire tenir une vidéo qui
// déborde. Pur, sans ffmpeg : le calcul se teste, l'exécution est dans
// lib/video.ts.
//
// L'origine : trois vidéos d'accueil No Limit de 16 à 20 Mo. Meta les
// refusait (« Video file has size 19630101 bytes but must be at most
// 16777216 ») et le client ne recevait RIEN. Recompressées à la main, elles
// tombaient à 10-11 Mo sans perte visible sur un téléphone. Camille le fait
// désormais elle-même.
//
// Les règles de Meta pour une vidéo envoyée comme telle :
//   - 16 Mo au plus ;
//   - MP4 (ou 3GPP), vidéo H.264, son AAC — une seule piste son, ou aucune ;
//   - en pratique, des pixels 8 bits (yuv420p) : une vidéo 10 bits d'iPhone
//     passe chez Meta mais reste noire sur bien des Android.
// ─────────────────────────────────────────────────────────────────────────────

export const VIDEO_MAX_OCTETS = 16 * 1024 * 1024;
/** Ce qu'on vise en compressant : sous le plafond, avec de la marge pour l'imprécision du débit. */
export const VIDEO_CIBLE_OCTETS = 14 * 1024 * 1024;
export const AUDIO_KBPS = 64;
/** En dessous, l'image n'est plus regardable : la vidéo est trop longue pour 16 Mo. */
export const VIDEO_KBPS_MIN = 150;
export const VIDEO_KBPS_MAX = 2500;

export type InfoVideo = {
  taille: number;
  duree: number;            // secondes
  format: string;           // « mov,mp4,m4a,3gp,3g2,mj2 », « matroska,webm »…
  codecVideo: string | null;
  codecAudio: string | null;
  pistesAudio: number;
  pixels: string | null;    // yuv420p, yuv420p10le…
  largeur: number;
  hauteur: number;
};

export type Verdict = {
  passe: boolean;
  /** Ce qui bloque, en clair, pour le commerçant. */
  raisons: string[];
  /** Ce que Camille peut corriger en recompressant (tout, sauf une vidéo illisible ou interminable). */
  reparable: boolean;
};

const mo = (o: number) => `${(o / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/** Conteneurs qu'on accepte de lire. Tout autre format (playlists, concat…) est refusé avant ffmpeg. */
export function formatAdmis(format: string): boolean {
  return format.split(",").some((f) => ["mov", "mp4", "m4a", "3gp", "3g2", "matroska", "webm", "avi"].includes(f.trim()));
}

/** La vidéo passera-t-elle telle quelle chez Meta ? */
export function verdictVideo(i: InfoVideo): Verdict {
  const raisons: string[] = [];
  const mp4 = /(^|,)(mp4|3gp)(,|$)/.test(i.format);
  if (!i.codecVideo) raisons.push("aucune image dans ce fichier");
  if (i.taille > VIDEO_MAX_OCTETS) raisons.push(`${mo(i.taille)} : WhatsApp refuse au-delà de 16 Mo`);
  if (!mp4) raisons.push("format non MP4");
  if (i.codecVideo && i.codecVideo !== "h264") raisons.push(`codec vidéo ${i.codecVideo.toUpperCase()} (WhatsApp veut du H.264)`);
  if (i.codecAudio && i.codecAudio !== "aac") raisons.push(`son ${i.codecAudio.toUpperCase()} (WhatsApp veut de l'AAC)`);
  if (i.pistesAudio > 1) raisons.push(`${i.pistesAudio} pistes son (une seule admise)`);
  if (i.pixels && i.pixels !== "yuv420p" && i.pixels !== "yuvj420p") raisons.push(`couleurs ${i.pixels} (risque d'écran noir sur Android)`);
  const reparable = !!i.codecVideo && i.duree > 0 && debitVideo(i.duree) !== null;
  return { passe: raisons.length === 0, raisons, reparable };
}

/**
 * Le débit vidéo (kbit/s) qui fait tenir `duree` secondes dans `cible`
 * octets, son compris. null si la vidéo est trop longue pour rester
 * regardable — l'appelant l'enverra alors comme document.
 */
export function debitVideo(duree: number, cible = VIDEO_CIBLE_OCTETS, audioKbps = AUDIO_KBPS): number | null {
  if (!(duree > 0)) return null;
  // 4 % pour l'enveloppe MP4 et les écarts du débit variable.
  const total = (cible * 8 * 0.96) / duree / 1000;
  const video = Math.floor(total - audioKbps);
  if (video < VIDEO_KBPS_MIN) return null;
  return Math.min(video, VIDEO_KBPS_MAX);
}

/** Le plus grand côté de l'image après compression : moins de débit, moins de pixels. */
export function coteMax(kbps: number): number {
  if (kbps >= 1200) return 1280;
  if (kbps >= 600) return 960;
  return 640;
}

/** La vidéo n'a besoin que d'être réemballée ou recodée, sans contrainte de poids. */
export function debitSansContrainte(i: InfoVideo): number {
  const actuel = i.duree > 0 ? (i.taille * 8) / i.duree / 1000 - AUDIO_KBPS : VIDEO_KBPS_MAX;
  const plafond = debitVideo(i.duree) ?? VIDEO_KBPS_MIN;
  return Math.max(VIDEO_KBPS_MIN, Math.min(Math.floor(actuel), plafond));
}

/** Les arguments ffmpeg (sans entrée ni sortie) pour un débit vidéo donné. */
export function argumentsFfmpeg(kbps: number, avecSon: boolean): string[] {
  const cote = coteMax(kbps);
  return [
    "-map", "0:v:0", ...(avecSon ? ["-map", "0:a:0"] : []),
    "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p",
    "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.15)}k`, "-bufsize", `${kbps * 2}k`,
    // Le plus grand côté ramené à `cote`, dimensions paires (exigence H.264).
    "-vf", `scale='if(gte(iw,ih),min(${cote},iw),-2)':'if(gte(iw,ih),-2,min(${cote},ih))'`,
    "-fpsmax", "30",
    ...(avecSon ? ["-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-ac", "2"] : ["-an"]),
    "-movflags", "+faststart",
    "-map_metadata", "-1",
  ];
}

/** Résumé lisible pour l'éditeur : « 11,2 Mo · 1 min 12 · H.264 / AAC · 720×1280 ». */
export function resumeVideo(i: InfoVideo): string {
  const d = Math.round(i.duree);
  const duree = d >= 60 ? `${Math.floor(d / 60)} min ${String(d % 60).padStart(2, "0")}` : `${d} s`;
  const codecs = [i.codecVideo?.toUpperCase().replace("H264", "H.264"), i.codecAudio?.toUpperCase()].filter(Boolean).join(" / ");
  return [mo(i.taille), duree, codecs, i.largeur && i.hauteur ? `${i.largeur}×${i.hauteur}` : ""].filter(Boolean).join(" · ");
}
