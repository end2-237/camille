// ─────────────────────────────────────────────────────────────────────────────
// Le message d'invitation dans une équipe.
// ─────────────────────────────────────────────────────────────────────────────

import { envoyerEmail } from "@/lib/email";
import { LIBELLE_ROLE, type Role } from "@/lib/equipe";

function echapper(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function envoyerInvitation(o: { email: string; lien: string; invitant: string; commerce: string; role: Role }) {
  const role = LIBELLE_ROLE[o.role].toLowerCase();
  const qui = o.commerce ? `${o.invitant} (${o.commerce})` : o.invitant;
  return envoyerEmail({
    to: o.email,
    subject: `${o.invitant} vous invite sur Camille`,
    text:
      `Bonjour,\n\n${qui} vous invite à rejoindre son équipe sur Camille en tant que ${role}.\n\n` +
      `Acceptez l'invitation ici (valable 7 jours) :\n${o.lien}\n\n` +
      `Pas encore de compte ? Créez-le avec cette adresse (${o.email}), puis ouvrez le lien.\n\n— Camille`,
    html: `<!doctype html><html><body style="margin:0;background:#F5F1FF;font-family:Inter,Arial,sans-serif;color:#19171B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em">Camille</div>
<p style="font-size:15px;line-height:1.55;margin:20px 0 24px"><b>${echapper(qui)}</b> vous invite à rejoindre son équipe en tant que <b>${echapper(role)}</b>.</p>
<a href="${echapper(o.lien)}" style="display:inline-block;background:#6442E8;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px">Rejoindre l'équipe</a>
<p style="font-size:13px;line-height:1.5;color:#6B6577;margin:24px 0 0">Valable 7 jours. Pas encore de compte ? Créez-le avec l'adresse ${echapper(o.email)}, puis rouvrez ce lien.</p>
</td></tr></table></td></tr></table></body></html>`,
  });
}
