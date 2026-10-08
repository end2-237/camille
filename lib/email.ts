// ─────────────────────────────────────────────────────────────────────────────
// Envoi d'e-mails par SMTP (boîte Hostinger, Gmail, Brevo… peu importe).
//
//   SMTP_HOST, SMTP_PORT (465 = TLS direct, sinon STARTTLS), SMTP_USER,
//   SMTP_PASS, MAIL_FROM (par défaut SMTP_USER).
//
// Sans configuration, rien ne part : on écrit le message dans les journaux du
// serveur et on renvoie false — utile en local, et l'appelant décide.
// ─────────────────────────────────────────────────────────────────────────────

import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; text: string; html?: string };

let transport: nodemailer.Transporter | null = null;

function transporteur(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  }
  return transport;
}

export function emailConfigure(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function envoyerEmail({ to, subject, text, html }: Mail): Promise<boolean> {
  const t = transporteur();
  if (!t) {
    console.warn(`[email] SMTP non configuré — message pour ${to} non envoyé :\n${subject}\n${text}`);
    return false;
  }
  const from = process.env.MAIL_FROM || `Camille <${process.env.SMTP_USER}>`;
  try {
    await t.sendMail({ from, to, subject, text, html });
    return true;
  } catch (e) {
    console.error("[email] échec d'envoi :", e instanceof Error ? e.message : e);
    return false;
  }
}
