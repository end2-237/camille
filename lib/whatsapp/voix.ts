// ─────────────────────────────────────────────────────────────────────────────
// Les messages vocaux.
//
// Beaucoup de clients ne tapent pas : ils parlent. Un vocal resté sans réponse,
// c'est un client perdu. On le transcrit donc en texte, et ce texte suit
// exactement le chemin d'un message écrit — catalogue, couleurs, panier,
// adresse de livraison : rien n'est dupliqué pour la voix.
//
// La transcription passe par le même fournisseur que la compréhension
// (IA_BASE_URL / IA_KEY, Groq par défaut, modèle Whisper). Aucune langue n'est
// imposée : Whisper reconnaît seul le français et l'anglais.
//
// Sans clé, ou si la transcription échoue, on ne devine RIEN : le client est
// invité à écrire. Un vocal mal compris qui déclenche une commande serait pire
// qu'une question.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (process.env.IA_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const CLE = process.env.IA_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
const MODELE = process.env.IA_STT_MODEL || "whisper-large-v3-turbo";

/** Au-delà, ce n'est plus une question de client : 8 Mo d'opus, c'est plus d'une heure. */
export const VOCAL_MAX_OCTETS = 8 * 1024 * 1024;

export function transcriptionDisponible(): boolean {
  return Boolean(CLE);
}

/** L'extension que le fournisseur attend : il juge le format au nom du fichier. */
export function extensionAudio(mime: string): string {
  const m = String(mime || "").toLowerCase().split(";")[0].trim();
  const table: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "m4a",
    "audio/amr": "amr",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
  };
  return table[m] || "ogg";
}

/**
 * Ce que Whisper « entend » dans un vocal vide ou un simple bruit. Il a appris
 * sur des vidéos sous-titrées, et comble le silence avec leurs génériques. Ces
 * phrases-là, seules, ne sont pas un message du client.
 */
const HALLUCINATIONS = [
  /^sous[- ]titr/,
  /amara\.org/,
  /^merci d'avoir regard/,
  /^thanks? (you )?for watching/,
  /^thank you\.?$/,
  /^merci\.?$/,
  /^\.+$/,
  /^(musique|music)$/,
];

/**
 * Le texte transcrit, prêt à être traité comme un message écrit — ou `null`
 * s'il n'y a rien d'exploitable.
 */
export function nettoyerTranscription(brut: string | null | undefined): string | null {
  const t = String(brut || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const bas = t.toLowerCase().replace(/[\[\]()*♪]/g, "").trim();
  if (!/[a-z0-9à-ÿ]/i.test(bas)) return null;
  if (HALLUCINATIONS.some((r) => r.test(bas))) return null;
  // Un vocal de client tient en quelques phrases ; on borne comme un texte.
  return t.slice(0, 1000);
}

/**
 * Transcrit un vocal. `indice` oriente le vocabulaire (nom du commerce, noms
 * d'articles) : Whisper écrit alors « Oraimo » plutôt que « oraimo » ou « Oray
 * mo ». Renvoie `null` au moindre échec — jamais d'exception.
 */
export async function transcrire(
  audio: ArrayBuffer,
  mime: string,
  indice = ""
): Promise<string | null> {
  if (!CLE || !audio.byteLength || audio.byteLength > VOCAL_MAX_OCTETS) return null;

  const form = new FormData();
  form.append("model", MODELE);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (indice) form.append("prompt", indice.slice(0, 400));
  form.append("file", new Blob([audio], { type: mime || "audio/ogg" }), `vocal.${extensionAudio(mime)}`);

  const ctl = new AbortController();
  // Plus large que pour comprendre() : le fichier doit d'abord monter. Mais le
  // client attend toujours, donc pas indéfiniment.
  const minuteur = setTimeout(() => ctl.abort(), 20_000);
  try {
    const r = await fetch(`${BASE}/audio/transcriptions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${CLE}` },
      body: form,
    });
    if (!r.ok) {
      console.error("[voix] transcription refusée :", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const d = (await r.json().catch(() => ({}))) as { text?: string };
    return nettoyerTranscription(d.text);
  } catch (e) {
    console.error("[voix] transcription abandonnée :", (e as Error).message);
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}
