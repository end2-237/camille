// ─────────────────────────────────────────────────────────────────────────────
// Le brief du site d'un commerçant, préparé à partir de ce que Camille sait
// déjà de lui. C'est l'entrée de /dip-create : l'apparence et l'histoire sont
// créées avec DIP, les données (catalogue, prix, stock, horaires, zones) sont
// lues EN DIRECT par l'API publique de Camille — le site se met à jour seul.
// ─────────────────────────────────────────────────────────────────────────────
import { query } from "@/lib/db";

export async function composerBrief(agentId: string, envies = "", domaine = ""): Promise<string> {
  const a = (await query(`SELECT * FROM camille.agents WHERE id = $1`, [agentId])).rows[0] || {};
  const rayons = await query(
    `SELECT COALESCE(NULLIF(category, ''), 'Divers') AS rayon, COUNT(*)::int AS n,
            MIN(price)::float AS min, MAX(price)::float AS max
       FROM camille.products WHERE agent_id = $1 AND COALESCE(active, true)
      GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    [agentId]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const vedettes = await query(
    `SELECT name, price, image_url FROM camille.products
      WHERE agent_id = $1 AND COALESCE(active, true) AND image_url IS NOT NULL
      ORDER BY sort_order ASC, created_at DESC LIMIT 8`,
    [agentId]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

  const parse = (v: unknown) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return null; } };
  const doc = (parse(a.doc_settings) || {}) as Record<string, string>;
  const zones = (parse(a.delivery_zones) || []) as { zone?: string; name?: string; fee?: number }[];
  const fcfa = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} FCFA`;

  return [
    `# Site de ${a.business_name || a.name || "ce commerce"}`,
    "",
    "## Le commerce",
    `- Activité : ${a.sector || "—"}`,
    `- Description : ${a.description || "—"}`,
    `- Adresse : ${a.location || "—"}${a.latitude != null ? ` (GPS ${a.latitude}, ${a.longitude})` : ""}`,
    `- Horaires : ${a.business_hours || "—"}`,
    `- WhatsApp : ${a.whatsapp_number || a.meta_display_phone || "—"}`,
    `- Site actuel : ${a.website_url || "aucun"}`,
    "",
    "## Identité",
    `- Logo : ${doc.logo_url || "à fournir"}`,
    `- Couleur : ${doc.color || doc.accent || "à choisir avec DIP"}`,
    `- Ton : ${a.brand_voice || "chaleureux, local"}`,
    "",
    "## Catalogue (lu en direct)",
    ...rayons.rows.map((r) => `- ${r.rayon} : ${r.n} article(s), ${fcfa(r.min)} à ${fcfa(r.max)}`),
    "",
    "Articles phares :",
    ...vedettes.rows.map((p) => `- ${p.name} — ${fcfa(p.price)} — ${p.image_url}`),
    "",
    "## Livraison",
    `- ${a.delivery_enabled === false ? "Pas de frais de livraison" : `Frais par défaut : ${fcfa(a.delivery_fee)}`}`,
    ...zones.map((z) => `- ${z.zone || z.name} : ${fcfa(z.fee)}`),
    a.delivery_delay ? `- Délai annoncé : ${a.delivery_delay}` : "",
    a.min_order ? `- Commande minimum : ${fcfa(a.min_order)}` : "",
    "",
    "## Ce que le commerçant souhaite",
    envies || "—",
    domaine ? `\nDomaine souhaité : ${domaine}` : "",
    "",
    "## Contraintes techniques",
    "- Données en direct : GET /api/public/v1/catalog (clé publique de l'agent, page Intégrations).",
    "- Commandes : POST /api/public/v1/orders — elles arrivent dans le même tableau de bord que WhatsApp.",
    "- Bouton WhatsApp sur chaque produit ; pages légères, rapides en 3G/4G (variante « commerce » de DIP).",
    "- Sous-domaine <commerce>.buyticle.com d'abord, domaine propre ensuite.",
    "- Validation humaine avant publication (/dip-review).",
  ].filter((l) => l !== "").join("\n");
}
