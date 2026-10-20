// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/plans — les forfaits, modifiables par l'administration.
//
//   GET    tous les forfaits, y compris ceux qu'on a retirés de la vente
//   PATCH  { id, ...champs } — prix, volume, textes, mise en avant, vente,
//          supplément Site du forfait
//   PATCH  { option_site_xaf } — le prix par défaut de l'option Site
//
// Les identifiants (free, starter, pro, enterprise) ne changent pas : le code
// s'y réfère (niveaux d'agent, essai). Tout le reste se règle ici, et vaut
// pour la page des tarifs, la facturation, les limites et les paiements.
// Un changement de prix vaut pour les prochains paiements, pas pour les mois
// déjà payés.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { getPrixOptionSiteDB, invalidatePlansCache } from "@/lib/plans-db";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const r = await query(`SELECT * FROM camille.plans ORDER BY sort_order ASC`);
  return NextResponse.json({
    option_site_xaf: await getPrixOptionSiteDB(),
    plans: r.rows.map((p) => ({
      ...p,
      monthly_tokens: Number(p.monthly_tokens),
      price_xaf: Number(p.price_xaf),
      price_eur: Number(p.price_eur),
      features: typeof p.features === "string" ? JSON.parse(p.features) : (p.features ?? []),
      site_addon_xaf: p.site_addon_xaf == null ? null : Number(p.site_addon_xaf),
    })),
  });
}

const texte = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const entier = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
};

export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Le prix par défaut de l'option Site.
  if (b.id === undefined && b.option_site_xaf !== undefined) {
    const v = entier(b.option_site_xaf);
    if (v === null || v < 0) return NextResponse.json({ error: "Prix de l'option Site invalide" }, { status: 400 });
    try {
      await query(
        `INSERT INTO camille.parametres (cle, valeur, updated_at) VALUES ('prix_option_site', $1, NOW())
         ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = NOW()`,
        [String(v)]
      );
    } catch {
      return NextResponse.json({ error: "Exécutez d'abord migration_option_site_prix.sql" }, { status: 500 });
    }
    invalidatePlansCache();
    revalidatePath("/api/plans");
    revalidatePath("/pricing");
    console.info("[admin/plans] option Site : %d FCFA par %s", v, admin.email ?? admin.id);
    return NextResponse.json({ ok: true });
  }

  const id = texte(b.id, 40);
  if (!id) return NextResponse.json({ error: "Forfait manquant" }, { status: 400 });

  // Seuls les champs envoyés changent ; chacun est vérifié.
  const champs: Record<string, unknown> = {};
  if (b.label !== undefined) {
    const v = texte(b.label, 40);
    if (!v) return NextResponse.json({ error: "Le nom ne peut pas être vide" }, { status: 400 });
    champs.label = v;
  }
  if (b.price_xaf !== undefined) {
    const v = entier(b.price_xaf);
    if (v === null || (v < 0 && v !== -1)) return NextResponse.json({ error: "Prix invalide (−1 = sur devis)" }, { status: 400 });
    champs.price_xaf = v;
  }
  if (b.price_eur !== undefined) {
    const v = entier(b.price_eur);
    if (v === null || v < 0) return NextResponse.json({ error: "Prix en euros invalide" }, { status: 400 });
    champs.price_eur = v;
  }
  if (b.monthly_tokens !== undefined) {
    const v = entier(b.monthly_tokens);
    if (v === null || (v <= 0 && v !== -1)) return NextResponse.json({ error: "Volume invalide (−1 = illimité)" }, { status: 400 });
    champs.monthly_tokens = v;
  }
  for (const [k, max] of [["description", 300], ["tokens_label", 80], ["conv_estimate", 80], ["cta_label", 60]] as const) {
    if (b[k] !== undefined) champs[k] = texte(b[k], max);
  }
  if (b.badge !== undefined) champs.badge = texte(b.badge, 30) || null;
  for (const k of ["highlight", "is_purchasable", "is_active"] as const) {
    if (b[k] !== undefined) champs[k] = Boolean(b[k]);
  }
  if (b.site_addon_xaf !== undefined) {
    // Vide : ce forfait paie le prix par défaut de l'option Site.
    if (b.site_addon_xaf === null || b.site_addon_xaf === "") champs.site_addon_xaf = null;
    else {
      const v = entier(b.site_addon_xaf);
      if (v === null || v < 0) return NextResponse.json({ error: "Supplément Site invalide" }, { status: 400 });
      champs.site_addon_xaf = v;
    }
  }
  if (b.sort_order !== undefined) {
    const v = entier(b.sort_order);
    if (v !== null) champs.sort_order = v;
  }
  if (b.features !== undefined) {
    const liste = (Array.isArray(b.features) ? b.features : [])
      .map((f: { label?: unknown; included?: unknown }) => ({ label: texte(f?.label, 120), included: f?.included !== false }))
      .filter((f) => f.label)
      .slice(0, 30);
    champs.features = JSON.stringify(liste);
  }
  // Le forfait gratuit ne se vend pas, et un forfait payant doit avoir un prix.
  if (id === "free" && champs.is_purchasable === true) {
    return NextResponse.json({ error: "Le forfait gratuit ne se vend pas" }, { status: 400 });
  }

  const cles = Object.keys(champs);
  if (!cles.length) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  const sets = cles.map((k, i) => `${k} = $${i + 2}${k === "features" ? "::jsonb" : ""}`).join(", ");
  const r = await query(`UPDATE camille.plans SET ${sets} WHERE id = $1 RETURNING id`, [id, ...cles.map((k) => champs[k])]);
  if (!r.rows.length) return NextResponse.json({ error: "Forfait introuvable" }, { status: 404 });

  invalidatePlansCache();
  revalidatePath("/api/plans");
  revalidatePath("/pricing");
  console.info("[admin/plans] %s modifié par %s : %s", id, admin.email ?? admin.id, cles.join(", "));
  return NextResponse.json({ ok: true });
}
