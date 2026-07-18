// lib/ofs.ts — connecteur marketplace OFS (OneFreeStyle), basé sur son Supabase.
// Sign-in avec un compte OFS → catalogue de SA boutique (vendors.user_id = uid),
// ou TOUT le catalogue si le compte est super-admin (profiles.is_super_admin).
// Ne modifie rien chez OFS : lecture seule.
//
// env : OFS_SUPABASE_URL (défaut fourni), OFS_SUPABASE_ANON_KEY (à définir).

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const OFS_URL = process.env.OFS_SUPABASE_URL || "https://alrbokstfwwlvbvghrqr.supabase.co";
const OFS_ANON = process.env.OFS_SUPABASE_ANON_KEY || "";

export function ofsEnabled(): boolean {
  return !!OFS_ANON;
}

/** true si le mode LIVE OFS est activé pour ce déploiement (env OFS_LIVE=1 + clé anon). */
export function ofsLiveEnabled(): boolean {
  return process.env.OFS_LIVE === "1" && !!OFS_ANON;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OfsProduct = {
  id: string; name: string; description: string | null; price: number | null; price_max: number | null;
  currency: string; category: string | null; tags: string[]; stock: number | null;
  image_url: string | null; images: string[]; product_url: string | null;
  variants: { name: string; options: { value: string; image?: string | null }[] }[];
};

function toArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.name || x?.value || "")).filter(Boolean);
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? toArr(p) : []; } catch { return v.split(",").map((s) => s.trim()).filter(Boolean); } }
  return [];
}
function stripHtml(s: any): string | null {
  if (!s) return null;
  return String(s).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim().slice(0, 400) || null;
}
function mapVariants(p: any): OfsProduct["variants"] {
  const out: OfsProduct["variants"] = [];
  const colors = toArr(p.colors);
  const sizes = toArr(p.sizes);
  if (colors.length) out.push({ name: "Couleur", options: colors.map((c) => ({ value: c })) });
  if (sizes.length) out.push({ name: "Taille", options: sizes.map((s) => ({ value: s })) });
  return out;
}

function mapProduct(p: any): OfsProduct {
  const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  const onSale = p.is_on_sale && p.now != null;
  return {
    id: String(p.id),
    name: p.name || "Produit",
    description: stripHtml(p.description),
    price: onSale ? Number(p.now) : (p.price != null ? Number(p.price) : null),
    price_max: onSale && p.price != null ? Number(p.price) : null,
    currency: "XAF",
    category: p.type || p.subcategory || null,
    tags: ["ofs", "ofs:" + p.id].concat(p.subcategory ? [String(p.subcategory)] : []).concat(p.brand ? [String(p.brand)] : []),
    stock: p.stock_qty != null ? Number(p.stock_qty) : null,
    image_url: p.img || imgs[0] || null,
    images: imgs,
    product_url: `https://www.onefreestyle.store/product/${p.id}`,
    variants: mapVariants(p),
  };
}

async function client(email: string, password: string): Promise<{ sb: SupabaseClient; userId: string }> {
  const sb = createClient(OFS_URL, OFS_ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw new Error("Connexion OFS échouée : " + (error?.message || "identifiants invalides"));
  return { sb, userId: data.user.id };
}

/** Connexion légère : renvoie le compte, son statut super-admin et sa boutique (sans produits). */
export async function connectOfs(email: string, password: string): Promise<{ userId: string; isSuperAdmin: boolean; vendor: any | null }> {
  if (!OFS_ANON) throw new Error("OFS_SUPABASE_ANON_KEY manquante côté serveur.");
  const { sb, userId } = await client(email, password);
  const prof = await sb.from("profiles").select("is_super_admin").eq("id", userId).maybeSingle();
  const vend = await sb.from("vendors").select("id, shop_name").eq("user_id", userId).maybeSingle();
  return { userId, isSuperAdmin: !!prof.data?.is_super_admin, vendor: vend.data || null };
}

export type OfsMode = "shop" | "cj" | "all";

/** Importe le catalogue OFS.
 *  "shop" = boutique du compte ; "cj" = produits plateforme/dropshipping (vendor_id null, >99%) ;
 *  "all" = tout. "cj" et "all" sont réservés aux super-admins. */
export async function importOfs(email: string, password: string, mode: OfsMode, limit = 2000): Promise<{ products: OfsProduct[]; isSuperAdmin: boolean; vendor: any | null }> {
  if (!OFS_ANON) throw new Error("OFS_SUPABASE_ANON_KEY manquante côté serveur.");
  const { sb, userId } = await client(email, password);

  const profRes = await sb.from("profiles").select("is_super_admin").eq("id", userId).maybeSingle();
  const isSuperAdmin = !!profRes.data?.is_super_admin;

  const vendRes = await sb.from("vendors").select("*").eq("user_id", userId).maybeSingle();
  const vendor = vendRes.data || null;

  let q = sb.from("products").select("*").limit(limit);
  if (mode === "all") {
    if (!isSuperAdmin) throw new Error("Mode 'toute la plateforme' réservé aux super-admins.");
  } else if (mode === "cj") {
    if (!isSuperAdmin) throw new Error("Mode 'catalogue plateforme (CJ)' réservé aux super-admins.");
    q = q.is("vendor_id", null);
  } else {
    if (!vendor) throw new Error("Aucune boutique OFS liée à ce compte.");
    q = q.eq("vendor_id", vendor.id);
  }
  const prodRes = await q;
  if (prodRes.error) throw new Error("Lecture produits OFS : " + prodRes.error.message);

  return { products: (prodRes.data || []).map(mapProduct), isSuperAdmin, vendor };
}

const STOP = new Set(["je", "veux", "un", "une", "des", "les", "le", "la", "du", "de", "pour", "moi", "montre", "stp", "cherche", "avec", "mon", "ma", "mes", "ce", "cette", "quel", "quelle", "est", "ai", "tu", "vous", "sur", "svp", "please", "the", "and", "matos", "truc", "chose", "avoir", "besoin"]);
function tokens(q: string): string[] {
  return String(q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)).slice(0, 6);
}

/** Recherche LIVE dans OFS (lecture publique). Tokenisée + classée par pertinence :
 *  chaque mot significatif est cherché dans name/subcategory/type/cj_category_name,
 *  puis on classe par nombre de mots présents dans le nom/la catégorie. */
export async function searchOfs(q: string, limit = 12, opts?: { vendorId?: string; cjOnly?: boolean }): Promise<OfsProduct[]> {
  if (!OFS_ANON) throw new Error("OFS_SUPABASE_ANON_KEY manquante.");
  const sb = createClient(OFS_URL, OFS_ANON, { auth: { persistSession: false } });
  const words = tokens(q);
  const fetchN = words.length ? Math.min(limit * 5, 60) : Math.min(limit, 30);

  function base() {
    let s = sb.from("products").select("*").limit(fetchN);
    if (opts?.vendorId) s = s.eq("vendor_id", opts.vendorId);
    if (opts?.cjOnly) s = s.is("vendor_id", null);
    return s;
  }

  if (!words.length) {
    const r = await base();
    if (r.error) throw new Error("Recherche OFS : " + r.error.message);
    return (r.data || []).map(mapProduct).slice(0, limit);
  }

  // OR sur chaque mot × plusieurs champs
  const ors = words.flatMap((w) => [`name.ilike.%${w}%`, `subcategory.ilike.%${w}%`, `type.ilike.%${w}%`, `cj_category_name.ilike.%${w}%`]).join(",");
  const r = await base().or(ors);
  if (r.error) throw new Error("Recherche OFS : " + r.error.message);
  const rows = (r.data || []);
  // classement : nombre de mots présents (nom compte double)
  const scored = rows.map((p: any) => {
    const name = String(p.name || "").toLowerCase();
    const cat = (String(p.type || "") + " " + String(p.subcategory || "") + " " + String(p.cj_category_name || "")).toLowerCase();
    let s = 0;
    words.forEach((w) => { if (name.includes(w)) s += 2; else if (cat.includes(w)) s += 1; });
    return { p, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => mapProduct(x.p));
}
