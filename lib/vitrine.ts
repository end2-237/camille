// ─────────────────────────────────────────────────────────────────────────────
// La vitrine en ligne d'un commerçant (option Site), servie par Camille.
//
// Pas de second hébergement, pas de second catalogue : la vitrine lit les
// produits, les horaires et le barème de livraison de l'agent en direct, et
// sa commande arrive au même tableau de bord que celles de WhatsApp — avec
// le même accusé de réception au client sur WhatsApp.
//
// DIP reste l'outil de l'équipe pour un client qui veut un site sur mesure ;
// la vitrine, elle, est prête dès que la demande passe « en ligne ».
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { createOrder, type NewOrderItem } from "@/lib/orders";
import { lireSemaine, ouvertA, prochaineOuverture, resumeSemaine } from "@/lib/horaires";
import { normaliserOptions, type GroupeOptions } from "@/lib/whatsapp/restaurant";
import { servieAujourdhui, zonesDe } from "@/lib/whatsapp/livraison";
import { envoyerTexte } from "@/lib/whatsapp/envoi";
import { numeroClient, prixAvecOptions } from "@/lib/vitrine-regles";

export type ProduitVitrine = {
  id: string; nom: string; description: string; prix: number | null; prixMax: number | null; devise: string;
  categorie: string | null; image: string | null; images: string[]; epuise: boolean;
  options: GroupeOptions[]; duJour: boolean;
};

export type Vitrine = {
  agentId: string; slug: string; nom: string; accroche: string; description: string;
  logo: string | null; couleur: string; whatsapp: string | null; adresse: string | null;
  horaires: string | null; ouvert: boolean | null; reouverture: string | null;
  livraison: { active: boolean; frais: number; zones: { zone: string; fee: number }[]; delai: string | null };
  minimum: number; resto: boolean; produits: ProduitVitrine[]; categories: string[];
};

const lire = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};

/**
 * La vitrine d'une adresse, ou null si elle n'existe pas ou n'est plus
 * ouverte : agent inactif, ou option Site échue depuis plus de 3 jours (un
 * renouvellement en retard ne coupe pas le site du jour au lendemain).
 */
export async function vitrineParSlug(slug: string): Promise<Vitrine | null> {
  let a: Record<string, unknown> | undefined;
  try {
    a = (await query(
      `SELECT to_jsonb(a) AS a FROM camille.agents a
        WHERE site_slug = $1 AND status = 'active'
          AND (site_expires_at IS NULL OR site_expires_at > NOW() - INTERVAL '3 days')`,
      [slug]
    )).rows[0]?.a;
  } catch {
    return null; // migration_vitrine.sql pas encore passée
  }
  if (!a) return null;

  const media = (lire(a.media) as { kind?: string; url?: string }[] | null) || [];
  const doc = (lire(a.doc_settings) as { logo_url?: string; color?: string; accent?: string } | null) || {};
  const logo = media.find((m) => m?.kind === "logo")?.url || doc.logo_url || null;
  const couleur = /^#[0-9a-f]{6}$/i.test(String(doc.color || doc.accent || "")) ? String(doc.color || doc.accent) : "#19171B";
  const offset = Number(a.utc_offset ?? 1) || 1;
  const semaine = lireSemaine(a.business_hours as string | null);
  const maintenant = new Date();
  const ouvert = semaine ? ouvertA(semaine, maintenant, offset) : null;

  const rows = (await query(
    `SELECT to_jsonb(p) AS p FROM camille.products p
      WHERE agent_id = $1 AND COALESCE(active, true)
      ORDER BY COALESCE(sort_order, 0), created_at DESC LIMIT 300`,
    [a.id]
  )).rows.map((r: { p: Record<string, unknown> }) => r.p);

  const produits: ProduitVitrine[] = rows
    .filter((p) => servieAujourdhui(lire(p.available_days), maintenant))
    .map((p) => {
      const images = ((lire(p.images) as string[] | null) || []).filter((x) => typeof x === "string" && x);
      return {
        id: String(p.id), nom: String(p.name || ""), description: String(p.description || ""),
        prix: p.price != null ? Number(p.price) : null, prixMax: p.price_max != null ? Number(p.price_max) : null,
        devise: String(p.currency || "XAF"), categorie: (p.category as string) || null,
        image: (p.image_url as string) || images[0] || null, images,
        epuise: p.stock != null && Number(p.stock) <= 0,
        options: normaliserOptions(lire(p.options)), duJour: Boolean(p.daily_menu),
      };
    });

  const secteur = String(a.sector || "");
  return {
    agentId: String(a.id), slug, nom: String(a.business_name || a.name || "Notre boutique"),
    accroche: String(a.agent_tagline || ""), description: String(a.description || ""),
    logo, couleur,
    whatsapp: String(a.meta_display_phone || a.whatsapp_number || "").replace(/\D/g, "") || null,
    adresse: (a.location as string) || null,
    horaires: semaine ? resumeSemaine(semaine) : ((a.business_hours as string) || null),
    ouvert,
    reouverture: ouvert === false && semaine ? prochaineOuverture(semaine, maintenant, offset)?.texte || null : null,
    livraison: {
      active: a.delivery_enabled !== false, frais: Number(a.delivery_fee ?? 0) || 0,
      zones: zonesDe(a as { delivery_zones?: unknown }), delai: (a.delivery_delay as string) || null,
    },
    minimum: Number(a.min_order ?? 0) || 0,
    resto: ["food_beverage", "restaurant"].includes(secteur),
    produits,
    categories: [...new Set(produits.map((p) => p.categorie).filter((c): c is string => Boolean(c)))],
  };
}

export type CommandeVitrine = {
  lignes: { id: string; qty: number; choix?: number[] }[];
  nom: string; telephone: string; mode: "livraison" | "retrait";
  zone?: string; adresse?: string; note?: string; paiement?: string;
};

/**
 * Une commande passée sur la vitrine. Tout ce qui fait le montant — prix,
 * suppléments, frais de livraison — est relu en base : rien de ce que le
 * navigateur envoie n'est cru.
 */
export async function commanderSurVitrine(slug: string, c: CommandeVitrine): Promise<
  { ok: true; ref: string; total: number; devise: string; whatsapp: boolean } | { ok: false; error: string; status: number }
> {
  const v = await vitrineParSlug(slug);
  if (!v) return { ok: false, error: "Cette boutique n'est pas disponible.", status: 404 };
  const phone = numeroClient(c.telephone);
  if (!phone) return { ok: false, error: "Entrez un numéro camerounais valide (6XXXXXXXX).", status: 400 };
  const lignes = (Array.isArray(c.lignes) ? c.lignes : []).slice(0, 50);
  if (!lignes.length) return { ok: false, error: "Votre panier est vide.", status: 400 };

  const parId = new Map(v.produits.map((p) => [p.id, p]));
  const items: NewOrderItem[] = [];
  for (const l of lignes) {
    const p = parId.get(String(l.id));
    if (!p) return { ok: false, error: "Un article n'est plus disponible. Rechargez la page.", status: 409 };
    if (p.epuise) return { ok: false, error: `${p.nom} est épuisé.`, status: 409 };
    if (p.prix == null) return { ok: false, error: `${p.nom} n'a pas de prix : demandez-le sur WhatsApp.`, status: 409 };
    const o = prixAvecOptions(p.prix, p.options, l.choix);
    if (!o.ok) return { ok: false, error: `${p.nom} : choisissez « ${o.groupe} ».`, status: 400 };
    items.push({ productId: p.id, name: p.nom, variant: o.libelle, qty: Math.max(1, Math.min(99, Number(l.qty) || 1)), price: o.prix, currency: p.devise, image: p.image || "" });
  }
  // Le stock suivi : on ne vend pas plus que ce qui reste.
  const stocks = (await query(`SELECT id, name, stock FROM camille.products WHERE id = ANY($1::uuid[])`, [items.map((i) => i.productId)])).rows as { id: string; name: string; stock: number | null }[];
  for (const s of stocks) {
    const voulu = items.filter((i) => i.productId === s.id).reduce((n, i) => n + (i.qty || 1), 0);
    if (s.stock != null && Number(s.stock) < voulu) return { ok: false, error: `Il ne reste que ${s.stock} × ${s.name}.`, status: 409 };
  }

  const sousTotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  if (v.minimum && sousTotal < v.minimum) {
    return { ok: false, error: `Commande minimum : ${v.minimum.toLocaleString("fr-FR")} ${items[0].currency}.`, status: 400 };
  }

  let frais = 0;
  let adresse = "";
  if (c.mode === "livraison") {
    if (!v.livraison.active) return { ok: false, error: "Cette boutique ne livre pas : choisissez le retrait.", status: 400 };
    const z = v.livraison.zones.find((x) => x.zone === c.zone);
    if (v.livraison.zones.length && !z && c.zone !== "autre") return { ok: false, error: "Choisissez votre quartier.", status: 400 };
    frais = z ? z.fee : v.livraison.frais;
    adresse = [z?.zone, String(c.adresse || "").trim()].filter(Boolean).join(" — ").slice(0, 200);
    if (!adresse) return { ok: false, error: "Indiquez votre adresse de livraison.", status: 400 };
  }

  const created = await createOrder({
    agentId: v.agentId, items, phone, customerName: String(c.nom || "").slice(0, 80),
    address: adresse, note: String(c.note || "").slice(0, 300), deliveryFee: frais,
    source: "site", fulfillment: c.mode, paymentMethod: c.paiement ? String(c.paiement).slice(0, 40) : null,
  });
  if (!created.ok) return { ok: false, error: "La commande n'a pas pu être enregistrée. Réessayez.", status: 500 };

  // Le même accusé de réception que pour une commande née sur WhatsApp.
  const r = await envoyerTexte(v.agentId, phone, created.clientText).catch(() => ({ ok: false }));
  if (created.ownerChatId) await envoyerTexte(v.agentId, created.ownerChatId, created.ownerText).catch(() => {});
  return { ok: true, ref: created.ref, total: created.total, devise: created.currency, whatsapp: Boolean(r.ok) };
}
