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

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OfsProduct = {
  name: string; description: string | null; price: number | null; price_max: number | null;
  currency: string; category: string | null; tags: string[]; stock: number | null;
  image_url: string | null; images: string[]; product_url: string | null;
  variants: { name: string; options: { value: string; image?: string | null }[] }[];
};

function mapColors(colors: any): OfsProduct["variants"] {
  if (!colors) return [];
  let arr: any[] = [];
  if (Array.isArray(colors)) arr = colors;
  else if (typeof colors === "string") { try { const p = JSON.parse(colors); arr = Array.isArray(p) ? p : []; } catch { arr = colors.split(",").map((s) => s.trim()); } }
  const options = arr.map((c) => (typeof c === "string" ? { value: c } : { value: c.name || c.value || c.color || "", image: c.image || c.img || null }))
    .filter((o) => o.value);
  return options.length ? [{ name: "Couleur", options }] : [];
}

function mapProduct(p: any): OfsProduct {
  const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  const onSale = p.is_on_sale && p.now != null;
  return {
    name: p.name || "Produit",
    description: p.description ?? null,
    price: onSale ? Number(p.now) : (p.price != null ? Number(p.price) : null),
    price_max: onSale && p.price != null ? Number(p.price) : null,
    currency: "XAF",
    category: p.category || p.type || null,
    tags: ["ofs", "ofs:" + p.id].concat(p.brand ? [String(p.brand)] : []),
    stock: p.quantity != null ? Number(p.quantity) : null,
    image_url: p.img || imgs[0] || null,
    images: imgs,
    product_url: `https://www.onefreestyle.store/product/${p.id}`,
    variants: mapColors(p.colors),
  };
}

async function client(email: string, password: string): Promise<{ sb: SupabaseClient; userId: string }> {
  const sb = createClient(OFS_URL, OFS_ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw new Error("Connexion OFS échouée : " + (error?.message || "identifiants invalides"));
  return { sb, userId: data.user.id };
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

/** Recherche LIVE dans OFS (lecture publique, sans login) — pour brancher le gros
 *  catalogue CJ en direct (MCP / RAG) sans tout importer. */
export async function searchOfs(q: string, limit = 12, opts?: { vendorId?: string; cjOnly?: boolean }): Promise<OfsProduct[]> {
  if (!OFS_ANON) throw new Error("OFS_SUPABASE_ANON_KEY manquante.");
  const sb = createClient(OFS_URL, OFS_ANON, { auth: { persistSession: false } });
  let sel = sb.from("products").select("*").limit(Math.min(limit, 50));
  if (opts?.vendorId) sel = sel.eq("vendor_id", opts.vendorId);
  if (opts?.cjOnly) sel = sel.is("vendor_id", null);
  if (q && q.trim()) sel = sel.or(`name.ilike.%${q}%,description.ilike.%${q}%,type.ilike.%${q}%,category.ilike.%${q}%`);
  const r = await sel;
  if (r.error) throw new Error("Recherche OFS : " + r.error.message);
  return (r.data || []).map(mapProduct);
}
