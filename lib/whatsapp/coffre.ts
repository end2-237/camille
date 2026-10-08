// ─────────────────────────────────────────────────────────────────────────────
// Le coffre des jetons Meta.
//
// Avec l'Embedded Signup, chaque commerçant confie à Camille un jeton qui
// permet d'écrire EN SON NOM sur WhatsApp. Le garder en clair dans la base, ce
// serait offrir, à quiconque lit une sauvegarde, la parole de tous nos
// commerçants. Il est donc chiffré (AES-256-GCM : chiffré ET authentifié — une
// valeur altérée est refusée, pas déchiffrée en n'importe quoi).
//
// La clé vit dans l'environnement (META_TOKEN_KEY, 64 caractères hexadécimaux),
// jamais dans la base ni dans le dépôt. Sans elle, aucune connexion de
// commerçant n'est acceptée : on ne range pas un jeton qu'on ne sait pas
// protéger.
//
// Aucune dépendance hors de Node : éprouvé par les tests.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";

const VERSION = "v1";

function cle(hex: string | undefined): Buffer | null {
  const h = String(hex || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(h)) return null;
  return Buffer.from(h, "hex");
}

/** La clé de l'environnement est-elle utilisable ? */
export function coffrePret(hex: string | undefined = process.env.META_TOKEN_KEY): boolean {
  return cle(hex) !== null;
}

/** « v1:<base64(iv | tag | chiffré)> ». Lève si la clé est absente ou invalide. */
export function chiffrer(texte: string, hex: string | undefined = process.env.META_TOKEN_KEY): string {
  const k = cle(hex);
  if (!k) throw new Error("META_TOKEN_KEY absente ou invalide (64 caractères hexadécimaux)");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const corps = Buffer.concat([c.update(String(texte), "utf8"), c.final()]);
  return `${VERSION}:${Buffer.concat([iv, c.getAuthTag(), corps]).toString("base64")}`;
}

/** Le texte d'origine, ou null si la valeur est illisible, altérée, ou la clé fausse. */
export function dechiffrer(valeur: string | null | undefined, hex: string | undefined = process.env.META_TOKEN_KEY): string | null {
  const k = cle(hex);
  const [v, b64] = String(valeur || "").split(":");
  if (!k || v !== VERSION || !b64) return null;
  try {
    const brut = Buffer.from(b64, "base64");
    if (brut.length < 29) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", k, brut.subarray(0, 12));
    d.setAuthTag(brut.subarray(12, 28));
    return Buffer.concat([d.update(brut.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
