// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/catalog-sync?agentId=…
//
// Pousse le catalogue Camille vers le catalogue Meta, et enregistre la
// correspondance dans `products.meta_retailer_id`.
//
// Ce que ça débloque, et pourquoi ça compte :
//
//   • LE STOCK BAISSE. Aujourd'hui le flux WhatsApp lit le catalogue Meta, où
//     les produits n'ont pas d'identifiant Camille — donc `applyStock()` ne
//     peut rien décompter. C'était la demande d'origine : « à chaque commande
//     validée le stock demeure le même ».
//   • Une seule saisie. Le commerçant gère ses produits dans Camille, Meta en
//     reçoit le reflet.
//   • Les photos dans les commandes, puisque les noms correspondent enfin.
//   • Un seul identifiant de produit partout : `camille.products.id` sert de
//     `retailer_id`, et servira de `content_id` au Pixel et à CAPI.
//
// GET renvoie l'état de la correspondance, sans rien écrire.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import * as meta from "@/lib/whatsapp/meta";
import { avecAgent } from "@/lib/whatsapp/identifiants";
import { reconcilier } from "@/lib/whatsapp/catalogue-sync";
import { idsAttendus, type AxeVariante } from "@/lib/whatsapp/variantes";

/** L'agent appartient-il bien à l'utilisateur connecté ? */
async function proprietaire(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  if (!(await peut(user.id, agentId, "catalogue"))) return null;
  const r = await query(
    `SELECT id, business_name, website_url FROM camille.agents
      WHERE id = $1 AND status != 'archived'`,
    [agentId]
  );
  return r.rows[0] || null;
}

const PRODUITS = `
  SELECT id, name, description, price, COALESCE(currency,'XAF') AS currency,
         image_url, stock, category, active,
         to_jsonb(p)->>'meta_retailer_id' AS lien,
         COALESCE(to_jsonb(p)->'variants', '[]'::jsonb) AS variants
    FROM camille.products p
   WHERE agent_id = $1
   ORDER BY sort_order ASC, created_at DESC`;

// ── État, sans rien modifier ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const agentId = (req.nextUrl.searchParams.get("agentId") || "").trim();
  if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });
  const agent = await proprietaire(req, agentId);
  if (!agent) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [cam, met] = await Promise.all([
    query(PRODUITS, [agentId]).catch(() => ({ rows: [] })),
    // Le catalogue DE CET AGENT, s'il a connecté son WhatsApp.
    avecAgent(agentId, () => meta.listCatalog()),
  ]);

  // La colonne arrive par migration_meta_transport.sql : son absence ne doit
  // pas faire échouer la lecture d'état, elle doit être signalée.
  let mappes = 0;
  let colonne = true;
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM camille.products
        WHERE agent_id = $1 AND meta_retailer_id IS NOT NULL`,
      [agentId]
    );
    mappes = r.rows[0]?.n ?? 0;
  } catch {
    colonne = false;
  }

  const parId = new Map(met.items.map((i) => [i.retailer_id, i]));
  return NextResponse.json({
    camille: { total: cam.rows.length, mappes, colonne_meta_retailer_id: colonne },
    meta: {
      ok: met.ok,
      error: met.error,
      total: met.items.length,
      envoyables: met.items.filter((i) => i.sendable).length,
      en_attente_whatsapp: met.items.filter((i) => !i.sendable).map((i) => i.retailer_id),
    },
    // Ce que la synchronisation ferait, produit par produit.
    // Un produit à variations n'existe chez Meta que sous « <id>:<option> »,
    // un produit importé sous son identifiant Meta : on cherche les trois.
    apercu: cam.rows.map((p: Record<string, unknown>) => {
      const ids = [
        ...(p.lien ? [String(p.lien)] : []),
        String(p.id),
        ...idsAttendus(
          { id: String(p.id), name: String(p.name), image_url: p.image_url as string | null },
          Array.isArray(p.variants) ? (p.variants as AxeVariante[]) : null
        ),
      ];
      const trouve = ids.map((i) => parId.get(i)).find(Boolean);
      return {
      name: p.name,
      synchronise: Boolean(trouve),
      envoyable: trouve?.sendable ?? false,
      bloquant: !p.image_url ? "pas d'image" : p.price == null ? "pas de prix" : null,
      };
    }),
  });
}

// ── La synchronisation ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const agentId = (req.nextUrl.searchParams.get("agentId") || "").trim();
  if (!agentId) return NextResponse.json({ error: "agentId requis" }, { status: 400 });
  const agent = await proprietaire(req, agentId);
  if (!agent) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Un seul catalogue, vu de deux endroits : ce qui est dans Camille part chez
  // Meta, ce qui est chez Meta et inconnu de Camille est importé, et ce qui
  // existe des deux côtés est RELIÉ au lieu d'être dupliqué.
  const r = await reconcilier(agentId, {
    lien: (agent.website_url as string) || `https://camille.vps.buyticle.com/catalog/${agentId}`,
    marque: (agent.business_name as string) || undefined,
  });

  if (!r.ok) {
    return NextResponse.json(
      { error: r.error || "Synchronisation refusée par Meta", avertissements: r.avertissements },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    envoyes_chez_meta: r.pousses,
    importes_dans_camille: r.importes,
    relies: r.relies,
    avertissements: r.avertissements,
    // Le délai est normal et il faut le dire, sinon le commerçant croit que la
    // synchronisation a échoué.
    note:
      "WhatsApp examine chaque nouveau produit avant de l'autoriser dans un message. " +
      "Un produit tout juste synchronisé n'est donc pas envoyable immédiatement — " +
      "recharge cette page dans quelques heures pour voir passer son statut.",
  });
}
