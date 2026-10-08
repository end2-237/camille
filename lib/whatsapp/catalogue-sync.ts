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
      LIMIT 500`,
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

/** Au nom de l'agent : son catalogue et son jeton s'il a connecté son WhatsApp. */
export async function reconcilier(
  agentId: string,
  options: { lien?: string; marque?: string } = {}
): Promise<Rapport> {
  return avecAgent(agentId, () => reconcilierPour(agentId, options));
}

async function reconcilierPour(
  agentId: string,
  options: { lien?: string; marque?: string }
): Promise<Rapport> {
  const rapport: Rapport = { ok: true, pousses: 0, importes: 0, relies: 0, variations: 0, avertissements: [] };

  const [camille, chezMeta, liaison] = await Promise.all([
    produitsCamille(agentId).catch((e) => {
      rapport.avertissements.push(`Catalogue Camille illisible : ${(e as Error).message}`);
      return [] as Ligne[];
    }),
    meta.listCatalog(),
    colonneLiaison(),
  ]);

  if (!chezMeta.ok) {
    return { ...rapport, ok: false, error: chezMeta.error || "Catalogue Meta illisible" };
  }

  // ── Sens 1 : CAMILLE → META ───────────────────────────────────────────────
  // On pousse tout : `items_batch` avec la méthode UPDATE fait un upsert, donc
  // un article déjà présent est simplement mis à jour. Pousser la totalité
  // plutôt que le delta évite une dérive silencieuse des prix et des stocks.
  const envoyables = camille.filter((p) => p.active && p.image_url && p.price != null);
  for (const p of camille) {
    if (!p.active) continue;
    if (!p.image_url) rapport.avertissements.push(`${p.name} : pas d'image, non envoyé chez Meta`);
    else if (p.price == null) rapport.avertissements.push(`${p.name} : pas de prix, non envoyé chez Meta`);
  }

  if (envoyables.length) {
    const r = await meta.syncCatalogue(envoyables, options);
    if (!r.ok) {
      rapport.ok = false;
      rapport.error = r.error || "Envoi refusé par Meta";
    } else {
      rapport.pousses = r.envoyes;
      rapport.avertissements.push(...(r.avertissements || []));

      // Le ménage : des articles Meta qui ne correspondent plus à rien. Un
      // produit passé en variations laisse derrière lui son article « parent » ;
      // une option retirée laisse son article de variation. Laissés en place,
      // ils restent en vente dans WhatsApp, en double ou sans stock.
      const attendus = new Map(envoyables.map((p) => [
        p.id,
        new Set(idsAttendus({ id: p.id, name: p.name, image_url: p.image_url }, p.variants)),
      ]));
      const perimes = chezMeta.items
        .map((it) => it.retailer_id)
        .filter((rid) => {
          const ok = attendus.get(produitParent(rid));
          return ok !== undefined && !ok.has(rid);
        });
      if (perimes.length) {
        const d = await meta.supprimerDuCatalogue(perimes);
        if (d.ok) rapport.avertissements.push(`${perimes.length} article(s) périmé(s) retiré(s) de Meta : ${perimes.join(", ")}`);
        else rapport.avertissements.push(`Articles périmés non retirés de Meta : ${d.error}`);
      }
      if (liaison) {
        await query(
          `UPDATE camille.products SET meta_retailer_id = id::text, updated_at = NOW()
            WHERE agent_id = $1 AND id = ANY($2::uuid[])
              AND COALESCE(meta_retailer_id, '') <> id::text`,
          [agentId, envoyables.map((p) => p.id)]
        ).catch((e) => rapport.avertissements.push(`Liens non enregistrés : ${(e as Error).message}`));
      }
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

  // Les variations d'un même produit sont REGROUPÉES avant toute décision.
  // Sans ça, un article décliné en quatre couleurs créerait quatre produits
  // Camille : le catalogue du marchand doublerait à chaque synchronisation et
  // il ne saurait plus lequel modifier.
  const groupes = grouperVariantes(chezMeta.items);

  // Un article Camille déjà relié à N'IMPORTE QUELLE variation du groupe
  // signifie que le produit est connu : on ne le réimporte pas.
  const liesConnus = new Set(camille.map((p) => p.meta_retailer_id).filter(Boolean) as string[]);
  const idsCamille = new Set(camille.map((p) => p.id));

  for (const g of groupes) {
    const dejaConnu = g.membres.some(
      (m) => liesConnus.has(m) || idsCamille.has(produitParent(m))
    );
    if (dejaConnu) continue;

    // L'appariement travaille sur le représentant du groupe, pas sur chaque
    // variation : c'est UN produit qu'on relie ou qu'on crée.
    const [d] = decider(camille, [g.principal]);
    if (!d || d.faire === "rien") continue;
    const it = chezMeta.items.find((x) => x.retailer_id === g.principal.retailer_id)!;
    const rid = g.principal.retailer_id;

    // Même nom des deux côtés : on RELIE. Créer ici ferait un doublon, et
    // c'est le cas le plus fréquent d'un catalogue alimenté des deux bords.
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
      } catch (e) {
        rapport.avertissements.push(`${it.name} : lien impossible — ${(e as Error).message}`);
      }
      continue;
    }

    // Inconnu : on l'importe, avec ses variations reconstruites. Meta ne tient
    // pas de quantité, seulement « en stock » ou « épuisé » — le stock reste
    // donc NULL (inconnu), ce qui vaut mieux qu'un nombre inventé que le
    // commerçant croirait.
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
          "XAF",
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

// ── La poussée d'un seul article, à la création ─────────────────────────────

/**
 * Envoyer UN article chez Meta, tout de suite après sa création.
 *
 * C'est ce qui rend le catalogue unique à l'usage : le commerçant ajoute un
 * produit dans Camille, et il est dans WhatsApp sans qu'il ait rien à faire.
 *
 * Volontairement silencieuse en cas d'échec : la création du produit dans
 * Camille a déjà réussi, et la faire échouer parce que Meta n'a pas répondu
 * serait absurde. La réconciliation complète rattrapera l'article.
 */
export async function pousserUn(
  agentId: string,
  p: { id: string; name: string; description?: string | null; price?: number | null;
       currency?: string | null; image_url?: string | null; stock?: number | null;
       category?: string | null; active?: boolean | null; variants?: AxeVariante[] | null;
       images?: string[] | null },
  options: { lien?: string; marque?: string } = {}
): Promise<void> {
  return avecAgent(agentId, () => pousserUnPour(agentId, p, options));
}

async function pousserUnPour(
  agentId: string,
  p: { id: string; name: string; description?: string | null; price?: number | null;
       currency?: string | null; image_url?: string | null; stock?: number | null;
       category?: string | null; active?: boolean | null; variants?: AxeVariante[] | null;
       images?: string[] | null },
  options: { lien?: string; marque?: string }
): Promise<void> {
  if (!meta.metaConfigured().ok) return;
  if (p.active === false || !p.image_url || p.price == null) return;

  const r = await meta.syncCatalogue(
    [{
      id: p.id, name: p.name, description: p.description ?? null,
      price: Number(p.price), currency: p.currency || "XAF",
      image_url: p.image_url, stock: p.stock ?? null,
      category: p.category ?? null, active: true,
      // Sans les axes, un produit décliné partait comme UN seul article :
      // le client ne voyait aucune variation dans WhatsApp.
      variants: Array.isArray(p.variants) ? p.variants : null,
      images: Array.isArray(p.images) ? p.images : null,
    }],
    options
  );
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
    // 42703 : l'article est bien chez Meta, mais le lien n'est pas noté. Le
    // stock ne baissera pas sur ses commandes jusqu'à la migration.
    console.warn(`[catalogue] ${p.name} poussé, lien non noté — migration_meta_transport.sql`);
  });
}

/**
 * Retirer un article de Meta quand il disparaît de Camille.
 *
 * Sans ça, un produit supprimé reste proposable dans WhatsApp : le client le
 * met au panier, la commande tombe, et le commerçant n'a rien à vendre. C'est
 * le pire des deux mondes — on a encaissé l'attente du client sans la
 * marchandise.
 */
export async function retirerUn(
  retailerIds: string | string[] | null | undefined,
  /** L'agent dont le catalogue est concerné ; sans lui, le catalogue de l'application. */
  agentId?: string
): Promise<void> {
  if (agentId) return avecAgent(agentId, () => retirerUn(retailerIds));
  const ids = (Array.isArray(retailerIds) ? retailerIds : [retailerIds]).filter(Boolean) as string[];
  if (!ids.length || !meta.metaConfigured().ok) return;
  const r = await meta.supprimerDuCatalogue(ids);
  if (!r.ok) console.error(`[catalogue] ${ids.join(", ")} non retiré(s) de Meta : ${r.error}`);
}
