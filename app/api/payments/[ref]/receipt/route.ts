// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/:ref/receipt — le reçu imprimable d'un paiement réussi
// (HTML ; « Imprimer » ou « Enregistrer en PDF » depuis le navigateur).
// Réservé au compte qui a payé.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { getPlanLabel } from "@/lib/plans";
import { EMETTEUR, fcfa, numeroterRecu } from "@/lib/recu";

type Ctx = { params: Promise<{ ref: string }> };

const e = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { ref } = await params;

  const r = await query(
    `SELECT p.id, p.amount, p.currency, p.plan_id, p.transaction_id, p.phone, p.created_at, p.updated_at,
            u.email, u.full_name,
            a.business_name, COALESCE(NULLIF(a.name, ''), 'Agent') AS agent
       FROM camille.payments p
       JOIN camille.users u ON u.id = p.user_id
       LEFT JOIN camille.agents a ON a.id = p.agent_id
      WHERE p.id = $1 AND p.user_id = $2 AND p.status = 'success'`,
    [ref, user.id]
  );
  const p = r.rows[0];
  if (!p) return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });
  const numero = (await numeroterRecu(ref)) || ref;
  const date = new Date(p.updated_at || p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reçu ${e(numero)}</title>
<style>
  body{margin:0;background:#F5F1FF;font-family:Inter,Arial,sans-serif;color:#19171B}
  .page{max-width:640px;margin:32px auto;background:#fff;border-radius:16px;padding:40px}
  h1{font-size:26px;margin:0;letter-spacing:-0.02em} .muted{color:#6B6577} table{width:100%;border-collapse:collapse;margin-top:28px}
  td{padding:12px 0;border-bottom:1px solid #ECE9F1;font-size:14px} td:last-child{text-align:right}
  .total td{font-weight:700;font-size:16px;border-bottom:none} .tete{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
  .badge{display:inline-block;background:#E4F6EA;color:#1E6A37;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600}
  button{margin-top:28px;background:#6442E8;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer}
  @media print{body{background:#fff}.page{margin:0;border-radius:0}button{display:none}}
</style></head><body><div class="page">
<div class="tete">
  <div><div style="font-size:20px;font-weight:700">Camille</div><div class="muted" style="font-size:13px">${e(EMETTEUR.nom)}<br>${e(EMETTEUR.adresse)}<br>${e(EMETTEUR.contact)}</div></div>
  <div style="text-align:right"><h1>Reçu</h1><div class="muted" style="font-size:13px">N° ${e(numero)}<br>${e(date)}</div><div style="margin-top:8px"><span class="badge">Payé</span></div></div>
</div>
<p style="margin-top:28px;font-size:14px"><span class="muted">Client</span><br><b>${e(p.full_name || p.email)}</b><br>${e(p.email)}${p.business_name ? `<br>${e(p.business_name)}` : ""}</p>
<table>
  <tr><td>Abonnement Camille ${e(getPlanLabel(p.plan_id))} — 1 mois<br><span class="muted">${e(p.agent)}</span></td><td>${e(fcfa(p.amount))}</td></tr>
  <tr class="total"><td>Total payé</td><td>${e(fcfa(p.amount))}</td></tr>
</table>
<p class="muted" style="font-size:12.5px;margin-top:20px">Paiement Mobile Money via Monetbil${p.transaction_id ? ` · transaction ${e(p.transaction_id)}` : ""} · référence ${e(p.id)}</p>
<button onclick="window.print()">Imprimer / enregistrer en PDF</button>
</div></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
