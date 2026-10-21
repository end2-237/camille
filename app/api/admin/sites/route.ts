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
import { slugDe, slugValide } from "@/lib/vitrine-regles";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://camille.vps.buyticle.com").replace(/\/+$/, "");

/**
 * Ouvre la vitrine Camille de l'agent : une adresse libre tirée de son nom
 * (« yoos-food », puis « yoos-food-2 »…), et le lien public qui va avec.
 */
async function ouvrirVitrine(agentId: string, voulu?: string): Promise<string | null> {
  try {
    const a = (await query(`SELECT business_name, name, site_slug FROM camille.agents WHERE id = $1`, [agentId])).rows[0];
    if (!a) return null;
    let slug: string = a.site_slug || (voulu && slugValide(voulu) ? voulu : slugDe(a.business_name || a.name || "boutique"));
    if (!a.site_slug) {
      for (let i = 2; i < 50; i++) {
        const pris = (await query(`SELECT 1 FROM camille.agents WHERE site_slug = $1 AND id <> $2`, [slug, agentId])).rows.length;
        if (!pris) break;
        slug = `${slugDe(a.business_name || a.name || "boutique").slice(0, 36)}-${i}`;
      }
      await query(`UPDATE camille.agents SET site_slug = $1, updated_at = NOW() WHERE id = $2`, [slug, agentId]);
    }
    const domaine = process.env.VITRINE_DOMAINE?.trim();
    return domaine ? `https://${slug}.${domaine}` : `${APP_URL}/s/${slug}`;
  } catch (e) {
    console.error("[sites] vitrine non ouverte :", (e as Error).message);
    return null; // migration_vitrine.sql pas encore passée
  }
}

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
  let url = b.url && /^https:\/\//.test(b.url) ? b.url : null;
  // « En ligne » sans adresse de site sur mesure : la vitrine Camille.
  if (b.statut === "en_ligne" && !url) {
    const d = (await query(`SELECT agent_id, domaine FROM camille.site_demandes WHERE id = $1`, [b.id])).rows[0];
    if (d) url = await ouvrirVitrine(String(d.agent_id), String(d.domaine || "").split(".")[0]);
    if (!url) return NextResponse.json({ error: "Vitrine non ouverte : passez migration_vitrine.sql" }, { status: 409 });
  }
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
