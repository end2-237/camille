// ─────────────────────────────────────────────────────────────────────────────
// Les demandes de site (option « Site »), côté exploitation.
//
//   GET    toutes les demandes ouvertes, avec leur brief
//   PATCH  { id, statut?, url? } — en fabrication, en ligne (avec l'adresse)
//
// Le commerçant est prévenu quand son site passe en ligne.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { notifyUser } from "@/lib/fcm";

const STATUTS = ["demande", "en_cours", "en_ligne", "annule"];

export async function GET(req: NextRequest) {
  if (!(await getAdminFromRequest(req))) return NextResponse.json({ error: "Accès réservé" }, { status: 403 });
  try {
    const r = await query(
      `SELECT d.*, a.business_name, a.name AS agent_name
         FROM camille.site_demandes d JOIN camille.agents a ON a.id = d.agent_id
        WHERE d.statut <> 'annule' ORDER BY d.created_at DESC LIMIT 200`
    );
    return NextResponse.json({ demandes: r.rows });
  } catch (e) {
    return NextResponse.json({ demandes: [], error: (e as Error).message });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminFromRequest(req))) return NextResponse.json({ error: "Accès réservé" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; statut?: string; url?: string };
  if (!b.id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (b.statut && !STATUTS.includes(b.statut)) return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });
  const url = b.url && /^https:\/\//.test(b.url) ? b.url : null;
  const r = await query(
    `UPDATE camille.site_demandes SET statut = COALESCE($2, statut), url = COALESCE($3, url), updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [b.id, b.statut || null, url]
  );
  const d = r.rows[0];
  if (!d) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  if (b.statut === "en_ligne" && d.user_id) {
    notifyUser(String(d.user_id), "systeme", {
      title: "🎉 Votre site est en ligne",
      body: d.url ? `Il est visible ici : ${d.url}` : "Ouvrez « Mon site » pour le voir.",
      data: { type: "site", agentId: String(d.agent_id) },
      channel: "alertes",
    }).catch(() => {});
  }
  return NextResponse.json({ demande: d });
}
