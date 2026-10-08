// ─────────────────────────────────────────────────────────────────────────────
// Le flux boutique : un agent qui COMPREND, puis qui EXÉCUTE.
//
// L'architecture, en une phrase : WhatsApp Business fournit déjà la mécanique
// (fiche produit, carrousel, panier, commande, demande de position). On n'a
// donc RIEN d'interactif à inventer. Tout le travail porte sur un seul point —
// comprendre au millimètre ce que le client veut — puis choisir le bon
// composant dans une bibliothèque qui existe déjà.
//
//   LE MESSAGE DU CLIENT
//        │
//        ├─ événement natif (panier, position, bouton) → exécution directe.
//        │  Aucune phrase à comprendre : il n'y a pas d'ambiguïté à lever.
//        │
//        └─ phrase libre → comprendre() renvoie une LISTE d'intentions
//                        → executer() choisit les composants
//
// La panoplie d'actions, et le composant Meta de chacune :
//
//   repondre     → message texte, tout nombre vérifié par phraseAncree()
//   montrer      → 1 article : `product`     (la fiche, prix du catalogue)
//                  2 à 10    : `carousel`    (les fiches défilent)
//                  plus de 10: `product_list`(liste par catégories)
//   vitrine      → le catalogue entier, même règle de format
//   mode_emploi  → `video` + enchaîne sur la vitrine
//   infos        → texte + `location` (notre adresse sur la carte)
//   position     → `location_request_message` — le bouton natif, jamais
//                  « appuie sur le trombone »
//   retrait      → texte + notre position
//   humain       → relais, et l'agent se tait ensuite
//   accueil      → `button`, et le scénario du nouveau venu s'il est nouveau
//
// Le choix du composant n'est JAMAIS laissé au modèle : il dit ce que le
// client veut, le code décide comment le montrer. C'est ce qui rend le rendu
// identique d'une conversation à l'autre.
//
// Tout ce qui suit la compréhension dans `repondreBoutique` (étapes 5 à 11)
// est un REPLI, pour le jour où la clé manque ou le modèle ne répond pas.
// Dégradé, mais il ne mentira pas.
//
// Ce que les composants natifs changent, et c'est l'essentiel : le client ne
// tape plus « oui je veux ça », il appuie sur un bouton et compose son panier
// dans WhatsApp. Les deux bugs les plus coûteux de la version n8n — « oui »
// après une rupture, et « okey je veux donc ça » — ne peuvent PAS se produire
// ici : il n'y a plus de phrase à interpréter à ces endroits.
//
// Conséquence directe : ce fichier n'appelle AUCUN modèle de langue. Tout ce
// qu'il fait est déterministe, donc gratuit. C'est la moitié du système qu'on
// peut porter et éprouver sans clé Groq payante.
//
// Le modèle reviendra pour ce qu'il sait faire — comprendre une phrase libre,
// l'argot, une faute de frappe — et le code continuera de vérifier. CVA ne
// change pas ; sa surface se réduit.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";
import { sectorProfile } from "@/lib/sectorProfiles";
import { createOrder } from "@/lib/orders";
import * as meta from "./meta";
import { tracer, sessionMeta, type Contexte } from "./handle";
import { lireIdSuivi, recapCommande, etapesCommande, type ActionSuivi } from "./suivi";
import { chargerCommande, envoyerAnimation } from "./suivi-envoi";
import { notify } from "@/lib/webhooks";
import { sansAccent, chercher, veutToutVoir, estUneQuestion } from "./recherche";
import { lirePrix } from "./prix";
import { formatVitrine, formatNaturel, noterEnvoi } from "./repetition";
import {
  articlesPour, libelleVariante, produitParent, retailerAffiche, varianteDemandee,
  type AxeVariante, type VarianteAffichable,
} from "./variantes";
import {
  resumeMemoire, fusionnerNotes, faitsDesAchats, MAX_NOTES,
  type Souvenir,
} from "./memoire";
import {
  comprendre, comprehensionDisponible,
  type Action, type FaitsCommerce,
} from "./comprendre";

// ── Identifiants de nos propres boutons ─────────────────────────────────────
// Préfixés pour ne jamais être confondus avec un identifiant de catalogue.
const B = {
  catalogue: "cam:catalogue",
  conseiller: "cam:conseiller",
  livrer: "cam:livrer",
  retirer: "cam:retirer",
  infos: "cam:infos",
  tuto: "cam:tuto",
  rode: "cam:rode",
  ok: "cam:ok",
  encore: "cam:encore",
} as const;

/**
 * La vidéo du mode d'emploi.
 *
 * Réglable par agent plus tard ; pour l'instant une seule, par variable
 * d'environnement. Sans URL configurée, on explique en texte — on ne reste
 * jamais muet sur une promesse qu'on vient de faire au client.
 */
// Une vidéo de démonstration publique, pour éprouver le mécanisme avant d'avoir
// filmé la vraie : 5 s, 2,8 Mo, vrai video/mp4, joignable sans compte.
// Mesuré sur la même source : 15 s = 11,9 Mo, et 30 s = 21,6 Mo, que Meta
// REFUSE (limite 16 Mo). On prend la plus légère — c'est elle qui se téléverse
// le plus vite au premier appel, et le poids ne sert à rien ici.
const TUTO_DEMO = "https://download.samplelib.com/mp4/sample-5s.mp4";
const TUTO_URL = process.env.TUTO_VIDEO_URL || TUTO_DEMO;

export type Produit = {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  category: string | null;
  stock: number | null;
  image_url: string | null;
  retailerId: string;
  /** Les axes de variation Camille (null pour un article lu chez Meta). */
  variants?: AxeVariante[] | null;
  /** Les valeurs de variation à reconnaître dans une demande (« Noir », « 42 »). */
  options?: string[];
  /** Les mêmes, lisibles pour le modèle : « Couleur : Noir, Bleu ». */
  optionsTexte?: string;
  /** Chaque variante envoyable : la fiche à montrer quand le client en nomme une. */
  variantes?: VarianteAffichable[];
};

/**
 * Remplace chaque produit à variantes par la ou les variantes que le texte
 * nomme. Un produit dont aucune variante n'est nommée reste tel quel ; une
 * variante choisie perd sa liste, pour ne pas être re-choisie plus loin.
 */
function preciserVariantes(prods: Produit[], ...textes: string[]): Produit[] {
  return prods.flatMap((p) => {
    if (!p.variantes || p.variantes.length < 2) return [p];
    for (const t of textes) {
      const v = varianteDemandee(p.variantes, t || "");
      if (v.length) {
        return v.map((x) => ({
          ...p,
          retailerId: x.retailerId,
          name: `${p.name.split(" — ")[0]} — ${x.option}`,
          variantes: undefined,
        }));
      }
    }
    return [p];
  });
}

/** Les variations d'un produit Camille, sous les deux formes utiles. */
function optionsDe(axes: AxeVariante[] | null | undefined): { options: string[]; optionsTexte: string } {
  const propres = (Array.isArray(axes) ? axes : []).filter((a) => a?.name && Array.isArray(a.options));
  const valeurs = (a: AxeVariante) =>
    a.options.map((o) => (typeof o === "string" ? o : String(o?.value || ""))).filter(Boolean);
  return {
    options: propres.flatMap(valeurs),
    optionsTexte: propres.map((a) => `${a.name} : ${valeurs(a).join(", ")}`).join(" ; "),
  };
}

function money(n: number, cur = "XAF"): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${cur}`;
}

// ── Le catalogue ────────────────────────────────────────────────────────────

/**
 * Les produits vendables de cet agent.
 *
 * Deux sources, dans cet ordre :
 *
 *   1. `camille.products`, quand les produits portent un `meta_retailer_id` —
 *      c'est l'état visé, une fois la synchronisation en place : Camille reste
 *      la source de vérité du stock et des prix.
 *   2. Le catalogue Meta lui-même, sinon. C'est ce qui permet de tester
 *      aujourd'hui avec un catalogue déjà rempli côté Meta, sans rien migrer.
 *
 * Un article épuisé n'est jamais renvoyé : proposer ce qu'on ne peut pas
 * honorer est la faute qui coûte un client.
 */
async function catalogue(agentId: string): Promise<Produit[]> {
  try {
    const r = await query(
      `SELECT id, name, price, COALESCE(currency,'XAF') AS currency, category, stock, image_url,
              to_jsonb(p)->>'meta_retailer_id' AS retailer,
              COALESCE(to_jsonb(p)->'variants', '[]'::jsonb) AS variants
         FROM camille.products p
        WHERE agent_id = $1 AND active = true
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 100`,
      [agentId]
    );
    const mappes = r.rows
      .filter((x: Record<string, unknown>) => x.retailer)
      .map((x: Record<string, unknown>) => ({
        id: String(x.id),
        name: String(x.name),
        price: x.price != null ? Number(x.price) : null,
        currency: String(x.currency || "XAF"),
        category: (x.category as string) || null,
        stock: x.stock != null ? Number(x.stock) : null,
        image_url: (x.image_url as string) || null,
        variants: Array.isArray(x.variants) ? (x.variants as AxeVariante[]) : null,
        ...optionsDe(Array.isArray(x.variants) ? (x.variants as AxeVariante[]) : null),
        // Un produit publié avec ses variations n'existe chez Meta QUE sous
        // « <id>:<option> » : l'identifiant du parent donnerait « product not
        // found ». Un article importé de Meta garde, lui, son propre identifiant.
        variantes:
          String(x.retailer) === String(x.id)
            ? articlesPour(
                { id: String(x.id), name: String(x.name), image_url: (x.image_url as string) || null },
                Array.isArray(x.variants) ? (x.variants as AxeVariante[]) : null
              ).articles
                .filter((a) => a.itemGroupId && a.valeur)
                .map((a) => ({ option: String(a.valeur), retailerId: a.retailerId }))
            : undefined,
        retailerId:
          String(x.retailer) === String(x.id)
            ? retailerAffiche(
                { id: String(x.id), name: String(x.name), image_url: (x.image_url as string) || null },
                Array.isArray(x.variants) ? (x.variants as AxeVariante[]) : null
              )
            : String(x.retailer),
      }))
      .filter((p) => p.stock == null || p.stock > 0);
    if (mappes.length) return mappes;
  } catch { /* colonne absente ou base non migrée : on lit chez Meta */ }

  const m = await meta.listCatalog();
  if (!m.ok) {
    console.error("[boutique] catalogue Meta illisible :", m.error);
    return [];
  }
  // On n'offre QUE les produits que WhatsApp accepte réellement en message.
  // `sendable` vient de `capability_to_review_status` / clé WHATSAPP : un
  // produit « in stock » et « published » peut très bien être refusé à l'envoi
  // s'il n'a pas passé l'examen commerce. Les écarter ici évite de reposer sur
  // le repli par essais-erreurs — qui reste, mais ne devrait plus servir.
  const ecartes = m.items.filter((it) => it.sendable === false).map((it) => it.retailer_id);
  if (ecartes.length) {
    console.warn(
      `[boutique] ${ecartes.length} produit(s) en attente d'approbation WhatsApp, non proposés : ${ecartes.join(", ")}`
    );
  }
  // Les variations d'un même produit (même item_group_id) ne sont montrées
  // qu'UNE fois : WhatsApp affiche le sélecteur de variantes dans la fiche.
  // Sans ça, « Watch 6 — Noir », « — Bleu », « — Rouge » défilaient comme
  // trois produits différents.
  const groupesVus = new Set<string>();
  // Les options de chaque groupe, rassemblées AVANT de n'en garder qu'une
  // fiche : sinon « t'as la noire ? » ne saurait pas que le noir existe.
  const optionsGroupe = new Map<string, Set<string>>();
  // Et les articles de chaque groupe, pour envoyer LA couleur demandée.
  const variantesGroupe = new Map<string, VarianteAffichable[]>();
  for (const it of m.items) {
    if (!it.item_group_id) continue;
    if (it.availability !== "out of stock" && it.sendable !== false) {
      const option = [it.color, it.size, it.pattern, it.material, it.custom_label_0]
        .find(Boolean) || String(it.name || "").split(" — ")[1];
      if (option) {
        const liste = variantesGroupe.get(it.item_group_id) || [];
        liste.push({ option: String(option).trim(), retailerId: it.retailer_id });
        variantesGroupe.set(it.item_group_id, liste);
      }
    }
    const set = optionsGroupe.get(it.item_group_id) || new Set<string>();
    for (const v of [it.color, it.size, it.pattern, it.material, it.custom_label_0]) if (v) set.add(String(v));
    // Repli : la variation lue dans le nom, « Tasse — Noir ».
    const suffixe = String(it.name || "").split(" — ")[1];
    if (suffixe) set.add(suffixe.trim());
    optionsGroupe.set(it.item_group_id, set);
  }
  return m.items
    .filter((it) => it.availability !== "out of stock" && it.sendable !== false)
    .filter((it) => {
      if (!it.item_group_id) return true;
      if (groupesVus.has(it.item_group_id)) return false;
      groupesVus.add(it.item_group_id);
      return true;
    })
    .map((it) => {
      // Meta renvoie le prix FORMATÉ, et son format dépend de la devise :
      // « 9 000 FCFA » sans décimales, « 12,50 EUR » avec. On le LIT, on ne
      // devine plus — la supposition « il y a toujours deux décimales »
      // annonçait 90 XAF pour un article à 9 000.
      const n = lirePrix(it.price);
      const opts = it.item_group_id ? [...(optionsGroupe.get(it.item_group_id) || [])] : [];
      return {
        id: it.retailer_id,
        // Le nom du groupe, sans « — Noir » : la fiche propose toutes les options.
        name: opts.length > 1 ? String(it.name).split(" — ")[0] : it.name,
        options: opts,
        optionsTexte: opts.length > 1 ? `options : ${opts.join(", ")}` : "",
        variantes: it.item_group_id ? variantesGroupe.get(it.item_group_id) : undefined,
        price: n != null && n > 0 ? n : null,
        currency: "XAF",
        category: null,
        stock: null,
        image_url: it.image_url || null,
        retailerId: it.retailer_id,
      };
    });
}

/**
 * Montrer des produits — un format par situation.
 *
 * Les quatre formats natifs ont été éprouvés en production sur le numéro
 * Buyticle, et ils ne se valent pas :
 *
 *   1 produit        → `product`   une fiche, photo + prix du catalogue
 *   2 à 10 produits  → `carousel`  les fiches défilent horizontalement — le
 *                                  format le plus vendeur, celui qui remplace
 *                                  vraiment les albums bricolés
 *   plus de 10       → `product_list` une liste par catégories
 *   rien de précis   → `catalog_message` un bouton vers tout le catalogue
 *
 * Le carrousel interdit en-tête, pied de page et boutons : c'est la fiche qui
 * porte le prix et le bouton « ajouter au panier ». Le texte passe donc dans
 * le corps, et c'est le seul endroit où l'on parle.
 */
async function montrerVitrine(
  ctx: Contexte, prods: Produit[], entete: string, corps: string,
  /**
   * `true` quand c'est TOUT le catalogue.
   *
   * Dans ce cas seulement, le FORMAT s'allège si le client vient de le
   * recevoir : carrousel → liste → carte de catalogue. On ne lui retire rien
   * et on ne lui demande rien — les mêmes articles restent à un geste — mais
   * son fil ne se remplit pas quatre fois des mêmes photos.
   *
   * Une sélection ciblée garde toujours son grand format : s'il demande les
   * montres puis les écouteurs, chaque réponse mérite ses fiches.
   */
  complete = false
) {
  const { phone } = ctx;

  // Une sélection ciblée montre la couleur demandée, pas la première du groupe.
  if (!complete) prods = preciserVariantes(prods, ctx.msg.text || "");

  if (!prods.length) {
    await meta.sendText(phone, "Je n'ai rien à te montrer pour le moment 😔 Réécris-moi un peu plus tard.");
    return;
  }

  const cle = `${ctx.agent.id}|${phone}`;
  const ids = prods.map((p) => p.id);
  const format = complete ? formatVitrine(cle, ids) : formatNaturel(prods.length);
  if (complete) noterEnvoi(cle, ids);

  switch (format) {
    // ── Une fiche : photo, prix, bouton « Ajouter au panier » ──────────────
    case "fiche": {
      const p = prods[0];
      // On ne réécrit PAS le prix. La fiche native l'affiche déjà, tenu par le
      // catalogue Meta. Le redire, c'est se donner une chance de le
      // contredire — et c'est arrivé : « 9 000 FCFA » sur la fiche, « 90 XAF »
      // dans notre texte juste en dessous.
      const r = await meta.sendProduct(
        phone, p.retailerId, (corps || p.name) + "\n\nTu peux l'ajouter à ton panier ici 👇"
      );
      if (!r.ok) {
        console.error("[boutique] fiche produit refusée :", r.error);
        // Fiche injoignable : on ne laisse pas le client sans réponse.
        await meta.sendCatalog(phone, "Je n'arrive pas à afficher cet article — voici tout notre catalogue 👇");
      }
      await tracer(ctx.agent.id, phone, "assistant", `[fiche] ${p.name}`);
      return;
    }

    // ── Le carrousel : le plus vendeur, et le plus encombrant ──────────────
    case "carrousel": {
      const r = await meta.sendCarouselRobuste(
        phone,
        (corps || "Voici ce qu'on a pour toi") +
          "\n\nFais défiler 👉 touche une fiche pour l'ajouter à ton panier, puis envoie-moi le panier.",
        prods.slice(0, 10).map((p) => p.retailerId)
      );
      if (r.rejetes?.length) console.warn("[boutique] fiches retirées :", r.rejetes.join(", "));
      if (!r.ok) {
        console.error("[boutique] carrousel refusé :", r.error);
        await meta.sendCatalog(phone, corps || "Voici notre catalogue 👇");
      }
      await tracer(ctx.agent.id, phone, "assistant", `[carrousel] ${prods.length} articles`);
      return;
    }

    // ── La liste : tout est là, replié derrière un bouton ──────────────────
    case "liste": {
      const parCat = new Map<string, string[]>();
      for (const p of prods.slice(0, 30)) {
        const k = p.category || entete || "Nos articles";
        if (!parCat.has(k)) parCat.set(k, []);
        parCat.get(k)!.push(p.retailerId);
      }
      const sections = [...parCat.entries()].map(([title, retailerIds]) => ({ title, retailerIds }));
      const r = await meta.sendProductList(
        phone, entete || "Notre boutique",
        corps || `Nos ${prods.length} articles, par catégorie 👇`,
        sections, "Ajoute au panier et envoie-le 🛒"
      );
      if (!r.ok) {
        console.error("[boutique] liste refusée :", r.error);
        await meta.sendCatalog(phone, corps || "Voici notre catalogue 👇");
      }
      await tracer(ctx.agent.id, phone, "assistant", `[liste] ${prods.length} articles`);
      return;
    }

    // ── La carte de catalogue : une seule carte, tout le catalogue ─────────
    case "catalogue": {
      const r = await meta.sendCatalog(
        phone,
        corps || "Tout notre catalogue est ici 👇 touche pour parcourir et composer ton panier.",
        entete || undefined
      );
      if (!r.ok) {
        console.error("[boutique] carte catalogue refusée :", r.error);
        // Dernier recours : la liste. Mieux vaut encombrer que ne rien montrer.
        await meta.sendProductList(
          phone, entete || "Notre boutique", corps || "Voici ce qu'on propose",
          [{ title: entete || "Nos articles", retailerIds: prods.slice(0, 10).map((p) => p.retailerId) }],
          "Ajoute au panier 🛒"
        );
      }
      await tracer(ctx.agent.id, phone, "assistant", "[carte catalogue]");
      return;
    }
  }
}

// ── L'accueil, et le mode d'emploi ──────────────────────────────────────────

/**
 * Ce client nous a-t-il déjà écrit ?
 *
 * La question n'est pas cosmétique : proposer le mode d'emploi à un habitué à
 * chaque bonjour est une nuisance, et c'est exactement le genre de détail qui
 * fait dire « c'est un robot ». On ne le propose donc qu'une fois.
 *
 * `camille.contacts.welcomed_at` existait déjà pour ça — autant s'en servir
 * plutôt que d'ajouter une colonne.
 *
 * La LECTURE et l'ÉCRITURE sont séparées exprès. Si on marquait « accueilli »
 * à la simple arrivée d'un message, un nouveau client dont le premier mot est
 * « c'est combien la montre » perdrait l'offre du mode d'emploi pour toujours —
 * on lui aurait répondu sur le prix, ce qui est juste, et jamais proposé le
 * tutoriel. On ne marque donc qu'au moment où on accueille réellement.
 *
 * Si la table n'est pas là, on répond « habitué » : rater un tutoriel est sans
 * gravité, le proposer en boucle ne l'est pas.
 */
async function estNouveau(agentId: string, phone: string): Promise<boolean> {
  try {
    const r = await query(
      `SELECT welcomed_at FROM camille.contacts
        WHERE agent_id = $1 AND phone = $2 LIMIT 1`,
      [agentId, phone]
    );
    return !r.rows.length || r.rows[0].welcomed_at == null;
  } catch (e) {
    console.error("[boutique] contact illisible :", (e as Error).message);
    return false;
  }
}

async function marquerAccueilli(agentId: string, phone: string) {
  try {
    await query(
      `INSERT INTO camille.contacts (agent_id, phone, welcomed_at, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW(), NOW())
       ON CONFLICT (agent_id, phone) DO UPDATE
          SET welcomed_at = COALESCE(contacts.welcomed_at, NOW()), updated_at = NOW()`,
      [agentId, phone]
    );
  } catch (e) {
    console.error("[boutique] accueil non enregistré :", (e as Error).message);
  }
}

/**
 * L'accueil d'un nouveau venu : on lui demande s'il connaît le principe.
 *
 * Les deux réponses mènent à la boutique. C'est la règle qu'on s'est donnée —
 * aucun bouton ne doit laisser le client dans une impasse, et une question
 * dont une branche ne mène nulle part n'est pas une question, c'est un piège.
 */
async function accueillir(ctx: Contexte, resto: boolean) {
  const { agent, phone } = ctx;
  const profil = sectorProfile(agent.sector);
  await marquerAccueilli(agent.id, phone);
  const accueil = (profil.welcome || "Bonjour 👋").replace(/\{b\}/g, agent.business_name || "nous");

  await meta.sendButtons(
    phone,
    `${accueil}\n\nTu connais déjà le principe ? ${
      resto ? "Tu touches un plat, il va dans ton panier" : "Tu touches un article, il va dans ton panier"
    }, et tu m'envoies le panier 🛒`,
    [
      { id: B.rode, title: resto ? "Oui, la carte" : "Oui, la boutique" },
      { id: B.tuto, title: "Montre-moi" },
      { id: B.conseiller, title: "Un conseiller" },
    ],
    agent.business_name || undefined
  );
  await tracer(agent.id, phone, "assistant", "[accueil + mode d'emploi]");
}

/** La vidéo du mode d'emploi, puis la vitrine — on ne s'arrête pas sur la vidéo. */
async function envoyerTuto(ctx: Contexte, resto: boolean) {
  const { agent, phone } = ctx;
  const legende =
    "30 secondes et tu sais tout 👇\n\n" +
    `1️⃣ Je te montre ${resto ? "les plats" : "les articles"}\n` +
    "2️⃣ Tu touches *Ajouter au panier* sur ceux que tu veux\n" +
    "3️⃣ Tu m'envoies le panier — et c'est commandé 🛒";

  if (TUTO_URL === TUTO_DEMO) {
    console.warn("[boutique] TUTO_VIDEO_URL absente — vidéo de démonstration envoyée");
  }
  const r = await meta.sendVideoRapide(phone, TUTO_URL, legende);
  if (!r.ok) {
    // Meta n'a pas pu récupérer la vidéo : on tient quand même la promesse
    // qu'on vient de faire au client, en texte. Les trois étapes sont là.
    console.error("[boutique] vidéo du tuto refusée :", r.error);
    await meta.sendText(phone, legende);
  }
  await tracer(agent.id, phone, "assistant", "[mode d'emploi]");

  const prods = await catalogue(agent.id);
  return montrerVitrine(
    ctx, prods,
    resto ? "Notre carte" : "Notre boutique",
    resto ? "On commence ? Voilà notre carte 🍽️" : "On essaie ? Voilà ce qu'on a 🛍️"
  ,
  true
);
}

// ── Le panier, du catalogue à la commande ──────────────────────────────────
//
// Un panier reçu ne devient une commande qu'une fois COMPLET : mode de
// réception choisi, et adresse connue s'il faut livrer. Avant, la commande
// était créée tout de suite, sans adresse ni frais de livraison, et la position
// se greffait ensuite sur « la dernière commande » du client. Sur ordinateur,
// le bouton de position ne s'affiche pas : la commande restait sans adresse.
//
// Le panier attend donc dans camille.meta_paniers (migration_meta_paniers.sql).
// Sur une base sans cette table, on retombe sur l'ancien comportement plutôt
// que de perdre la commande.

type LignePanier = {
  productId?: string; name: string; variant?: string; qty: number; price: number; currency: string; image?: string;
};
type PanierEnAttente = {
  etape: "mode" | "adresse"; items: LignePanier[]; note: string; contactName: string;
};

/** Un panier n'attend pas indéfiniment : au-delà, il ne correspond plus à rien. */
const PANIER_TTL = "2 hours";

async function garderPanier(agentId: string, phone: string, p: PanierEnAttente): Promise<boolean> {
  try {
    await query(
      `INSERT INTO camille.meta_paniers (agent_id, phone, etape, items, note, contact_name, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())
       ON CONFLICT (agent_id, phone) DO UPDATE
         SET etape = EXCLUDED.etape, items = EXCLUDED.items, note = EXCLUDED.note,
             contact_name = EXCLUDED.contact_name, created_at = now()`,
      [agentId, phone, p.etape, JSON.stringify(p.items), p.note || null, p.contactName || null]
    );
    return true;
  } catch (e) {
    console.warn("[boutique] panier non mis en attente (migration_meta_paniers.sql ?) :", (e as Error).message);
    return false;
  }
}

async function lirePanier(agentId: string, phone: string): Promise<PanierEnAttente | null> {
  try {
    const r = await query(
      `SELECT etape, items, note, contact_name FROM camille.meta_paniers
        WHERE agent_id = $1 AND phone = $2 AND created_at > now() - interval '${PANIER_TTL}'`,
      [agentId, phone]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      etape: row.etape === "adresse" ? "adresse" : "mode",
      items: (row.items || []) as LignePanier[],
      note: row.note || "",
      contactName: row.contact_name || "",
    };
  } catch {
    return null; // table absente : aucun panier en attente
  }
}

async function etapePanier(agentId: string, phone: string, etape: "mode" | "adresse") {
  await query(
    "UPDATE camille.meta_paniers SET etape = $3 WHERE agent_id = $1 AND phone = $2",
    [agentId, phone, etape]
  ).catch(() => {});
}

async function oublierPanier(agentId: string, phone: string) {
  await query("DELETE FROM camille.meta_paniers WHERE agent_id = $1 AND phone = $2", [agentId, phone])
    .catch(() => {});
}

function recapPanier(items: LignePanier[], cur: string): { texte: string; total: number } {
  const total = items.reduce((t, l) => t + (l.price || 0) * (l.qty || 1), 0);
  return { texte: items.map((l) => `• ${l.qty} × ${l.name}${l.variant ? ` (${l.variant})` : ""}`).join("\n"), total };
}

/** Le panier natif reçu : on le met de côté et on demande comment le recevoir. */
async function recevoirPanier(ctx: Contexte) {
  const { agent, msg, phone } = ctx;
  const items = msg.order?.items || [];
  if (!items.length) return;

  const prods = await catalogue(agent.id);
  const parRetailer = new Map(prods.map((p) => [p.retailerId, p]));

  const lignes: LignePanier[] = items.map((it) => {
    // Une commande de VARIATION porte « <produit>:<option> ». C'est le PARENT
    // qui tient le stock : sans ce repli, une commande de variation ne
    // décompterait rien — le défaut d'origine, rouvert par une autre porte.
    const p =
      parRetailer.get(it.retailerId) ||
      parRetailer.get(produitParent(it.retailerId)) ||
      prods.find((x) => x.id === produitParent(it.retailerId));
    return {
      // Quand le produit vient de Camille, on passe son vrai identifiant :
      // c'est lui qui permet de décompter le stock.
      productId: p && p.id !== p.retailerId ? p.id : undefined,
      name: p?.name || it.retailerId,
      // La variation choisie (« Noir », « 42 »…) : sans elle, le commerçant
      // ne sait pas laquelle préparer.
      variant: libelleVariante(it.retailerId, p?.variants) || undefined,
      qty: Math.max(1, it.quantity),
      price: it.price || p?.price || 0,
      currency: it.currency || p?.currency || agent.currency || "XAF",
      // La photo du catalogue : c'est ce qui permet au vendeur de reconnaître
      // l'article d'un coup d'œil au moment de le préparer.
      image: p?.image_url || undefined,
    };
  });

  const panier: PanierEnAttente = {
    etape: "mode", items: lignes, note: msg.order?.note || "", contactName: msg.contactName || "",
  };

  // Il vient de commander : il sait commander. Lui proposer un tutoriel au
  // message suivant serait absurde.
  await marquerAccueilli(agent.id, phone);

  // Pas de livraison chez ce commerçant : rien à demander, c'est un retrait.
  if (!agent.delivery_enabled) return finaliserPanier(ctx, panier, { mode: "retrait" });

  // Base sans table d'attente : l'ancien parcours (commande puis position).
  if (!(await garderPanier(agent.id, phone, panier))) {
    await finaliserPanier(ctx, panier, { mode: "livraison" });
    return demanderPosition(ctx);
  }

  const cur = lignes[0]?.currency || "XAF";
  const { texte, total } = recapPanier(lignes, cur);
  const frais = agent.delivery_fee ? Number(agent.delivery_fee) : 0;
  // Des boutons de réponse, pas le bouton de position : ils s'affichent sur
  // téléphone ET sur ordinateur.
  const r = await meta.sendButtons(
    phone,
    `🛒 Ton panier\n\n${texte}\n\nSous-total : *${money(total, cur)}*` +
      (frais ? `\n_Livraison : ${money(frais, cur)}_` : "") +
      `\n\nComment veux-tu le recevoir ?`,
    [
      { id: B.livrer, title: "🛵 Me faire livrer" },
      { id: B.retirer, title: "🏪 Je passe retirer" },
    ]
  );
  if (!r.ok) {
    console.error("[boutique] boutons livraison/retrait refusés :", r.error);
    await meta.sendText(phone, "Écris *livrer* pour te faire livrer, ou *retirer* pour passer le chercher 🙂");
  }
  await tracer(agent.id, phone, "assistant", `[panier en attente] ${money(total, cur)}`);
}

/** Le panier devient une commande, avec tout ce qu'il faut pour la préparer. */
async function finaliserPanier(
  ctx: Contexte,
  panier: PanierEnAttente,
  opts: { mode: "livraison" | "retrait"; lat?: number; lng?: number; adresse?: string }
) {
  const { agent, phone } = ctx;
  const livraison = opts.mode === "livraison";
  const res = await createOrder({
    agentId: agent.id,
    items: panier.items,
    phone,
    customerName: panier.contactName,
    note: panier.note,
    source: "whatsapp",
    session: sessionMeta(agent.id),
    fulfillment: opts.mode,
    deliveryFee: livraison && agent.delivery_enabled ? Number(agent.delivery_fee) || 0 : 0,
    address: opts.adresse,
    lat: opts.lat,
    lng: opts.lng,
  });

  if ("ok" in res && res.ok === false) {
    // L'erreur technique va au journal, pas au client.
    console.error("[boutique] commande refusée :", res.error);
    await meta.sendText(
      phone,
      "Je n'ai pas pu enregistrer ta commande 🙏 Dis-moi *conseiller* et quelqu'un s'en occupe tout de suite."
    );
    return;
  }
  await oublierPanier(agent.id, phone);
  await envoyerAnimation(phone, "commande");

  const c = res as { ref?: string; subtotal?: number; deliveryFee?: number; total?: number; currency?: string };
  const cur = c.currency || panier.items[0]?.currency || "XAF";
  const { texte } = recapPanier(panier.items, cur);
  const lieu = livraison
    ? opts.lat != null && opts.lng != null
      ? "📍 Position reçue"
      : opts.adresse ? `📍 ${opts.adresse}` : ""
    : "🏪 Retrait en boutique";

  await meta.sendText(
    phone,
    `✅ C'est noté${c.ref ? ` — commande *${c.ref}*` : ""}\n\n${texte}\n\n` +
      (c.deliveryFee ? `Sous-total : ${money(Number(c.subtotal) || 0, cur)}\nLivraison : ${money(c.deliveryFee, cur)}\n` : "") +
      `Total : *${money(Number(c.total) || 0, cur)}*` +
      (lieu ? `\n${lieu}` : "") +
      (livraison ? "\n\nOn s'en occupe, tu es prévenu dès que ça part 🛵" : "\n\nOn te prépare ça 🙌")
  );
  await tracer(agent.id, phone, "assistant", `[commande] ${c.ref || ""} ${opts.mode} ${money(Number(c.total) || 0, cur)}`);

  if (!livraison) await montrerOuNousSommes(ctx);
}

/**
 * Où livrer ?
 *
 * Sur téléphone, le bouton natif donne des coordonnées GPS exactes en un appui.
 * Sur ordinateur (WhatsApp Web / Desktop), ce bouton NE S'AFFICHE PAS : on dit
 * donc aussi, en texte, qu'il suffit d'écrire son adresse. Les deux réponses
 * sont acceptées.
 */
async function demanderPosition(ctx: Contexte) {
  const { agent, phone } = ctx;
  // Un panier en attente passe à l'étape « adresse » : la prochaine position
  // ou adresse écrite le complétera. Sans panier, la requête ne touche rien.
  await etapePanier(agent.id, phone, "adresse");
  const r = await meta.sendLocationRequest(
    phone,
    "Où est-ce qu'on te livre ? 📍\n\n" +
      "Touche le bouton ci-dessous et j'ai le point exact.\n" +
      "_Tu préfères passer retirer ? Écris *retirer*._"
  );
  if (!r.ok) console.error("[boutique] demande de position native refusée :", r.error);
  await meta.sendText(
    phone,
    r.ok
      ? "💻 Sur ordinateur, le bouton n'apparaît pas : écris simplement ton *quartier et un repère* (ex. : Bonamoussadi, carrefour Kotto)."
      : "Où est-ce qu'on te livre ? 📍 Partage ta position, ou écris ton *quartier et un repère* (ex. : Bonamoussadi, carrefour Kotto)."
  );
  await tracer(agent.id, phone, "assistant", "[demande position]");
}

/** L'adresse du commerce, en texte et sur la carte. */
async function montrerOuNousSommes(ctx: Contexte) {
  const { agent, phone } = ctx;
  if (agent.location) await meta.sendText(phone, `📍 ${agent.location}`);
  if (agent.latitude != null && agent.longitude != null) {
    await meta.sendLocation(
      phone, Number(agent.latitude), Number(agent.longitude),
      agent.business_name || "", agent.location || ""
    );
  }
}

// ── De l'intention comprise à l'action exécutée ─────────────────────────────

/**
 * Ce qu'on sait de ce client.
 *
 * Les ACHATS viennent de `camille.orders` : des faits, il a payé. Les NOTES
 * viennent de `contacts.notes`, écrites par le modèle — donc des indices, pas
 * des faits. La distinction est tenue jusque dans l'ancrage : seuls les
 * montants réellement payés peuvent autoriser un nombre dans une réponse.
 *
 * Une base non migrée renvoie simplement une mémoire plus pauvre. Jamais une
 * erreur : un client sans mémoire doit être servi comme avant.
 */
async function lireMemoire(agentId: string, phone: string): Promise<Souvenir> {
  const vide: Souvenir = { achats: [], notes: [] };
  const [cmd, ctc] = await Promise.all([
    query(
      `SELECT created_at, items, total FROM camille.orders
        WHERE agent_id = $1
          AND regexp_replace(COALESCE(contact_phone,''), '[^0-9]', '', 'g') = $2
        ORDER BY created_at DESC LIMIT 5`,
      [agentId, phone]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT COALESCE(to_jsonb(c)->'notes', '[]'::jsonb) AS notes
         FROM camille.contacts c WHERE agent_id = $1 AND phone = $2 LIMIT 1`,
      [agentId, phone]
    ).catch(() => ({ rows: [] })),
  ]);

  vide.achats = (cmd.rows as Record<string, unknown>[]).map((r) => {
    const items = Array.isArray(r.items) ? r.items : [];
    return {
      quand: new Date(r.created_at as string).toISOString(),
      articles: items.map((i) => String((i as { name?: string }).name || "")).filter(Boolean),
      total: r.total != null ? Number(r.total) : null,
    };
  });
  const n = ctc.rows[0]?.notes;
  vide.notes = Array.isArray(n) ? n.map(String).slice(0, MAX_NOTES) : [];
  return vide;
}

/** Retenir un goût. L'absence de la colonne ne doit rien casser. */
async function retenirNotes(agentId: string, phone: string, anciennes: string[], neuves: string[]) {
  if (!neuves.length) return;
  const fusion = fusionnerNotes(anciennes, neuves);
  try {
    await query(
      `INSERT INTO camille.contacts (agent_id, phone, notes, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT (agent_id, phone)
       DO UPDATE SET notes = $3::jsonb, updated_at = NOW()`,
      [agentId, phone, JSON.stringify(fusion)]
    );
  } catch (e) {
    // 42703 : migration_memoire_client.sql pas appliquée. La conversation
    // continue, la mémoire des goûts est juste perdue d'une fois sur l'autre.
    console.error("[boutique] goûts non retenus :", (e as Error).message);
  }
}

/** Les derniers tours, pour que « et en bleu ? » veuille dire quelque chose. */
async function derniersTours(agentId: string, phone: string) {
  try {
    const r = await query(
      `SELECT role, content FROM camille.agent_conversations
        WHERE session_name = $1 AND contact_phone = $2
        ORDER BY created_at DESC LIMIT 6`,
      [sessionMeta(agentId), phone]
    );
    return (r.rows as { role: string; content: string }[]).reverse();
  } catch {
    return [];
  }
}

/**
 * Exécuter ce que le client veut — plusieurs choses s'il en veut plusieurs.
 *
 * C'est la moitié « le code exécute » de CVA. Le modèle a dit CE QU'IL VEUT ;
 * le choix du composant Meta, lui, reste ici et reste déterministe : une fiche
 * pour un produit, un carrousel de 2 à 10, une liste au-delà. Le modèle n'a
 * jamais eu à en décider, donc il ne peut pas se tromper là-dessus.
 *
 * Les actions purement textuelles passent d'abord : répondre à la question
 * avant de montrer les articles, c'est l'ordre dans lequel un vendeur parle.
 */
async function executer(
  ctx: Contexte, actions: Action[], prods: Produit[], resto: boolean, nouveau: boolean,
  souvenir: Souvenir = { achats: [], notes: [] }
): Promise<void> {
  const { agent, phone } = ctx;
  const parId = new Map(prods.map((p) => [p.id, p]));
  // L'ORDRE COMPTE, et il a été faux. `mode_emploi` était exécuté en dernier :
  // à « comment commander ? », le client recevait une phrase générique, puis
  // le carrousel, PUIS la vidéo — et le carrousel une seconde fois, puisque
  // `envoyerTuto` finit déjà sur la vitrine. Trois messages pour une question,
  // dans le mauvais ordre, avec un doublon.
  //
  // `mode_emploi` répond à la question : il passe donc devant, et il ABSORBE
  // tout ce qui montre des articles — la vidéo explique et enchaîne elle-même
  // sur la vitrine. Ce qui alerte l'équipe, lui, n'est jamais absorbé.
  const ordre = { mode_emploi: 0, repondre: 1, infos: 2, montrer: 3, vitrine: 4 } as Record<string, number>;
  const triees = [...actions].sort((a, b) => (ordre[a.faire] ?? 5) - (ordre[b.faire] ?? 5));
  const ABSORBEES = new Set(["repondre", "montrer", "vitrine", "accueil"]);
  const tuto = triees.some((a) => a.faire === "mode_emploi");

  // Une seule vitrine, une seule prise de main : le modèle peut répéter une
  // intention, le client ne doit pas recevoir deux fois la même chose.
  const faits = new Set<string>();

  for (const a of triees) {
    if (tuto && ABSORBEES.has(a.faire)) continue;
    if (a.faire !== "repondre" && faits.has(a.faire)) continue;
    faits.add(a.faire);

    switch (a.faire) {
      case "repondre":
        await meta.sendText(phone, a.texte);
        await tracer(agent.id, phone, "assistant", a.texte);
        break;

      case "montrer": {
        // La couleur se lit d'abord dans le message du client, sinon dans la
        // réponse du modèle (« oui, il existe en rouge ») qui l'accompagne.
        const dits = actions.filter((x) => x.faire === "repondre").map((x) => (x as { texte: string }).texte);
        const choisis = preciserVariantes(
          a.produits.map((id) => parId.get(id)).filter(Boolean) as Produit[],
          ctx.msg.text || "", ...dits
        );
        if (!choisis.length) break;
        await montrerVitrine(
          ctx, choisis,
          choisis.length > 1 ? (resto ? "Notre carte" : "Nos articles") : "",
          choisis.length > 1 ? "Voilà ce qui correspond 👇" : ""
        );
        break;
      }

      case "vitrine":
        // Si on vient de montrer des articles précis, enchaîner avec tout le
        // catalogue annule le travail de ciblage. Le modèle demande parfois
        // les deux ; on n'en fait qu'un.
        if (faits.has("montrer")) break;
        await montrerVitrine(
          ctx, prods,
          resto ? "Notre carte" : "Notre boutique",
          resto ? "Voici ce qu'on propose 🍽️" : "Voici ce qu'on a en ce moment 🛍️"
        ,
        true
      );
        break;

      case "mode_emploi": await envoyerTuto(ctx, resto); break;
      case "infos":       await donnerInfos(ctx); break;
      case "humain":      await passerLaMain(ctx); break;
      case "alerter":     await alerterSansSeTaire(ctx, a.sujet); break;
      case "retrait":
        await meta.sendText(phone, "C'est noté, on te garde ça 👌");
        await montrerOuNousSommes(ctx);
        break;

      case "position":
        // Il veut donner son adresse : le composant natif, pas une explication.
        if (agent.delivery_enabled) await demanderPosition(ctx);
        else {
          await meta.sendText(phone, "On ne livre pas, mais tu peux passer récupérer ta commande 🙌");
          await montrerOuNousSommes(ctx);
        }
        break;

      case "accueil":
        if (nouveau) await accueillir(ctx, resto);
        else await revoir(ctx, resto, souvenir);
        break;

      default: {
        // Garde-fou de compilation : une action déclarée dans `Action` mais
        // oubliée ici ne compilerait pas. Sans ça, un jour, le modèle
        // renverrait une intention valide et le client ne recevrait RIEN —
        // la seule faute vraiment impardonnable.
        const jamais: never = a;
        void jamais;
      }
    }
  }

  // Le scénario du nouveau venu passe APRÈS son résultat, et une seule fois
  // dans sa vie. C'est le bon ordre : il a demandé un prix, il reçoit le prix,
  // et ensuite seulement on lui montre comment la commande fonctionne. On ne
  // le refait pas si l'accueil complet vient d'être joué, ni s'il a demandé un
  // humain — coller un tutoriel sur une réclamation serait indécent.
  if (nouveau && !faits.has("accueil") && !faits.has("mode_emploi") && !faits.has("humain")) {
    await orienterNouveau(ctx, resto);
  }
}

/**
 * Retrouver un habitué.
 *
 * Toute la mémoire se joue ici, en UN bouton. « Comme la dernière fois »
 * renvoie exactement ce qu'il avait acheté — c'est le geste du vendeur du
 * quartier, et c'est utile.
 *
 * Ce qu'on ne fait PAS, volontairement : lui réciter son historique. « Je vois
 * que tu as commandé une Watch 6 il y a trois jours » met mal à l'aise et
 * n'aide à rien. La mémoire se montre par ce qu'elle PERMET, pas par ce
 * qu'elle sait.
 *
 * Le bouton n'apparaît que si l'article est encore au catalogue : proposer de
 * racheter un article disparu serait pire que de ne rien proposer.
 */
async function revoir(ctx: Contexte, resto: boolean, souvenir: Souvenir) {
  const { agent, phone } = ctx;
  const profil = sectorProfile(agent.sector);
  const accueil = (profil.welcome || "Bonjour 👋").replace(/\{b\}/g, agent.business_name || "nous");

  const dejaVu = await repasser(agent.id, souvenir);
  await meta.sendButtons(
    phone,
    accueil,
    [
      ...(dejaVu.length ? [{ id: B.encore, title: resto ? "Comme d'habitude" : "Comme la dernière fois" }] : []),
      { id: B.catalogue, title: resto ? "Voir la carte" : "Voir la boutique" },
      ...(dejaVu.length ? [] : [{ id: B.infos, title: "Infos & horaires" }]),
      { id: B.conseiller, title: "Un conseiller" },
    ],
    agent.business_name || undefined
  );
  await tracer(agent.id, phone, "assistant", dejaVu.length ? "[retour client]" : "[accueil]");
}

/** Ce qu'il avait acheté, et qui est encore vendable aujourd'hui. */
async function repasser(agentId: string, souvenir: Souvenir): Promise<Produit[]> {
  const noms = new Set(
    souvenir.achats.flatMap((a) => a.articles).map((n) => sansAccent(n)).filter(Boolean)
  );
  if (!noms.size) return [];
  const prods = await catalogue(agentId);
  return prods.filter((p) => noms.has(sansAccent(p.name))).slice(0, 10);
}

/** L'orientation du nouveau venu, greffée après sa vraie réponse. */
async function orienterNouveau(ctx: Contexte, resto: boolean) {
  const { agent, phone } = ctx;
  await marquerAccueilli(agent.id, phone);
  await meta.sendButtons(
    phone,
    `C'est ta première fois ici 👋 Je te montre comment commander en 30 secondes ?\n\n` +
      `_${resto ? "Tu touches un plat" : "Tu touches un article"}, il va dans ton panier, et tu m'envoies le panier._`,
    [
      { id: B.tuto, title: "Montre-moi" },
      { id: B.ok, title: "Ça va, merci" },
      { id: B.conseiller, title: "Un conseiller" },
    ],
    agent.business_name || undefined
  );
  await tracer(agent.id, phone, "assistant", "[orientation nouveau]");
}

/** Les faits du commerce, tels que le modèle est autorisé à les citer. */
function faitsDe(agent: Contexte["agent"]): FaitsCommerce {
  return {
    nom: agent.business_name || "la boutique",
    adresse: agent.location,
    horaires: agent.business_hours,
    fraisLivraison: agent.delivery_fee != null ? Number(agent.delivery_fee) : null,
    livraison: Boolean(agent.delivery_enabled),
    devise: agent.currency || "XAF",
  };
}

// ── La réponse ──────────────────────────────────────────────────────────────

export async function repondreBoutique(
  ctx: Contexte,
  mode: "boutique" | "restaurant"
): Promise<void> {
  const { agent, msg, phone } = ctx;
  const profil = sectorProfile(agent.sector);
  const resto = mode === "restaurant";

  // 1. Un panier natif : c'est une commande, pas une phrase à comprendre.
  if (msg.type === "order") return recevoirPanier(ctx);

  // Un panier attend-il son mode de réception ou son adresse ?
  const enAttente = await lirePanier(agent.id, phone);

  // 2. Une position partagée : elle complète le panier en attente, sinon la
  //    dernière commande (commandes passées avant ce parcours).
  if (msg.type === "location" && msg.location) {
    if (enAttente) {
      return finaliserPanier(ctx, enAttente, {
        mode: "livraison", lat: msg.location.lat, lng: msg.location.lng,
      });
    }
    let ref = "";
    try {
      const r = await query(
        `UPDATE camille.orders SET lat = $1, lng = $2, updated_at = NOW()
          WHERE id = (SELECT id FROM camille.orders
                       WHERE agent_id = $3
                         AND regexp_replace(COALESCE(contact_phone,''), '[^0-9]', '', 'g') = $4
                         -- une position ne complète qu'une commande RÉCENTE :
                         -- jamais celle d'il y a trois semaines.
                         AND created_at > now() - interval '6 hours'
                       ORDER BY created_at DESC LIMIT 1)
          RETURNING COALESCE(to_jsonb(orders)->>'ref', '') AS ref`,
        [msg.location.lat, msg.location.lng, agent.id, phone]
      );
      // Aucune commande à rattacher : le client a partagé sa position sans
      // avoir commandé. On ne fait pas semblant de l'avoir enregistrée.
      if (!r.rows.length) {
        await meta.sendText(
          phone,
          "Merci 📍 Je garde ça de côté. Compose ton panier et envoie-le, je rattache l'adresse à ta commande 🛒"
        );
        return;
      }
      ref = String(r.rows[0]?.ref || "");
    } catch (e) {
      console.error("[boutique] position non enregistrée :", (e as Error).message);
    }
    const frais =
      agent.delivery_enabled && agent.delivery_fee
        ? `\nLivraison : *${money(Number(agent.delivery_fee), agent.currency || "XAF")}*`
        : "";
    await meta.sendText(
      phone,
      `Position reçue 📍${ref ? `\nCommande *${ref}*` : ""}${frais}\n\nOn s'en occupe, tu es prévenu dès que ça part 🛵`
    );
    await tracer(agent.id, phone, "assistant", `[position] ${ref}`);
    return;
  }

  // 3. Un choix fait sur un bouton ou une liste : aucune ambiguïté possible.
  if (msg.type === "interactive" && msg.choiceId) {
    const id = msg.choiceId;

    // Un bouton de suivi de commande : la donnée demandée, et elle seule.
    const suivi = lireIdSuivi(id);
    if (suivi) return repondreSuivi(ctx, suivi.action, suivi.ref, resto);

    if (id === B.catalogue) {
      const prods = await catalogue(agent.id);
      return montrerVitrine(
        ctx, prods,
        resto ? "Notre carte" : "Notre boutique",
        resto ? "Voici ce qu'on propose 🍽️" : "Voici ce qu'on a en ce moment 🛍️"
      ,
      true
    );
    }
    if (id === B.conseiller) return passerLaMain(ctx);
    if (id === B.tuto) return envoyerTuto(ctx, resto);
    if (id === B.rode) {
      const prods = await catalogue(agent.id);
      return montrerVitrine(
        ctx, prods,
        resto ? "Notre carte" : "Notre boutique",
        resto ? "Parfait, voilà notre carte 🍽️" : "Parfait, voilà ce qu'on a 🛍️"
      ,
      true
    );
    }
    // « Ça va, merci » : il a déjà sa réponse sous les yeux. Lui renvoyer le
    // catalogue ferait DEUX carrousels identiques à la suite — c'est ce qui
    // s'est produit en production, et ça donne l'impression d'un bug.
    if (id === B.ok) {
      await meta.sendText(
        phone,
        resto
          ? "Parfait 👌 Touche un plat pour l'ajouter à ton panier, puis envoie-moi le panier 🛒"
          : "Parfait 👌 Touche un article pour l'ajouter à ton panier, puis envoie-moi le panier 🛒"
      );
      return;
    }
    if (id === B.encore) {
      const dejaVu = await repasser(agent.id, await lireMemoire(agent.id, phone));
      if (!dejaVu.length) {
        // L'article n'est plus au catalogue : on le dit, et on montre la suite.
        const prods = await catalogue(agent.id);
        return montrerVitrine(
          ctx, prods,
          resto ? "Notre carte" : "Notre boutique",
          "Ce que tu avais pris n'est plus dispo 😕 Voilà ce qu'on a en ce moment 🛍️"
        ,
        true
      );
      }
      return montrerVitrine(ctx, dejaVu, "", "Voilà ce que tu avais pris 👇");
    }
    if (id === B.livrer) return demanderPosition(ctx);
    if (id === B.retirer) {
      if (enAttente) return finaliserPanier(ctx, enAttente, { mode: "retrait" });
      await meta.sendText(phone, "C'est noté, on te garde ça 👌");
      await montrerOuNousSommes(ctx);
      return;
    }
    if (id === B.infos) return donnerInfos(ctx);

    // Un identifiant qui n'est pas des nôtres vient du catalogue : le client a
    // touché un produit. On lui montre la fiche.
    const prods = await catalogue(agent.id);
    const p = prods.find((x) => x.retailerId === id);
    if (p) return montrerVitrine(ctx, [p], "", "");
  }

  const t = sansAccent(msg.text);

  // 3 bis. Un panier attend : les réponses courtes à « livraison ou retrait ? »
  // et l'adresse écrite (le seul moyen sur ordinateur) passent AVANT la
  // compréhension — une adresse n'est pas une question à interpréter.
  if (enAttente && msg.text.trim()) {
    if (/conseiller|humain|quelqu un|une personne|parler a|responsable|patron|gerant/.test(t)) {
      return passerLaMain(ctx);
    }
    if (/\bannule|\bannuler|laisse tomber|je ne veux plus|j en veux plus/.test(t)) {
      await oublierPanier(agent.id, phone);
      await meta.sendText(phone, "D'accord, j'ai annulé ce panier 👍 Je reste là si tu changes d'avis.");
      return;
    }
    if (/^(retirer|retrait|je viens|je passe|sur place|a emporter|take away)\b/.test(t)) {
      return finaliserPanier(ctx, enAttente, { mode: "retrait" });
    }
    if (/^(livrer|livraison|me faire livrer|livre moi|faites moi livrer)\b/.test(t)) {
      return demanderPosition(ctx);
    }
    if (enAttente.etape === "adresse" && msg.text.trim().length >= 4) {
      return finaliserPanier(ctx, enAttente, {
        mode: "livraison", adresse: msg.text.trim().replace(/\s+/g, " ").slice(0, 200),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. LA COMPRÉHENSION. C'est la voie normale, pas une option.
  //
  // Le modèle lit la phrase et dit ce que le client veut — y compris plusieurs
  // choses à la fois. Tout ce qui suit (5 à 11) n'est que le repli : utile le
  // jour où la clé manque ou où le modèle ne répond pas, et c'est tout.
  //
  // Le seuil de certitude n'est pas un gadget. Sous 0,55, une réponse
  // déterministe un peu sèche vaut mieux qu'une réponse confiante à côté.
  // ─────────────────────────────────────────────────────────────────────────
  if (msg.text.trim() && comprehensionDisponible()) {
    const [prods, nouveau, souvenir] = await Promise.all([
      catalogue(agent.id), estNouveau(agent.id, phone), lireMemoire(agent.id, phone),
    ]);
    const c = await comprendre(
      msg.text,
      prods.map((p) => ({
        id: p.id, name: p.name, price: p.price,
        currency: p.currency, category: p.category, stock: p.stock,
        options: p.optionsTexte || null,
      })),
      faitsDe(agent),
      resto,
      await derniersTours(agent.id, phone),
      { resume: resumeMemoire(souvenir), ancres: faitsDesAchats(souvenir) }
    );
    if (c && c.certitude >= 0.55) {
      await tracer(
        agent.id, phone, "system",
        `[compris ${c.certitude.toFixed(2)}] ${c.actions.map((a) => a.faire).join("+")} — ${c.raisonnement}`
      );
      // Les goûts appris dans ce message, pour la prochaine conversation.
      // En arrière-plan : le client n'a pas à attendre une écriture en base.
      retenirNotes(agent.id, phone, souvenir.notes, c.notes).catch(() => {});
      return executer(ctx, c.actions, prods, resto, nouveau, souvenir);
    }
    if (c) {
      console.log(`[boutique] certitude ${c.certitude} trop basse — repli déterministe`);
    }
  }

  // 5. Demande d'un humain — toujours en premier parmi les phrases libres.
  if (/conseiller|humain|quelqu un|une personne|parler a|responsable|patron|gerant/.test(t)) {
    return passerLaMain(ctx);
  }

  // 6. Le mode d'emploi, demandé en clair.
  if (/comment (ca|ce) (marche|fonctionne)|comment (je )?(fais|commande)|\btuto\b|tutoriel|je comprends pas|c est comment/.test(t)) {
    return envoyerTuto(ctx, resto);
  }

  // 7. Le retrait sur place — c'est le mot qu'on propose dans la demande de
  // position, donc il doit marcher écrit à la main.
  if (/^(retirer|retrait|je viens|je passe|sur place|a emporter|take away)\b/.test(t)) {
    await meta.sendText(phone, "C'est noté, on te garde ça 👌");
    await montrerOuNousSommes(ctx);
    return;
  }

  // 8. Infos boutique.
  if (/ou (etes|est)|adresse|vous etes ou|horaire|ouvert|ferme|localisation|c est ou/.test(t)) {
    return donnerInfos(ctx);
  }

  // 9. Le catalogue, demandé de mille façons.
  if (veutToutVoir(msg.text, resto)) {
    const prods = await catalogue(agent.id);
    return montrerVitrine(
      ctx, prods,
      resto ? "Notre carte" : "Notre boutique",
      resto ? "Voici ce qu'on propose 🍽️" : "Voici ce qu'on a en ce moment 🛍️"
    ,
    true
  );
  }

  // 10. Une recherche nommée : « la montre oraimo », « les freepods ».
  if (t.length >= 3) {
    const prods = await catalogue(agent.id);
    const trouves = chercher(prods, t);
    if (trouves.length) {
      return montrerVitrine(
        ctx, trouves,
        trouves.length > 1 ? "Ce que j'ai trouvé" : "",
        trouves.length > 1 ? "Voilà ce qui correspond 👇" : ""
      );
    }
    // Une QUESTION sans réponse ne mérite pas des produits. Observé : « vous
    // avez un service après-vente ? » recevait le carrousel et « je n'ai pas
    // trouvé exactement ça ». Montrer des montres à qui demande une garantie,
    // c'est avouer qu'on n'a pas lu. On transmet à quelqu'un qui sait — sans
    // se taire, pour que le client puisse continuer à acheter.
    if (estUneQuestion(msg.text)) {
      await alerterSansSeTaire(ctx, msg.text.slice(0, 120));
      await meta.sendButtons(
        phone,
        "Bonne question 🙏 Je transmets à l'équipe, elle te répond ici même.\n\n" +
          "En attendant, je reste dispo pour te montrer ce qu'on a 👇",
        [
          { id: B.catalogue, title: resto ? "Voir la carte" : "Voir la boutique" },
          { id: B.conseiller, title: "Un conseiller" },
        ],
        agent.business_name || undefined
      );
      return;
    }

    // Rien trouvé, mais le client parle visiblement d'achat : on montre ce
    // qu'on a. Répondre « je n'ai pas trouvé » à un acheteur en main, avec un
    // catalogue plein, c'est perdre la vente pour un mot mal orthographié.
    if (prods.length && !/^(merci|ok|okay|okey|dac|daccord|bien|super|a plus|bye|au revoir|oui|non)\b/.test(t)) {
      return montrerVitrine(
        ctx, prods,
        resto ? "Notre carte" : "Notre boutique",
        resto
          ? "Je n'ai pas trouvé ça 🤔 Voilà ce qu'on propose 🍽️"
          : "Je n'ai pas trouvé exactement ça 🤔 Voilà ce qu'on a en ce moment 🛍️"
      ,
      true
    );
    }
  }

  // 11. Accueil et repli — tous deux mènent quelque part, jamais à un
  //     cul-de-sac. Et c'est ici, et nulle part ailleurs, que le mode d'emploi
  //     est proposé : une seule fois, au premier message de ce client.
  if (await estNouveau(agent.id, phone)) return accueillir(ctx, resto);

  const salut = /^(bonjour|bonsoir|salut|slt|hello|hey|coucou|bjr|cc|yo|allo|on dit quoi)/.test(t);
  const accueil = (profil.welcome || "Bonjour 👋").replace(/\{b\}/g, agent.business_name || "nous");

  await meta.sendButtons(
    phone,
    salut || !t
      ? accueil
      : `Je n'ai pas bien compris 🤔 Dis-moi ce que tu cherches, ou ${resto ? "regarde la carte" : "regarde la boutique"} 👇`,
    [
      { id: B.catalogue, title: resto ? "Voir la carte" : "Voir la boutique" },
      { id: B.infos, title: "Infos & horaires" },
      { id: B.conseiller, title: "Un conseiller" },
    ],
    agent.business_name || undefined
  );
  await tracer(agent.id, phone, "assistant", salut ? "[accueil]" : "[repli]");
}

// ── Deux réponses partagées ─────────────────────────────────────────────────

async function donnerInfos(ctx: Contexte) {
  const { agent, phone } = ctx;
  const bouts = [
    agent.business_name ? `*${agent.business_name}*` : "",
    agent.location ? `📍 ${agent.location}` : "",
    agent.business_hours ? `🕒 ${agent.business_hours}` : "",
    agent.website_url ? `🔗 ${agent.website_url}` : "",
  ].filter(Boolean);
  await meta.sendText(phone, bouts.length ? bouts.join("\n") : "Écris-moi ce que tu cherches, je te renseigne 🙂");
  if (agent.latitude != null && agent.longitude != null) {
    await meta.sendLocation(
      phone, Number(agent.latitude), Number(agent.longitude),
      agent.business_name || "", agent.location || ""
    );
  }
}

/**
 * Prévenir le commerçant — SANS faire taire Camille.
 *
 * L'outil qui manquait, et son absence a coûté deux clients. `passerLaMain`
 * met `human_takeover` à vrai : ce client ne reçoit plus AUCUNE réponse
 * automatique, même s'il demande autre chose. C'est juste pour une
 * réclamation. Ça ne l'est pas du tout pour « en combien de temps vous
 * livrez ? » — observé en production : le client a eu son prix, puis « je
 * passe le relais à l'équipe », et Camille s'est tue pour la suite.
 *
 * Ici, on crée la tâche pour le commerçant et on continue de servir. C'est ce
 * qui rend une promesse tenable sans sacrifier la conversation : quelqu'un est
 * réellement averti, et le client peut encore acheter.
 */
async function alerterSansSeTaire(ctx: Contexte, sujet: string) {
  const { agent, msg, phone } = ctx;
  try {
    await query(
      `INSERT INTO camille.owner_tasks (agent_id, phone, type, title, content)
       VALUES ($1, $2, 'complaint', $3, $4::jsonb)`,
      [
        agent.id, phone,
        `À confirmer : ${sujet} — ${phone}`,
        JSON.stringify({ kind: "a_confirmer", sujet, message: msg.text || "", contact: phone }),
      ]
    );
  } catch (e) {
    // La tâche n'a pas été créée : alors la promesse n'est PAS tenable, et il
    // vaut mieux passer vraiment la main que laisser le client attendre.
    console.error("[boutique] alerte non enregistrée :", (e as Error).message);
    return passerLaMain(ctx);
  }
  await tracer(agent.id, phone, "assistant", `[alerte] ${sujet}`);
}

/**
 * Passer la main à un humain.
 *
 * Surtout pas de lien wa.me vers le numéro de l'agent : c'est celui où le
 * client écrit déjà. On l'y renvoyait vers lui-même — le bug avait été signalé
 * en production. Le client est au bon endroit ; c'est l'humain qui vient à lui.
 */
async function passerLaMain(
  ctx: Contexte,
  /** Pour un souci sur une commande : le titre et le contenu de la tâche du commerçant. */
  dossier?: { titre: string; contenu: Record<string, unknown>; message?: string }
) {
  const { agent, msg, phone } = ctx;

  try {
    await query(
      `INSERT INTO camille.owner_tasks (agent_id, phone, type, title, content)
       VALUES ($1, $2, 'complaint', $3, $4::jsonb)`,
      [
        agent.id, phone,
        dossier?.titre || `Demande à parler à quelqu'un — ${phone}`,
        JSON.stringify(
          dossier?.contenu || { kind: "talk_to_human", message: msg.text || "(sans message)", contact: phone }
        ),
      ]
    );
    await query(
      `INSERT INTO camille.contacts (agent_id, phone, human_takeover, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       ON CONFLICT (agent_id, phone) DO UPDATE SET human_takeover = true, updated_at = NOW()`,
      [agent.id, phone]
    );
  } catch (e) {
    console.error("[boutique] passage de main incomplet :", (e as Error).message);
  }

  await meta.sendText(
    phone,
    dossier?.message ||
      "Bien sûr 🙏 Je passe le relais à l'équipe.\n\n" +
        "Un conseiller prend la suite **dans cette conversation** — reste ici, tu n'as rien à faire 🙌"
  );
  await tracer(agent.id, phone, "assistant", "[relais humain]");
}

// ── Le suivi de commande : la réponse à un bouton « cmd:<action>:<ref> » ────

/**
 * Le client a touché un bouton de suivi. On ne répond qu'avec ce qu'il a
 * demandé, et seulement sur SA commande : la référence vient d'un bouton, qui
 * se recopie — chargerCommande vérifie que le numéro est bien le sien.
 */
async function repondreSuivi(ctx: Contexte, action: ActionSuivi, ref: string, resto: boolean) {
  const { agent, phone } = ctx;
  const o = await chargerCommande({ agentId: agent.id, ref, phone });
  if (!o) {
    await meta.sendText(phone, "Je ne retrouve pas cette commande 🤔 Dis-moi *conseiller* et quelqu'un vérifie pour toi.");
    return;
  }
  await tracer(agent.id, phone, "user", `[suivi] ${action} ${ref}`);

  switch (action) {
    case "recap": {
      await meta.sendText(phone, recapCommande(o));
      // Le bon de commande, s'il existe : c'est lui qui fait foi.
      if (o.doc_url) {
        await meta.sendDocument(phone, o.doc_url, `${o.doc_number || `BC-${o.ref}`}.pdf`, "📄 Ton bon de commande");
      }
      return;
    }

    case "etapes":
      await meta.sendText(phone, etapesCommande(o));
      return;

    case "livreur": {
      if (!o.courier_name && !o.courier_phone) {
        await meta.sendText(phone, `${etapesCommande(o)}\n\nLe livreur n'est pas encore désigné, je te préviens dès qu'il part 🛵`);
        return;
      }
      // Sa position, seulement si elle est fraîche : une position d'il y a une
      // heure rassure à tort.
      const vu = o.courier_seen_at ? Date.now() - new Date(o.courier_seen_at).getTime() : Infinity;
      const recente = o.courier_lat != null && o.courier_lng != null && vu < 15 * 60_000;
      await meta.sendText(
        phone,
        `🛵 Ton livreur : *${o.courier_name || "notre livreur"}*` +
          (o.courier_phone ? `\n📞 ${o.courier_phone}` : "") +
          (recente ? "\n\nSa position il y a quelques minutes 👇" : "")
      );
      if (recente) {
        await meta.sendLocation(phone, Number(o.courier_lat), Number(o.courier_lng), "Ton livreur", `Commande ${o.ref}`);
      }
      return;
    }

    case "aide":
      await meta.sendButtons(
        phone,
        `Pose ta question sur la commande *${o.ref}* ici, je te réponds tout de suite 🙂`,
        [{ id: B.conseiller, title: "Parler à quelqu'un" }]
      );
      return;

    case "parfait":
      await meta.sendText(
        phone,
        "Ça fait vraiment plaisir 😊🙏\n\nSi tu as un moment, parle de nous autour de toi — c'est ce qui nous aide le plus. À très vite !"
      );
      notify(agent.id, "order.feedback", { ref: o.ref, avis: "positif", customer_phone: phone }).catch(() => {});
      return;

    case "souci":
      notify(agent.id, "order.feedback", { ref: o.ref, avis: "souci", customer_phone: phone }).catch(() => {});
      return passerLaMain(ctx, {
        titre: `Souci sur la commande ${o.ref} — ${phone}`,
        contenu: { kind: "order_issue", ref: o.ref, contact: phone, status: o.status },
        message:
          `Désolé pour ça 😔 L'équipe est prévenue pour la commande *${o.ref}* et te répond ici.\n\n` +
          "Dis-moi ce qui ne va pas — une photo aide beaucoup si c'est un article abîmé ou différent.",
      });

    case "encore": {
      // Les mêmes articles, dans la même variante quand elle existe encore.
      const prods = await catalogue(agent.id);
      const repris = (o.items || []).flatMap((it) => {
        const nom = sansAccent(String(it.name || "")).trim();
        const p = prods.find((x) => sansAccent(x.name.split(" — ")[0]).trim() === nom.split(" — ")[0]);
        return p ? preciserVariantes([p], String(it.variant || "")) : [];
      });
      if (!repris.length) {
        return montrerVitrine(
          ctx, prods, resto ? "Notre carte" : "Notre boutique",
          "Ce que tu avais pris n'est plus dispo 😕 Voilà ce qu'on a en ce moment 🛍️", true
        );
      }
      return montrerVitrine(ctx, repris, "", "Voilà ta dernière commande, ajoute-la au panier 👇");
    }

    case "boutique": {
      const prods = await catalogue(agent.id);
      return montrerVitrine(
        ctx, prods, resto ? "Notre carte" : "Notre boutique",
        resto ? "Voici ce qu'on propose 🍽️" : "Voici ce qu'on a en ce moment 🛍️", true
      );
    }

    case "adresse":
      return montrerOuNousSommes(ctx);
  }
}
