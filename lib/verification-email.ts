// ─────────────────────────────────────────────────────────────────────────────
// Vérifier une adresse e-mail par un code à 6 chiffres.
//
// Le code vit 15 minutes, s'essaie 5 fois au plus, et n'est stocké que haché.
// Un nouvel envoi n'est possible qu'une fois par minute (6 par heure) : assez
// pour un e-mail qui tarde, pas assez pour inonder une boîte.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, randomInt } from "crypto";
import { query } from "@/lib/db";
import { envoyerEmail } from "@/lib/email";

const DUREE_MIN = 15;
const ESSAIS_MAX = 5;

const empreinte = (userId: string, code: string) =>
  createHash("sha256").update(`${userId}:${code}`).digest("hex");

export type ResultatEnvoi = { ok: true } | { ok: false; erreur: string; attente?: number };

/** Envoie un nouveau code à `email` pour ce compte. */
export async function envoyerCode(userId: string, email: string, nom?: string | null): Promise<ResultatEnvoi> {
  const recents = await query(
    `SELECT COUNT(*)::int AS heure,
            EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS depuis
       FROM camille.email_verifications
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  );
  const { heure, depuis } = recents.rows[0] as { heure: number; depuis: number | null };
  if (depuis != null && depuis < 60) {
    return { ok: false, erreur: "Un code vient de partir. Patientez une minute avant d'en demander un autre.", attente: 60 - depuis };
  }
  if (heure >= 6) {
    return { ok: false, erreur: "Trop de codes demandés. Réessayez dans une heure.", attente: 3600 };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await query(
    `INSERT INTO camille.email_verifications (user_id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)`,
    [userId, email, empreinte(userId, code), String(DUREE_MIN)]
  );

  const bonjour = nom ? `Bonjour ${nom},` : "Bonjour,";
  const envoye = await envoyerEmail({
    to: email,
    subject: `${code} — votre code Camille`,
    text:
      `${bonjour}\n\nVoici votre code de vérification : ${code}\n\n` +
      `Il est valable ${DUREE_MIN} minutes. Si vous n'avez pas créé de compte Camille, ignorez ce message.\n\n— Camille`,
    html: `<!doctype html><html><body style="margin:0;background:#F5F1FF;font-family:Inter,Arial,sans-serif;color:#19171B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em">Camille</div>
<p style="font-size:15px;line-height:1.55;margin:20px 0 16px">Voici votre code de vérification :</p>
<div style="font-size:34px;font-weight:700;letter-spacing:0.28em;color:#6442E8;background:#F5F1FF;border-radius:12px;padding:16px 0;text-align:center">${code}</div>
<p style="font-size:13px;line-height:1.5;color:#6B6577;margin:20px 0 0">Valable ${DUREE_MIN} minutes. Si vous n'avez pas créé de compte Camille, ignorez ce message.</p>
</td></tr></table></td></tr></table></body></html>`,
  });
  if (!envoye) console.warn(`[verification] code pour ${email} : ${code} (SMTP indisponible)`);
  return { ok: true };
}

export type ResultatCode = { ok: true } | { ok: false; erreur: string };

/** Vérifie le code ; en cas de succès, marque l'adresse comme vérifiée. */
export async function verifierCode(userId: string, code: string): Promise<ResultatCode> {
  const propre = String(code || "").replace(/\D/g, "");
  if (propre.length !== 6) return { ok: false, erreur: "Le code fait 6 chiffres." };

  const r = await query(
    `SELECT id, email, code_hash, attempts, expires_at > NOW() AS vivant
       FROM camille.email_verifications
      WHERE user_id = $1 AND used_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const v = r.rows[0];
  if (!v || !v.vivant) return { ok: false, erreur: "Ce code a expiré. Demandez-en un nouveau." };
  if (v.attempts >= ESSAIS_MAX) return { ok: false, erreur: "Trop d'essais avec ce code. Demandez-en un nouveau." };

  if (v.code_hash !== empreinte(userId, propre)) {
    await query(`UPDATE camille.email_verifications SET attempts = attempts + 1 WHERE id = $1`, [v.id]);
    const reste = ESSAIS_MAX - v.attempts - 1;
    return { ok: false, erreur: reste > 0 ? `Code incorrect. ${reste} essai${reste > 1 ? "s" : ""} restant${reste > 1 ? "s" : ""}.` : "Code incorrect. Demandez-en un nouveau." };
  }

  // Le code vaut pour l'adresse à laquelle il a été envoyé : si elle a changé
  // entre-temps, il ne prouve rien pour la nouvelle.
  const maj = await query(
    `UPDATE camille.users SET email_verified_at = NOW() WHERE id = $1 AND email = $2 RETURNING id`,
    [userId, v.email]
  );
  await query(`UPDATE camille.email_verifications SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`, [userId]);
  if (!maj.rows.length) return { ok: false, erreur: "L'adresse du compte a changé : demandez un nouveau code." };
  return { ok: true };
}
