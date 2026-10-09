// ─────────────────────────────────────────────────────────────────────────────
// Les reçus de paiement.
//
// Un paiement réussi reçoit un numéro suivi (CAM-2026-000042) et le
// propriétaire reçoit son reçu par e-mail, avec le lien de la version
// imprimable (/api/payments/<ref>/receipt). Ne lève jamais : un reçu raté ne
// doit pas faire échouer la prise en compte d'un paiement.
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "@/lib/db";
import { envoyerEmail } from "@/lib/email";
import { getPlanLabel } from "@/lib/plans";

export const EMETTEUR = {
  nom: process.env.RECU_EMETTEUR || "Buyticle — Camille",
  adresse: process.env.RECU_ADRESSE || "Douala, Cameroun",
  contact: process.env.RECU_CONTACT || "hello@buyticle.com",
};

export const fcfa = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;

/** Pose le numéro de reçu s'il manque, et le renvoie. */
export async function numeroterRecu(paymentRef: string): Promise<string | null> {
  try {
    const r = await query(
      `UPDATE camille.payments
          SET receipt_number = 'CAM-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('camille.receipt_seq')::text, 6, '0')
        WHERE id = $1 AND receipt_number IS NULL
        RETURNING receipt_number`,
      [paymentRef]
    );
    if (r.rows[0]) return r.rows[0].receipt_number;
    const deja = await query(`SELECT receipt_number FROM camille.payments WHERE id = $1`, [paymentRef]);
    return deja.rows[0]?.receipt_number ?? null;
  } catch {
    return null; // migration_essai_recus.sql absente
  }
}

/** Envoie le reçu au propriétaire. */
export async function envoyerRecu(paymentRef: string): Promise<void> {
  try {
    const numero = await numeroterRecu(paymentRef);
    const r = await query(
      `SELECT p.amount, p.plan_id, p.transaction_id, u.email, u.full_name,
              COALESCE(NULLIF(a.name, ''), a.business_name, 'Votre agent') AS agent,
              a.plan_expires_at
         FROM camille.payments p
         JOIN camille.users u ON u.id = p.user_id
         LEFT JOIN camille.agents a ON a.id = p.agent_id
        WHERE p.id = $1`,
      [paymentRef]
    );
    const p = r.rows[0];
    if (!p) return;
    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const lien = base ? `${base}/dashboard/billing?recu=${encodeURIComponent(paymentRef)}` : "";
    const jusqua = p.plan_expires_at
      ? new Date(p.plan_expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : null;
    await envoyerEmail({
      to: p.email,
      subject: `Reçu ${numero || paymentRef} — Camille ${getPlanLabel(p.plan_id)}`,
      text:
        `Bonjour ${p.full_name || ""},\n\nMerci pour votre paiement.\n\n` +
        `Reçu : ${numero || paymentRef}\nForfait : ${getPlanLabel(p.plan_id)} — ${p.agent}\n` +
        `Montant : ${fcfa(p.amount)}\n${String(p.transaction_id || "").startsWith("agence:") ? "Paiement reçu en agence\n" : p.transaction_id ? `Transaction : ${p.transaction_id}\n` : ""}` +
        `${jusqua ? `Actif jusqu'au ${jusqua}.\n` : ""}` +
        `${lien ? `\nVotre reçu imprimable : ${lien}\n` : ""}\n— ${EMETTEUR.nom}`,
    });
  } catch (e) {
    console.error("[recu]", e instanceof Error ? e.message : e);
  }
}
