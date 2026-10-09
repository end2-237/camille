// ─────────────────────────────────────────────────────────────────────────────
// Un seul catalogue, vu de deux endroits.
//
// Camille et Meta tenaient chacun sa liste. Le commerçant ajoutait un article
// dans Camille, il n'apparaissait pas dans WhatsApp ; il en ajoutait un dans
// Commerce Manager, Camille l'ignorait — et ne pouvait pas décompter son stock.
// Deux vérités, donc aucune.
//
// Ici, une seule réconciliation, dans les deux sens :
//
//   CAMILLE → META   tout article de Camille est poussé chez Meta, et son
//                    identifiant Camille DEVIENT le retailer_id. C'est ce qui
//                    permet au flux WhatsApp de décompter le bon stock.
//   META → CAMILLE   tout article présent chez Meta et inconnu de Camille est
//                    importé, avec `meta_retailer_id` pour le relier.
//
// L'APPARIEMENT, dans cet ordre, et l'ordre compte :
//   1. le retailer_id EST un identifiant Camille — c'est nous qui l'avons écrit
//   2. `products.meta_retailer_id` correspond
//   3. le NOM correspond, aux accents et à la casse près → on relie, on ne
//      duplique pas. Sans cette étape, un catalogue alimenté des deux côtés
//      se retrouve en double après la première synchronisation.
//   4. sinon seulement : on crée.
//
// LES PIÈGES ÉVITÉS (chacun a déjà produit des doublons ou des fantômes) :
//   • Un article IMPORTÉ de Meta garde son identifiant Meta. Le republier sous
//     son identifiant Camille le mettait deux fois en vente, et le lien
//     basculait d'un identifiant à l'autre à chaque passage.
//   • Un article désactivé ou épuisé dans Camille passe « épuisé » chez Meta.
//     Il n'était plus envoyé du tout, donc restait « en stock » dans WhatsApp.
//   • Un article supprimé de Camille mais resté chez Meta est retiré — et
//     surtout pas réimporté comme un nouveau produit.
//   • Un catalogue partagé entre plusieurs agents : on n'importe jamais chez
//     l'un ce qui appartient à un autre.
//   • Tout le catalogue Meta est lu, page après page (pas seulement les 50
//     premiers), et deux réconciliations du même agent ne se chevauchent pas.
//
// SANS `products.meta_retailer_id` (migration_meta_transport.sql non
// appliquée), le sens META → CAMILLE est REFUSÉ. On ne pourrait pas enregistrer
// le lien, donc on réimporterait les mêmes articles à chaque passage, et le
// catalogue du marchand se remplirait de doublons. Mieux vaut ne rien faire et
// le dire.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import * as meta from "./meta";
import { avecAgent } from "./identifiants";
import { lirePrix } from "./prix";
import { decider } from "./appariement";
import { grouperVariantes, idsAttendus, produitParent, type AxeVariante } from "./variantes";

export type Rapport = {
  ok: boolean;
  /** Articles de Camille envoyés chez Meta. */
  pousses: number;
  /** Articles de Meta créés dans Camille. */
  importes: number;
  /** Articles qui existaient des deux côtés et qu'on vient de relier. */
  relies: number;
  /** Variations traduites, dans un sens ou dans l'autre. */
  variations: number;
  /** Ce qui n'a pas pu partir, avec la raison, article par article. */
  avertissements: string[];
  error?: string;
};

type Ligne = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  stock: number | null;
  category: string | null;
  active: boolean;
  meta_retailer_id: string | null;
  /** Les axes de variation, tels que Camille les déclare. */
  variants: AxeVariante[] | null;
  /** Les photos en plus de l'image principale. */
  images: string[] | null;
};

/** La colonne de liaison est-elle là ? Tout le sens Meta → Camille en dépend. */
async function colonneLiaison(): Promise<boolean> {
  try {
    await query(
      `SELECT meta_retailer_id FROM camille.products LIMIT 1`
    );
    return true;
  } catch {
    return false;
  }
}

async function produitsCamille(agentId: string): Promise<Ligne[]> {
  const r = await query(
    `SELECT id, name, description, price, COALESCE(currency,'XAF') AS currency,
            image_url, stock, category, COALESCE(active, true) AS active,
            COALESCE(variants, '[]'::jsonb) AS variants,
            COALESCE(to_jsonb(p)->'images', '[]'::jsonb) AS images,
            to_jsonb(p)->>'meta_retailer_id' AS meta_retailer_id
       FROM camille.products p
      WHERE agent_id = $1
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 5000`,
    [agentId]
  );
  return (r.rows as Record<string, unknown>[]).map((x) => ({
    id: String(x.id),
    name: String(x.name || ""),
    description: (x.description as string) || null,
    price: x.price != null ? Number(x.price) : null,
    currency: String(x.currency || "XAF"),
    image_url: (x.image_url as string) || null,
    stock: x.stock != null ? Number(x.stock) : null,
    category: (x.category as string) || null,
    active: x.active !== false,
    meta_retailer_id: (x.meta_retailer_id as string) || null,
    // La colonne est un JSONB : sur une base ancienne elle peut contenir
    // autre chose qu'un tableau, et la traduction doit l'ignorer sans broncher.
    variants: Array.isArray(x.variants) ? (x.variants as AxeVariante[]) : null,
    images: Array.isArray(x.images) ? (x.images as string[]) : null,
  }));
}

// ── La réconciliation ───────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ce retailer_id a-t-il été écrit par Camille (un identifiant de produit) ? */
const ecritParCamille = (rid: string) => UUID.test(produitParent(rid));

/** La devise d'un prix tel que Meta l'écrit : « 9 000 FCFA », « 12,50 EUR ». */
export function deviseDe(prix: unknown, defaut = "XAF"): string {
  const t = String(prix ?? "").toUpperCase();
  if (/F\s?CFA|\bCFA\b/.test(t)) return "XAF";
  const code = t.match(/\b([A-Z]{3})\b/);
  if (code) return code[1];
  if (t.includes("€")) return "EUR";
  if (t.includes("$")) return "USD";
  return defaut;
}

/** Une seule réconciliation à la fois par agent : deux passages croisés importaient en double. */
const enCours = new Set<string>();

/** Au nom de l'agent : son catalogue et son jeton s'il a connecté son WhatsApp. */
export async function reconcilier(
  agentId: string,
  options: { lien?: string; marque?: string } = {}
): Promise<Rapport> {
  if (enCours.has(agentId)) {
    return {
      ok: false, pousses: 0, importes: 0, relies: 0, variations: 0, avertissements: [],
      error: "Une synchronisation est déjà en cours pour cet agent. Réessayez dans un instant.",
    };
  }
  enCours.add(agentId);
  try {
    return await avecAgent(agentId, () => reconcilierPour(agentId, options));
  } finally {
    enCours.delete(agentId);
  }
}

async function reconcilierPour(
  agentId: string,
  options: { lien?: string; marque?: string }
): Promise<Rapport> {
  const rapport: Rapport = { ok: true, pousses: 0, importes: 0, relies: 0, variations: 0, avertissements: [] };

  const [camille, chezMeta, liaison] = await Promise.all([
    produitsCamille(agentId).catch((e) => {
      rapport.avertissements.push(`Catalogue Camille illisible : ${(e as Error).message}`);
      return null;
    }),
    meta.listCatalog(),
    colonneLiaison(),
  ]);

  if (!chezMeta.ok) {
    return { ...rapport, ok: false, error: chezMeta.error || "Catalogue Meta illisible" };
  }
  // Sans le catalogue Camille, on ne sait pas ce qui existe : ni ménage ni
  // import, sinon tout serait pris pour inconnu et réimporté.
  if (!camille) return { ...rapport, ok: false, error: rapport.avertissements[0] };

  const groupes = grouperVariantes(chezMeta.items);
  const groupeDe = new Map<string, string[]>();
  for (const g of groupes) for (const m of g.membres) groupeDe.set(m, g.membres);
  const presents = new Set(chezMeta.items.map((it) => it.retailer_id));

  // ── Qui est qui ───────────────────────────────────────────────────────────
  // Importé de Meta et toujours chez Meta : on met à jour SUR PLACE.
  const importes = camille.filter(
    (p) => p.meta_retailer_id && p.meta_retailer_id !== p.id && presents.has(p.meta_retailer_id)
  );
  const idsImportes = new Set(importes.map((p) => p.id));
  // Les autres sont publiés sous leur identifiant Camille.
  const propres = camille.filter((p) => !idsImportes.has(p.id));
  const dejaChezMeta = (p: Ligne) =>
    idsAttendus({ id: p.id, name: p.name, image_url: p.image_url }, p.variants).some((r) => presents.has(r)) ||
    presents.has(p.id);

  // ── Sens 1 : CAMILLE → META ───────────────────────────────────────────────
  // On pousse tout : `items_batch` avec la méthode UPDATE fait un upsert. Un
  // article désactivé part aussi, mais « épuisé » — s'il est déjà chez Meta.
  const envoyables = propres.filter(
    (p) => p.image_url && p.price != null && (p.active || dejaChezMeta(p))
  );
  for (const p of propres) {
    if (!p.active) continue;
    if (!p.image_url) rapport.avertissements.push(`${p.name} : pas d'image, non envoyé chez Meta`);
    else if (p.price == null) rapport.avertissements.push(`${p.name} : pas de prix, non envoyé chez Meta`);
  }
  const aJour = importes
    .filter((p) => p.price != null)
    .map((p) => ({ ...p, retailerIds: groupeDe.get(p.meta_retailer_id!) || [p.meta_retailer_id!] }));

  let poussesOk = true;
  if (envoyables.length || aJour.length) {
    const r = await meta.syncCatalogue([...envoyables, ...aJour], options);
    rapport.pousses = r.envoyes;
    rapport.avertissements.push(...(r.avertissements || []));
    if (!r.ok) {
      poussesOk = false;
      rapport.ok = false;
      rapport.error = r.error || "Envoi refusé par Meta";
    } else if (liaison && envoyables.length) {
      await query(
        `UPDATE camille.products SET meta_retailer_id = id::text, updated_at = NOW()
          WHERE agent_id = $1 AND id = ANY($2::uuid[])
            AND COALESCE(meta_retailer_id, '') <> id::text`,
        [agentId, envoyables.map((p) => p.id)]
      ).catch((e) => rapport.avertissements.push(`Liens non enregistrés : ${(e as Error).message}`));
    }
  }

  // ── Le ménage chez Meta ───────────────────────────────────────────────────
  // Seulement ce que Camille a écrit (identifiant de produit Camille) : un
  // article créé dans Commerce Manager n'est jamais supprimé d'ici.
  const parId = new Map(camille.map((p) => [p.id, p]));
  const attendus = new Map(envoyables.map((p) => [
    p.id, new Set(idsAttendus({ id: p.id, name: p.name, image_url: p.image_url }, p.variants)),
  ]));
  const parentsInconnus = [...new Set(
    chezMeta.items.map((it) => produitParent(it.retailer_id))
      .filter((pid) => UUID.test(pid) && !parId.has(pid))
  )];
  // Inconnu de CET agent ne veut pas dire supprimé : sur un catalogue partagé,
  // il peut appartenir à un autre. On ne retire que ce qui n'existe plus nulle part.
  const existeAilleurs = new Set<string>();
  if (parentsInconnus.length) {
    try {
      const r = await query(`SELECT id::text AS id FROM camille.products WHERE id = ANY($1::uuid[])`, [parentsInconnus]);
      for (const x of r.rows) existeAilleurs.add(String(x.id));
    } catch {
      parentsInconnus.forEach((x) => existeAilleurs.add(x)); // dans le doute, on ne retire rien
    }
  }

  const aRetirer: string[] = [];
  const raisons = { doublons: 0, perimes: 0, supprimes: 0 };
  for (const it of chezMeta.items) {
    const rid = it.retailer_id;
    if (!ecritParCamille(rid)) continue;
    const pid = produitParent(rid);
    const p = parId.get(pid);
    if (!p) {
      if (!existeAilleurs.has(pid)) { aRetirer.push(rid); raisons.supprimes++; }
      continue;
    }
    // Copie d'un article importé, publiée sous l'identifiant Camille par
    // l'ancienne synchronisation : l'original reste, la copie part.
    if (idsImportes.has(pid)) { aRetirer.push(rid); raisons.doublons++; continue; }
    // Variation retirée, ou parent remplacé par ses variations. Seulement si
    // la nouvelle version est bien partie, sinon on viderait la vitrine.
    const ok = attendus.get(pid);
    if (poussesOk && ok && !ok.has(rid)) { aRetirer.push(rid); raisons.perimes++; }
  }
  if (aRetirer.length) {
    const d = await meta.supprimerDuCatalogue(aRetirer);
    if (d.ok) {
      const det = [
        raisons.supprimes && `${raisons.supprimes} venant de produits supprimés dans Camille`,
        raisons.doublons && `${raisons.doublons} en double`,
        raisons.perimes && `${raisons.perimes} variation(s) périmée(s)`,
      ].filter(Boolean).join(", ");
      rapport.avertissements.push(`${aRetirer.length} article(s) retiré(s) de Meta (${det}).`);
    } else {
      rapport.avertissements.push(`Articles non retirés de Meta : ${d.error}`);
    }
  }

  // ── Sens 2 : META → CAMILLE ───────────────────────────────────────────────
  if (!liaison) {
    rapport.avertissements.push(
      "Import depuis Meta suspendu : la colonne products.meta_retailer_id est absente. " +
        "Sans elle, les mêmes articles seraient réimportés à chaque passage et votre " +
        "catalogue se remplirait de doublons. Appliquez migration_meta_transport.sql."
    );
    return rapport;
  }

  // Ce que N'IMPORTE QUEL agent a déjà relié : sur un catalogue partagé, ce
  // n'est pas à nous de l'importer.
  const liesAilleurs = new Set<string>();
  try {
    const rids = chezMeta.items.map((it) => it.retailer_id).filter((r) => !ecritParCamille(r));
    if (rids.length) {
      const r = await query(
        `SELECT meta_retailer_id FROM camille.products WHERE meta_retailer_id = ANY($1::text[])`,
        [rids]
      );
      for (const x of r.rows) liesAilleurs.add(String(x.meta_retailer_id));
    }
  } catch (e) {
    rapport.avertissements.push(`Import depuis Meta suspendu : ${(e as Error).message}`);
    return rapport;
  }

  // Les variations d'un même produit sont REGROUPÉES avant toute décision.
  // Sans ça, un article décliné en quatre couleurs créerait quatre produits
  // Camille : le catalogue du marchand doublerait à chaque synchronisation.
  const idsCamille = new Set(camille.map((p) => p.id));
  // L'appariement par nom ne doit jamais relier un produit déjà relié ailleurs.
  const libres = camille.filter((p) => !p.meta_retailer_id);

  for (const g of groupes) {
    // Écrit par Camille : c'est un de nos produits (ou un supprimé, retiré
    // plus haut). Jamais un import.
    if (g.membres.some((m) => ecritParCamille(m) || idsCamille.has(produitParent(m)))) continue;
    if (g.membres.some((m) => liesAilleurs.has(m))) continue;

    // L'appariement travaille sur le représentant du groupe, pas sur chaque
    // variation : c'est UN produit qu'on relie ou qu'on crée.
    const [d] = decider(libres, [g.principal]);
    if (!d || d.faire === "rien") continue;
    const it = chezMeta.items.find((x) => x.retailer_id === g.principal.retailer_id)!;
    const rid = g.principal.retailer_id;

    // Même nom des deux côtés : on RELIE. Créer ici ferait un doublon.
    if (d.faire === "relier") {
      try {
        await query(
          `UPDATE camille.products
              SET meta_retailer_id = $1,
                  variants = CASE WHEN $4::jsonb = '[]'::jsonb
                                  THEN COALESCE(variants, '[]'::jsonb) ELSE $4::jsonb END,
                  updated_at = NOW()
            WHERE id = $2 AND agent_id = $3`,
          [rid, d.camilleId, agentId, JSON.stringify(g.axes)]
        );
        rapport.relies++;
        if (g.axes.length) rapport.variations += g.membres.length;
        const k = libres.findIndex((p) => p.id === d.camilleId);
        if (k !== -1) libres.splice(k, 1);
        // Publié plus haut sous son identifiant Camille : maintenant relié à
        // l'original de Meta, cette copie ferait doublon dans WhatsApp.
        const cp = envoyables.find((p) => p.id === d.camilleId);
        if (cp) {
          await meta.supprimerDuCatalogue(
            idsAttendus({ id: cp.id, name: cp.name, image_url: cp.image_url }, cp.variants)
          ).catch(() => {});
        }
      } catch (e) {
        rapport.avertissements.push(`${it.name} : lien impossible — ${(e as Error).message}`);
      }
      continue;
    }

    // Inconnu : on l'importe, avec ses variations reconstruites. Meta ne tient
    // pas de quantité, seulement « en stock » ou « épuisé » — le stock reste
    // donc NULL (inconnu), ce qui vaut mieux qu'un nombre inventé.
    try {
      await query(
        `INSERT INTO camille.products
           (agent_id, name, description, price, currency, image_url, category,
            active, stock, variants, meta_retailer_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9::jsonb,$10)`,
        [
          agentId,
          String(g.principal.name || it.name || "Sans nom").slice(0, 200),
          String(it.description || "").slice(0, 4000),
          lirePrix(it.price),
          deviseDe(it.price),
          it.image_url || null,
          null,
          it.availability !== "out of stock",
          JSON.stringify(g.axes),
          rid,
        ]
      );
      rapport.importes++;
      if (g.axes.length) rapport.variations += g.membres.length;
    } catch (e) {
      rapport.avertissements.push(`${it.name} : import impossible — ${(e as Error).message}`);
    }
  }

  return rapport;
}

// ── La poussée d'un seul article, à la création ou à la modification ───────

type UnProduit = {
  id: string; name: string; description?: string | null; price?: number | null;
  currency?: string | null; image_url?: string | null; stock?: number | null;
  category?: string | null; active?: boolean | null; variants?: AxeVariante[] | null;
  images?: string[] | null;
};

/**
 * Envoyer UN article chez Meta, tout de suite après sa création ou sa
 * modification (prix, stock, désactivation).
 *
 * Volontairement silencieuse en cas d'échec : l'enregistrement dans Camille a
 * déjà réussi. La réconciliation complète rattrapera l'article.
 */
export async function pousserUn(
  agentId: string, p: UnProduit, options: { lien?: string; marque?: string } = {}
): Promise<void> {
  return avecAgent(agentId, () => pousserUnPour(agentId, p, options));
}

async function lienDe(agentId: string, id: string): Promise<string | null> {
  try {
    const r = await query(
      `SELECT to_jsonb(p)->>'meta_retailer_id' AS lien FROM camille.products p WHERE id = $1 AND agent_id = $2`,
      [id, agentId]
    );
    return (r.rows[0]?.lien as string) || null;
  } catch {
    return null;
  }
}

async function pousserUnPour(agentId: string, p: UnProduit, options: { lien?: string; marque?: string }): Promise<void> {
  if (!meta.metaConfigured().ok) return;
  if (p.price == null) return;
  const base = {
    id: p.id, name: p.name, description: p.description ?? null,
    price: Number(p.price), currency: p.currency || "XAF",
    image_url: p.image_url ?? null, stock: p.stock ?? null,
    category: p.category ?? null, active: p.active !== false,
    variants: Array.isArray(p.variants) ? p.variants : null,
    images: Array.isArray(p.images) ? p.images : null,
  };
  const lien = await lienDe(agentId, p.id);

  // Importé de Meta : mise à jour sur place, toutes variations comprises.
  if (lien && lien !== p.id) {
    const g = await meta.membresDuGroupe(lien);
    if (!g.ok) return; // Meta injoignable : surtout pas de republication en double
    if (g.ids.length) {
      const r = await meta.syncCatalogue([{ ...base, retailerIds: g.ids }], options);
      if (!r.ok) console.error(`[catalogue] ${p.name} non mis à jour chez Meta : ${r.error}`);
      return;
    }
    // L'original a disparu de Meta : l'article repart sous son identifiant Camille.
  }

  if (!p.image_url) return;
  // Désactivé et jamais publié : rien à dire à Meta.
  if (p.active === false && !lien) return;

  const r = await meta.syncCatalogue([base], options);
  if (!r.ok) {
    console.error(`[catalogue] ${p.name} non poussé chez Meta : ${r.error}`);
    return;
  }
  // Produit éclaté en variations : l'ancien article « parent » ne doit pas
  // rester en vente à côté d'elles. Best-effort : il peut ne pas exister.
  const ids = idsAttendus({ id: p.id, name: p.name, image_url: p.image_url }, p.variants);
  if (!ids.includes(p.id)) await meta.supprimerDuCatalogue([p.id]).catch(() => {});
  await query(
    `UPDATE camille.products SET meta_retailer_id = id::text, updated_at = NOW()
      WHERE id = $1 AND agent_id = $2`,
    [p.id, agentId]
  ).catch(() => {
    // 42703 : l'article est bien chez Meta, mais le lien n'est pas noté.
    console.warn(`[catalogue] ${p.name} poussé, lien non noté — migration_meta_transport.sql`);
  });
}

/**
 * Le stock de ces produits vient de bouger (commande, annulation) : Meta en
 * reçoit la nouvelle quantité, et « épuisé » quand elle tombe à zéro. Seuls
 * les produits déjà publiés sont concernés.
 */
export async function rafraichirChezMeta(agentId: string, ids: string[]): Promise<void> {
  const uniques = [...new Set(ids.filter((x) => UUID.test(x)))];
  if (!uniques.length) return;
  let rows: Record<string, unknown>[] = [];
  try {
    const r = await query(
      `SELECT id::text AS id, name, description, price, currency, image_url, stock, category,
              COALESCE(active, true) AS active,
              COALESCE(to_jsonb(p)->'variants', '[]'::jsonb) AS variants,
              COALESCE(to_jsonb(p)->'images', '[]'::jsonb) AS images
         FROM camille.products p
        WHERE agent_id = $1 AND id = ANY($2::uuid[])
          AND to_jsonb(p)->>'meta_retailer_id' IS NOT NULL`,
      [agentId, uniques]
    );
    rows = r.rows;
  } catch {
    return; // pas de colonne de liaison : rien n'est publié depuis Camille
  }
  for (const x of rows) {
    await pousserUn(agentId, {
      id: String(x.id), name: String(x.name),
      description: (x.description as string) ?? null,
      price: x.price != null ? Number(x.price) : null,
      currency: (x.currency as string) ?? null,
      image_url: (x.image_url as string) ?? null,
      stock: x.stock != null ? Number(x.stock) : null,
      category: (x.category as string) ?? null,
      active: x.active !== false,
      variants: Array.isArray(x.variants) ? (x.variants as AxeVariante[]) : null,
      images: Array.isArray(x.images) ? (x.images as string[]) : null,
    }).catch(() => {});
  }
}

/**
 * Retirer un article de Meta quand il disparaît de Camille.
 *
 * Sans ça, un produit supprimé reste proposable dans WhatsApp : le client le
 * met au panier, la commande tombe, et le commerçant n'a rien à vendre. Un
 * article importé de Meta part avec TOUTES ses variations.
 */
export async function retirerUn(
  retailerIds: string | string[] | null | undefined,
  /** L'agent dont le catalogue est concerné ; sans lui, le catalogue de l'application. */
  agentId?: string
): Promise<void> {
  if (agentId) return avecAgent(agentId, () => retirerUn(retailerIds));
  const ids = (Array.isArray(retailerIds) ? retailerIds : [retailerIds]).filter(Boolean) as string[];
  if (!ids.length || !meta.metaConfigured().ok) return;
  const tous = new Set(ids);
  for (const id of ids) {
    if (ecritParCamille(id)) continue;
    const g = await meta.membresDuGroupe(id);
    for (const m of g.ids) tous.add(m);
  }
  const r = await meta.supprimerDuCatalogue([...tous]);
  if (!r.ok) console.error(`[catalogue] ${[...tous].join(", ")} non retiré(s) de Meta : ${r.error}`);
}
