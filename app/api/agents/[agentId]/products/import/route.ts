// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/[agentId]/products/import — { csv: "…" , simulation?: true }
//
// Le catalogue d'un tableur, en une fois. Un article de même nom est MIS À
// JOUR (prix, stock, catégorie…) plutôt que dupliqué : on peut réimporter son
// fichier chaque semaine pour recaler le stock. `simulation` renvoie ce qui
// serait fait, sans rien écrire — l'écran le montre avant de confirmer.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { lireCatalogue } from "@/lib/import-csv";
import { rafraichirChezMeta, reconcilier } from "@/lib/whatsapp/catalogue-sync";
import { identifiantsAgent } from "@/lib/whatsapp/identifiants";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await peut(user.id, agentId, "catalogue"))) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { csv?: string; simulation?: boolean };
  const csv = String(b.csv || "");
  if (!csv.trim()) return NextResponse.json({ error: "Fichier vide." }, { status: 400 });
  if (csv.length > 5_000_000) return NextResponse.json({ error: "Fichier trop lourd (5 Mo au plus)." }, { status: 400 });

  const { lignes, ecartees } = lireCatalogue(csv);
  if (!lignes.length) return NextResponse.json({ error: ecartees[0] || "Aucun article lisible.", ecartees }, { status: 400 });
  if (lignes.length > 3000) return NextResponse.json({ error: "3 000 articles au plus par import." }, { status: 400 });

  const existants = await query(
    `SELECT id::text AS id, lower(name) AS cle FROM camille.products WHERE agent_id = $1`,
    [agentId]
  );
  const parNom = new Map(existants.rows.map((r: { id: string; cle: string }) => [r.cle, r.id]));
  const aMettreAJour = lignes.filter((l) => parNom.has(l.name.toLowerCase()));
  const aCreer = lignes.filter((l) => !parNom.has(l.name.toLowerCase()));

  if (b.simulation) {
    return NextResponse.json({
      simulation: true,
      crees: aCreer.length, mis_a_jour: aMettreAJour.length, ecartees,
      apercu: lignes.slice(0, 8),
    });
  }

  const touches: string[] = [];
  for (const l of aMettreAJour) {
    const id = parNom.get(l.name.toLowerCase())!;
    // Une cellule vide ne fait rien : on ne remet pas un prix à zéro parce
    // que la colonne manquait dans ce fichier-là.
    await query(
      `UPDATE camille.products
          SET price = COALESCE($2, price), stock = COALESCE($3, stock),
              category = COALESCE($4, category), description = COALESCE($5, description),
              image_url = COALESCE($6, image_url), updated_at = NOW()
        WHERE id = $1 AND agent_id = $7`,
      [id, l.price, l.stock, l.category, l.description, l.image_url, agentId]
    ).catch((e) => ecartees.push(`« ${l.name} » : ${(e as Error).message}`));
    touches.push(id);
  }
  let crees = 0;
  for (const l of aCreer) {
    try {
      await query(
        `INSERT INTO camille.products (agent_id, name, description, price, currency, category, stock, image_url, active)
         VALUES ($1, $2, $3, $4, 'XAF', $5, $6, $7, true)`,
        [agentId, l.name, l.description || "", l.price, l.category, l.stock, l.image_url]
      );
      crees++;
    } catch (e) {
      ecartees.push(`« ${l.name} » : ${(e as Error).message}`);
    }
  }

  // Le catalogue WhatsApp suit : stock et prix des articles déjà publiés, puis
  // une réconciliation pour publier les nouveaux (ceux qui ont une image).
  rafraichirChezMeta(agentId, touches).catch(() => {});
  // Seulement sur le compte WhatsApp du commerçant lui-même.
  if (crees && (await identifiantsAgent(agentId)).source === "agent") reconcilier(agentId).catch(() => {});

  return NextResponse.json({ ok: true, crees, mis_a_jour: aMettreAJour.length, ecartees });
}
